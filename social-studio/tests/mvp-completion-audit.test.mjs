import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildMvpCompletionAudit,
  buildMvpCompletionAuditFromFiles
} from "../tools/build-mvp-completion-audit.mjs";

function workflowStatus(status = "needs_review") {
  const approved = status !== "needs_review";
  const draftReady = status === "postiz_draft_ready";
  return {
    packageType: "social_studio_workflow_status",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    overall: {
      status,
      mvpComplete: draftReady
    },
    readiness: {
      canCreatePostizDraft: draftReady,
      canScheduleOrPublish: false,
      needsHumanReview: !approved
    },
    safety: {
      noLivePosting: true,
      crossPostResults: null,
      secretsRequired: false
    },
    artifacts: {
      brandContext: true,
      manualPackage: true,
      moneyprinterVideo: true,
      postizDryRunPackage: draftReady
    }
  };
}

function readinessAudit(status = "blocked_by_human_review") {
  const complete = status === "draft_mvp_ready";
  return {
    packageType: "social_studio_mvp_readiness_audit",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    overall: {
      status,
      mvpComplete: complete,
      scope: "draft_only_review_first_mvp"
    },
    gates: {
      planAndBrand: { status: "ready", label: "MVP plan and brand context are present." },
      contentPlan: { status: "ready", label: "Content plan is present." },
      brandClaimLedger: { status: "ready", label: "Claim ledger is present." },
      productionPackets: { status: "ready", label: "Production packets are present." },
      productionQueue: { status: "ready", label: "Production queue is present." },
      reviewBoard: { status: "ready", label: "Review board is present." },
      moneyprinterDraft: { status: "ready", label: "MoneyPrinterTurbo draft video is present." },
      reviewPacket: { status: "ready", label: "Review packet and media are available." },
      humanApproval: {
        status: complete ? "ready" : "blocked",
        label: complete ? "Human approval has been recorded." : "Human approval is still required."
      },
      manualPostizHandoff: { status: "ready", label: "Manual Postiz package exists." },
      postizApiDryRun: {
        status: complete ? "ready" : "blocked",
        label: complete ? "Postiz API draft dry-run package is ready." : "Postiz dry-run package is missing."
      },
      noLivePosting: { status: "ready", label: "No live posting is enabled." },
      verification: { status: "ready", label: "Tests, build, and scans passed." },
      finalPublish: { status: "not_in_scope", label: "Publishing is outside this MVP." }
    }
  };
}

function postizInputKit(status = "needs_real_values") {
  const blockedBySecrets = status === "blocked_by_input_secrets";
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
      missingPlatforms: status === "ready" ? [] : ["instagram", "facebook", "tiktok"],
      uploadedMediaReady: status === "ready",
      integrationsReady: status === "ready",
      inputSecretsReady: !blockedBySecrets,
      secretFieldCount: blockedBySecrets ? 2 : 0,
      secretFields: blockedBySecrets ? ["integrations.0.settings.apiKey", "uploadedMedia.0.accessToken"] : []
    }
  };
}

function postizReadiness(status = "blocked_by_human_review") {
  const complete = status === "dry_run_ready";
  const secretBlocked = status === "blocked_by_postiz_input_secrets";
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    dryRunOnly: true,
    networkCallsAllowed: false,
    noLivePosting: true,
    summary: {
      totalSteps: 6,
      readySteps: complete ? 6 : secretBlocked ? 4 : 2,
      blockedSteps: complete ? 0 : secretBlocked ? 2 : 4
    },
    steps: [
      { id: "human_approval", status: complete ? "ready" : "blocked" },
      { id: "manual_package", status: "ready" },
      { id: "local_input_safety", status: secretBlocked ? "blocked" : "ready" },
      { id: "uploaded_media", status: complete ? "ready" : "blocked" },
      { id: "integrations", status: complete ? "ready" : "blocked" },
      { id: "dry_run_package", status: complete ? "ready" : "blocked" }
    ]
  };
}

function commandCenter(status = "blocked_by_human_review") {
  const complete = status === "dry_run_ready";
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    summary: {
      totalCommands: 3,
      readyCommands: complete ? 3 : 0,
      availableCommands: complete ? 0 : 1,
      blockedCommands: complete ? 0 : 2
    }
  };
}

function postizLocalValidation(status = "blocked") {
  const ready = status === "ready";
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    readyForDryRun: ready,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    summary: {
      missingChecks: ready ? 0 : 6,
      secretFieldCount: 0
    },
    blockingReasons: ready ? [] : ["missing_postiz_input_values"]
  };
}

function rollbackNote() {
  return [
    "# Postiz Rollback And Not-Live Proof",
    "",
    "- Rollback: remove generated approved bundles and dry-run payloads before rerunning the review gate.",
    "- Not live: current handoff is draft-only and no schedule or publish action is authorized.",
    "- Proof: keep Postiz drafts unpublished until separate final scheduling approval."
  ].join("\n");
}

function mvpPlan() {
  return [
    "# MVP Plan",
    "",
    "## Skills And Plugins To Use",
    "",
    "- Superpowers",
    "- Browser",
    "",
    "## Agent Lanes",
    "",
    "- Postiz agent",
    "- MoneyPrinterTurbo agent",
    "- Brand brain agent",
    "- QA/ops agent",
    "",
    "## Build-Check-Edit Loop",
    "",
    "1. Plan the smallest useful slice.",
    "2. Build only that slice.",
    "3. Run the verification gates.",
    "4. Edit the failing part only."
  ].join("\n");
}

test("current review-first state is incomplete and names the remaining blockers", () => {
  const audit = buildMvpCompletionAudit({
    goalText: "Wire Postiz, MoneyPrinterTurbo, and Crystal Clawz brand files into a review-first content workflow.",
    mvpPlan: mvpPlan(),
    workflowStatus: workflowStatus("needs_review"),
    readinessAudit: readinessAudit("blocked_by_human_review"),
    postizInputKit: postizInputKit("needs_real_values"),
    postizLocalValidation: postizLocalValidation("blocked"),
    postizReadiness: postizReadiness("blocked_by_human_review"),
    commandCenter: commandCenter("blocked_by_human_review"),
    rollbackNote: rollbackNote(),
    approvedBundleExists: false,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T22:00:00.000Z"
  });

  assert.equal(audit.packageType, "social_studio_mvp_completion_audit");
  assert.equal(audit.status, "incomplete");
  assert.equal(audit.mvpComplete, false);
  assert.equal(audit.summary.totalRequirements, 14);
  assert.equal(audit.summary.completeRequirements, 10);
  assert.equal(audit.summary.blockedRequirements, 4);
  assert.equal(
    audit.requirements.find((item) => item.id === "agent_skill_loop").status,
    "complete"
  );
  assert.equal(
    audit.requirements.find((item) => item.id === "rollback_not_live_proof").status,
    "complete"
  );
  assert.equal(
    audit.requirements.find((item) => item.id === "postiz_input_safety").status,
    "complete"
  );
  assert.equal(
    audit.requirements.find((item) => item.id === "postiz_local_input_validation").status,
    "complete"
  );
  assert.deepEqual(
    audit.requirements.filter((item) => item.status === "blocked").map((item) => item.id),
    ["human_approval_recorded", "real_postiz_inputs", "postiz_dry_run_package", "approved_mvp_complete"]
  );
  assert.match(audit.nextAction, /Record human approval/i);
  assert.match(audit.markdown, /MVP complete: no/);
  assert.match(audit.markdown, /Scoped agents, skills, and build-check-edit loop/);
  assert.equal(audit.uiSummary.requirements.length, 14);
  assert.doesNotMatch(JSON.stringify(audit.uiSummary), /C:\\|localPath|thumbnailPath|TODO|replace-with|placeholder/i);
});

test("missing rollback and not-live proof blocks the completion audit before approval", () => {
  const audit = buildMvpCompletionAudit({
    goalText: "Complete the draft-only review-first MVP.",
    mvpPlan: mvpPlan(),
    workflowStatus: workflowStatus("needs_review"),
    readinessAudit: readinessAudit("blocked_by_human_review"),
    postizInputKit: postizInputKit("needs_real_values"),
    postizLocalValidation: postizLocalValidation("blocked"),
    postizReadiness: postizReadiness("blocked_by_human_review"),
    commandCenter: commandCenter("blocked_by_human_review"),
    approvedBundleExists: false,
    postizDryRunExists: false
  });

  assert.equal(
    audit.requirements.find((item) => item.id === "rollback_not_live_proof").status,
    "blocked"
  );
  assert.match(audit.nextAction, /Add rollback and not-live proof/i);
});

test("Postiz input secrets keep the MVP incomplete before real input readiness", () => {
  const audit = buildMvpCompletionAudit({
    goalText: "Complete the draft-only review-first MVP.",
    mvpPlan: mvpPlan(),
    workflowStatus: workflowStatus("approved_waiting_postiz_dry_run"),
    readinessAudit: readinessAudit("approved_waiting_postiz_dry_run"),
    postizInputKit: postizInputKit("blocked_by_input_secrets"),
    postizLocalValidation: postizLocalValidation("blocked"),
    postizReadiness: postizReadiness("blocked_by_postiz_input_secrets"),
    commandCenter: commandCenter("blocked_by_human_review"),
    rollbackNote: rollbackNote(),
    approvedBundleExists: true,
    postizDryRunExists: false
  });

  assert.equal(audit.status, "incomplete");
  assert.equal(
    audit.requirements.find((item) => item.id === "postiz_input_safety").status,
    "blocked"
  );
  assert.match(audit.nextAction, /Remove API keys, tokens, and secrets/i);
  assert.equal(JSON.stringify(audit.uiSummary).includes("apiKey"), false);
  assert.equal(JSON.stringify(audit.uiSummary).includes("accessToken"), false);
});

test("draft-ready state is complete only after approval, real Postiz inputs, and dry-run package", () => {
  const audit = buildMvpCompletionAudit({
    goalText: "Complete the draft-only review-first MVP.",
    mvpPlan: mvpPlan(),
    workflowStatus: workflowStatus("postiz_draft_ready"),
    readinessAudit: readinessAudit("draft_mvp_ready"),
    postizInputKit: postizInputKit("ready"),
    postizLocalValidation: postizLocalValidation("ready"),
    postizReadiness: postizReadiness("dry_run_ready"),
    commandCenter: commandCenter("dry_run_ready"),
    rollbackNote: rollbackNote(),
    approvedBundleExists: true,
    postizDryRunExists: true
  });

  assert.equal(audit.status, "complete");
  assert.equal(audit.mvpComplete, true);
  assert.equal(audit.summary.completeRequirements, 14);
  assert.equal(audit.summary.blockedRequirements, 0);
  assert.equal(
    audit.requirements.find((item) => item.id === "approved_mvp_complete").status,
    "complete"
  );
  assert.match(audit.nextAction, /separate approval/i);
});

test("writes completion audit JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-mvp-completion-"));
  try {
    const planPath = path.join(tempDir, "mvp-plan.md");
    const workflowPath = path.join(tempDir, "workflow-status.json");
    const readinessPath = path.join(tempDir, "mvp-readiness-audit.json");
    const inputKitPath = path.join(tempDir, "postiz-input-kit.ui.json");
    const postizReadinessPath = path.join(tempDir, "postiz-dry-run-readiness.ui.json");
    const postizLocalValidationPath = path.join(tempDir, "postiz-local-input-validation.ui.json");
    const commandCenterPath = path.join(tempDir, "postiz-command-center.ui.json");
    const rollbackNotePath = path.join(tempDir, "rollback-note.md");
    const jsonOut = path.join(tempDir, "mvp-completion-audit.json");
    const uiOut = path.join(tempDir, "mvp-completion-audit.ui.json");
    const markdownOut = path.join(tempDir, "mvp-completion-audit.md");

    await writeFile(planPath, `${mvpPlan()}\n`);
    await writeFile(workflowPath, `${JSON.stringify(workflowStatus("needs_review"), null, 2)}\n`);
    await writeFile(readinessPath, `${JSON.stringify(readinessAudit("blocked_by_human_review"), null, 2)}\n`);
    await writeFile(inputKitPath, `${JSON.stringify(postizInputKit("needs_real_values"), null, 2)}\n`);
    await writeFile(postizLocalValidationPath, `${JSON.stringify(postizLocalValidation("blocked"), null, 2)}\n`);
    await writeFile(postizReadinessPath, `${JSON.stringify(postizReadiness("blocked_by_human_review"), null, 2)}\n`);
    await writeFile(commandCenterPath, `${JSON.stringify(commandCenter("blocked_by_human_review"), null, 2)}\n`);
    await writeFile(rollbackNotePath, `${rollbackNote()}\n`);

    const result = await buildMvpCompletionAuditFromFiles({
      goalText: "Complete the draft-only review-first MVP.",
      mvpPlanPath: planPath,
      workflowStatusPath: workflowPath,
      readinessAuditPath: readinessPath,
      postizInputKitPath: inputKitPath,
      postizLocalValidationPath,
      postizReadinessPath,
      commandCenterPath,
      rollbackNotePath,
      jsonOut,
      uiOut,
      markdownOut,
      generatedAt: "2026-06-10T22:00:00.000Z"
    });

    assert.equal(result.status, "incomplete");
    const saved = JSON.parse(await readFile(jsonOut, "utf8"));
    const ui = JSON.parse(await readFile(uiOut, "utf8"));
    const markdown = await readFile(markdownOut, "utf8");
    assert.equal(saved.summary.blockedRequirements, 4);
    assert.equal(ui.summary.completeRequirements, 10);
    assert.match(markdown, /Postiz local input validation/);
    assert.match(markdown, /Scoped agents, skills, and build-check-edit loop/);
    assert.match(markdown, /MVP Completion Audit/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
