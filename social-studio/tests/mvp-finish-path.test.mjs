import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildMvpFinishPath,
  buildMvpFinishPathFromFiles
} from "../tools/build-mvp-finish-path.mjs";

function requirement(id, status) {
  return {
    id,
    label: id.replaceAll("_", " "),
    status,
    detail: `${id} is ${status}`
  };
}

function completionAudit({ humanApproved = false, postizInputsReady = false, dryRunReady = false, mvpComplete = false } = {}) {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: mvpComplete ? "complete" : "incomplete",
    mvpComplete,
    summary: {
      totalRequirements: 11,
      completeRequirements: mvpComplete ? 11 : humanApproved ? 8 : 7,
      blockedRequirements: mvpComplete ? 0 : humanApproved ? 3 : 4
    },
    requirements: [
      requirement("brand_brain_and_brief", "complete"),
      requirement("content_workflow_coverage", "complete"),
      requirement("moneyprinter_draft", "complete"),
      requirement("postiz_review_first_handoff", "complete"),
      requirement("no_live_posting", "complete"),
      requirement("verified_build_and_scans", "complete"),
      requirement("postiz_input_safety", "complete"),
      requirement("human_approval_recorded", humanApproved ? "complete" : "blocked"),
      requirement("real_postiz_inputs", postizInputsReady ? "complete" : "blocked"),
      requirement("postiz_dry_run_package", dryRunReady ? "complete" : "blocked"),
      requirement("approved_mvp_complete", mvpComplete ? "complete" : "blocked")
    ],
    nextAction: humanApproved ? "Add real local Postiz values." : "Record human approval before treating the MVP as complete."
  };
}

function humanApprovalHandoff(status = "awaiting_human_decision") {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    scheduleOrPublishReady: false,
    media: {
      videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4",
      contactSheetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/contact-sheet.jpg"
    },
    reviewAssets: [
      { contentType: "ugc_video", label: "UGC video" },
      { contentType: "paid_ad_video", label: "Paid ad video" },
      { contentType: "normal_post", label: "Normal post" }
    ],
    decisionCommands: [
      {
        decision: "approve",
        label: "Approve",
        command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=approve",
        copyEnabled: true
      },
      {
        decision: "needs_revision",
        label: "Needs revision",
        command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=needs_revision --notes=\"EDIT REQUIRED: describe changes\"",
        copyEnabled: false,
        requiresNoteEdit: true
      },
      {
        decision: "reject",
        label: "Reject",
        command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=reject --notes=\"EDIT REQUIRED: describe reason\"",
        copyEnabled: false,
        requiresNoteEdit: true
      }
    ],
    nextAction: "Review all generated assets, then copy approve or edit notes before using needs_revision or reject."
  };
}

function postizInputKit(status = "needs_real_values") {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    networkCallsAllowed: false,
    secretsInUi: false,
    summary: {
      requiredPlatforms: 3,
      readyIntegrations: status === "ready" ? 3 : 0,
      uploadedMediaReady: status === "ready" ? 1 : 0
    },
    validation: {
      inputSecretsReady: true,
      secretFieldCount: 0
    },
    nextAction: status === "ready" ? "Run the Postiz dry-run readiness refresh." : "Copy the template files, paste real local Postiz IDs and uploaded media values, then refresh readiness."
  };
}

function postizReadiness(status = "blocked_by_human_review") {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    dryRunOnly: true,
    networkCallsAllowed: false,
    noLivePosting: true,
    summary: {
      totalSteps: 6,
      readySteps: status === "ready_for_dry_run" ? 5 : status === "dry_run_ready" ? 6 : 2,
      blockedSteps: status === "ready_for_dry_run" ? 1 : status === "dry_run_ready" ? 0 : 4
    },
    nextAction: status === "ready_for_dry_run" ? "Build the Postiz dry-run payload." : "Complete human review before building any Postiz draft payload."
  };
}

function commandCenter(status = "blocked_by_human_review") {
  const readyForDryRun = status === "ready_for_dry_run";
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    commands: [
      {
        id: "prepare_local_postiz_inputs",
        label: "Prepare local Postiz inputs",
        status: "available",
        command: "node social-studio\\tools\\prepare-postiz-local-inputs.mjs"
      },
      {
        id: "validate_postiz_inputs",
        label: "Validate Postiz inputs",
        status: "available",
        command: "node social-studio\\tools\\build-postiz-input-kit.mjs"
      },
      {
        id: "refresh_postiz_readiness",
        label: "Refresh Postiz readiness",
        status: readyForDryRun ? "ready" : "blocked",
        command: "node social-studio\\tools\\build-postiz-dry-run-readiness.mjs"
      },
      {
        id: "build_postiz_dry_run",
        label: "Build Postiz dry-run",
        status: readyForDryRun ? "ready" : "blocked",
        command: "node social-studio\\tools\\run-postiz-dry-run-cycle.mjs"
      }
    ],
    nextAction: readyForDryRun ? "Run the build dry-run command." : "Record human approval, then fill the local Postiz input files."
  };
}

test("current finish path exposes the next safe operator step without live actions", () => {
  const finishPath = buildMvpFinishPath({
    completionAudit: completionAudit(),
    humanApprovalHandoff: humanApprovalHandoff(),
    postizInputKit: postizInputKit(),
    postizReadiness: postizReadiness(),
    commandCenter: commandCenter(),
    generatedAt: "2026-06-10T20:00:00.000Z"
  });

  assert.equal(finishPath.packageType, "social_studio_mvp_finish_path");
  assert.equal(finishPath.status, "waiting_for_human_approval");
  assert.equal(finishPath.commandOnly, true);
  assert.equal(finishPath.networkCallsAllowed, false);
  assert.equal(finishPath.liveActionsEnabled, false);
  assert.equal(finishPath.steps.length, 5);
  assert.deepEqual(
    finishPath.steps.map((step) => step.status),
    ["available", "blocked", "blocked", "blocked", "blocked"]
  );
  assert.match(finishPath.nextAction, /Review all generated assets/i);
  assert.match(finishPath.steps[0].detail, /3 generated assets/i);
  assert.match(finishPath.steps[0].action, /Review all generated assets/i);
  assert.deepEqual(
    finishPath.steps[0].commands.map((command) => [command.id, command.copyEnabled, command.requiresNoteEdit]),
    [
      ["approve", true, false],
      ["needs_revision", false, true],
      ["reject", false, true]
    ]
  );
  assert.deepEqual(finishPath.steps[0].preflightChecks, [
    "Open the human approval handoff.",
    "Review every generated asset and evidence item.",
    "Confirm artifact freshness before copying a decision command."
  ]);
  assert.deepEqual(finishPath.steps[0].expectedOutputs, [
    "approved-bundle.json if approve is copied",
    "approved manual Postiz draft package if approve is copied",
    "needs_revision or rejected state if that decision is copied"
  ]);
  assert.doesNotMatch(JSON.stringify(finishPath.uiSummary), /scheduled-ready/i);
  assert.deepEqual(
    finishPath.steps.find((step) => step.id === "fill_local_postiz_inputs").preflightChecks,
    [
      "Confirm human approval is recorded.",
      "Use only local Postiz integration IDs and uploaded media references.",
      "Do not paste API keys, access tokens, refresh tokens, cookies, passwords, or secrets."
    ]
  );
  assert.deepEqual(
    finishPath.steps.find((step) => step.id === "fill_local_postiz_inputs").expectedOutputs,
    [
      "integrations.local.json",
      "uploaded-media.local.json",
      "postiz-local-input-validation.ui.json"
    ]
  );
  assert.equal(
    finishPath.steps
      .find((step) => step.id === "fill_local_postiz_inputs")
      .commands.some((command) => command.id === "prepare_local_postiz_inputs"),
    true
  );
  assert.match(JSON.stringify(finishPath.uiSummary), /Approve/);
  assert.doesNotMatch(JSON.stringify(finishPath.uiSummary), /C:\\|TODO|replace-with|placeholder|apiKey|accessToken/i);
});

test("approved finish path makes local Postiz input collection the next available step", () => {
  const finishPath = buildMvpFinishPath({
    completionAudit: completionAudit({ humanApproved: true }),
    humanApprovalHandoff: humanApprovalHandoff("approval_recorded"),
    postizInputKit: postizInputKit(),
    postizReadiness: postizReadiness("blocked_by_postiz_inputs"),
    commandCenter: commandCenter("blocked_by_postiz_inputs")
  });

  assert.equal(finishPath.status, "waiting_for_postiz_inputs");
  assert.deepEqual(
    finishPath.steps.map((step) => step.status),
    ["complete", "available", "blocked", "blocked", "blocked"]
  );
  assert.match(finishPath.nextAction, /Fill only local Postiz IDs and uploaded media references/i);
});

test("draft-ready finish path is complete but keeps live publishing separate", () => {
  const finishPath = buildMvpFinishPath({
    completionAudit: completionAudit({
      humanApproved: true,
      postizInputsReady: true,
      dryRunReady: true,
      mvpComplete: true
    }),
    humanApprovalHandoff: humanApprovalHandoff("approval_recorded"),
    postizInputKit: postizInputKit("ready"),
    postizReadiness: postizReadiness("dry_run_ready"),
    commandCenter: commandCenter("dry_run_ready")
  });

  assert.equal(finishPath.status, "complete");
  assert.equal(finishPath.summary.completeSteps, 5);
  assert.equal(finishPath.summary.blockedSteps, 0);
  assert.match(finishPath.nextAction, /separate approval/i);
  assert.equal(finishPath.liveActionsEnabled, false);
});

test("writes finish path JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-finish-path-"));
  try {
    const completionAuditPath = path.join(tempDir, "mvp-completion-audit.ui.json");
    const handoffPath = path.join(tempDir, "human-approval-handoff.ui.json");
    const inputKitPath = path.join(tempDir, "postiz-input-kit.ui.json");
    const readinessPath = path.join(tempDir, "postiz-dry-run-readiness.ui.json");
    const commandCenterPath = path.join(tempDir, "postiz-command-center.ui.json");
    const outDir = path.join(tempDir, "mvp-finish-path");

    await writeFile(completionAuditPath, `${JSON.stringify(completionAudit(), null, 2)}\n`);
    await writeFile(handoffPath, `${JSON.stringify(humanApprovalHandoff(), null, 2)}\n`);
    await writeFile(inputKitPath, `${JSON.stringify(postizInputKit(), null, 2)}\n`);
    await writeFile(readinessPath, `${JSON.stringify(postizReadiness(), null, 2)}\n`);
    await writeFile(commandCenterPath, `${JSON.stringify(commandCenter(), null, 2)}\n`);

    const result = await buildMvpFinishPathFromFiles({
      completionAuditPath,
      humanApprovalHandoffPath: handoffPath,
      postizInputKitPath: inputKitPath,
      postizReadinessPath: readinessPath,
      commandCenterPath,
      outDir,
      generatedAt: "2026-06-10T20:00:00.000Z"
    });

    assert.equal(result.status, "waiting_for_human_approval");
    const saved = JSON.parse(await readFile(path.join(outDir, "mvp-finish-path.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "mvp-finish-path.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "mvp-finish-path.md"), "utf8");
    assert.equal(saved.steps.length, 5);
    assert.equal(saved.steps[0].preflightChecks.length, 3);
    assert.equal(saved.steps[1].expectedOutputs.length, 3);
    assert.equal(ui.steps.length, 5);
    assert.match(ui.steps[0].preflightChecks.join("\n"), /human approval handoff/i);
    assert.match(ui.steps[0].expectedOutputs.join("\n"), /approved manual Postiz draft package/i);
    assert.doesNotMatch(JSON.stringify(ui), /scheduled-ready/i);
    assert.doesNotMatch(markdown, /scheduled-ready/i);
    assert.match(ui.steps[3].expectedOutputs.join("\n"), /postiz-draft\.dry-run\.json/i);
    assert.match(markdown, /MVP Finish Path/);
    assert.match(markdown, /Preflight/);
    assert.match(markdown, /Expected outputs/);
    assert.match(markdown, /Needs revision: Copy disabled until notes are edited/i);
    assert.match(markdown, /Reject: Copy disabled until notes are edited/i);
    assert.match(markdown, /Prepare local Postiz inputs: Copy disabled until prerequisites are ready/i);
    assert.match(markdown, /Validate Postiz inputs: Copy disabled until prerequisites are ready/i);
    assert.doesNotMatch(markdown, /Prepare local Postiz inputs: Copy disabled until notes are edited/i);
    assert.doesNotMatch(markdown, /Validate Postiz inputs: Copy disabled until notes are edited/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
