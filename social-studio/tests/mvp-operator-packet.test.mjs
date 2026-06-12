import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildMvpOperatorPacket,
  buildMvpOperatorPacketFromFiles
} from "../tools/build-mvp-operator-packet.mjs";

function completionAudit() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "incomplete",
    mvpComplete: false,
    summary: {
      totalRequirements: 14,
      completeRequirements: 10,
      blockedRequirements: 4
    },
    nextAction: "Record human approval before treating the MVP as complete.",
    requirements: [
      { id: "postiz_local_input_validation", label: "Postiz local input validation", status: "complete" },
      { id: "human_approval_recorded", label: "Human approval recorded", status: "blocked", detail: "Record human approval first." },
      { id: "real_postiz_inputs", label: "Real local Postiz input values", status: "blocked", detail: "Real Postiz integration IDs and uploaded media references are still required." },
      { id: "postiz_dry_run_package", label: "Postiz draft dry-run package", status: "blocked", detail: "Dry-run package has not been created." },
      { id: "approved_mvp_complete", label: "Approved draft-only MVP complete", status: "blocked", detail: "The MVP is not complete until every requirement above is complete." }
    ]
  };
}

function finishPath() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "waiting_for_human_approval",
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    summary: {
      totalSteps: 5,
      completeSteps: 0,
      availableSteps: 1,
      blockedSteps: 4,
      currentStep: "Review and record decision"
    },
    nextAction: "Review all generated assets, then copy approve or edit notes before using needs_revision or reject.",
    steps: [
      {
        id: "review_and_decide",
        label: "Review and record decision",
        status: "available",
        detail: "3 generated assets need a real review decision.",
        action: "Review all generated assets, then copy approve, needs_revision, or reject.",
        commands: [
          {
            id: "approve",
            label: "Approve",
            status: "available",
            command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=approve --reviewer=\"Andre\"",
            copyEnabled: true
          },
          {
            id: "needs_revision",
            label: "Needs revision",
            status: "available",
            command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=needs_revision --reviewer=\"Andre\" --notes=\"EDIT REQUIRED: describe changes\"",
            copyEnabled: false,
            requiresNoteEdit: true
          },
          {
            id: "reject",
            label: "Reject",
            status: "available",
            command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=reject --reviewer=\"Andre\" --notes=\"EDIT REQUIRED: describe reason\"",
            copyEnabled: false,
            requiresNoteEdit: true
          }
        ]
      },
      {
        id: "fill_local_postiz_inputs",
        label: "Fill real local Postiz inputs",
        status: "blocked",
        detail: "Local Postiz integration IDs and uploaded media references are still needed.",
        action: "Fill only local Postiz IDs and uploaded media references. Do not paste API keys or tokens.",
        commands: [
          {
            id: "validate_postiz_inputs",
            label: "Validate Postiz inputs",
            status: "available",
            command: "node social-studio\\tools\\validate-postiz-local-inputs.mjs"
          }
        ]
      }
    ]
  };
}

function postizValidation() {
  return {
    status: "blocked",
    readyForDryRun: false,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    summary: {
      missingChecks: 6,
      secretFieldCount: 0
    },
    nextAction: "Replace placeholder Postiz values in the local files, then rerun validation."
  };
}

function humanApprovalHandoff() {
  return {
    status: "awaiting_human_decision",
    decisionReadiness: {
      status: "ready_for_human_decision",
      summary: {
        totalAssets: 3,
        readyAssets: 3,
        blockedAssets: 0
      }
    }
  };
}

function postizInputKit() {
  return {
    status: "needs_real_values",
    operatorPreflight: {
      missingChecks: 6
    },
    operatorEditPlan: {
      files: [
        {
          id: "postiz_integrations",
          file: "integrations.local.json",
          records: [
            {
              key: "instagram",
              label: "instagram",
              status: "missing",
              requiredFields: ["id", "settings.__type"],
              valueShown: false
            },
            {
              key: "facebook",
              label: "facebook",
              status: "missing",
              requiredFields: ["id", "settings.__type"],
              valueShown: false
            },
            {
              key: "tiktok",
              label: "tiktok",
              status: "missing",
              requiredFields: ["id", "settings.__type"],
              valueShown: false
            }
          ]
        },
        {
          id: "postiz_uploaded_media",
          file: "uploaded-media.local.json",
          records: [
            {
              key: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
              label: "UGC video",
              contentType: "ugc_video",
              mediaType: "video",
              sourceAssetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4",
              sourceInstruction: "Upload the reviewed source asset to Postiz, then paste the returned media id and path.",
              status: "missing",
              requiredFields: ["id", "path"],
              valueShown: false
            },
            {
              key: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
              label: "Paid ad video",
              contentType: "paid_ad_video",
              mediaType: "video",
              sourceAssetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4",
              sourceInstruction: "Upload the reviewed source asset to Postiz, then paste the returned media id and path.",
              status: "missing",
              requiredFields: ["id", "path"],
              valueShown: false
            },
            {
              key: "cc-rubber-base-demo-2026-06-10-normal-post-03",
              label: "Normal post",
              contentType: "normal_post",
              mediaType: "image",
              sourceAssetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg",
              sourceInstruction: "Upload the reviewed source asset to Postiz, then paste the returned media id and path.",
              status: "missing",
              requiredFields: ["id", "path"],
              valueShown: false
            }
          ]
        }
      ],
      forbiddenFields: [
        "Do not add API keys, access tokens, refresh tokens, cookies, passwords, or secrets.",
        "Do not add scheduling or publishing fields.",
        "Do not remove assetId or contentType from uploaded media records."
      ],
      valueShown: false
    }
  };
}

test("builds a single copy-only operator packet for the current MVP blockers", () => {
  const packet = buildMvpOperatorPacket({
    completionAudit: completionAudit(),
    finishPath: finishPath(),
    postizLocalValidation: postizValidation(),
    humanApprovalHandoff: humanApprovalHandoff(),
    postizInputKit: postizInputKit(),
    generatedAt: "2026-06-11T09:20:00.000Z"
  });

  assert.equal(packet.packageType, "social_studio_mvp_operator_packet");
  assert.equal(packet.status, "waiting_for_human_approval");
  assert.equal(packet.commandOnly, true);
  assert.equal(packet.networkCallsAllowed, false);
  assert.equal(packet.liveActionsEnabled, false);
  assert.equal(packet.summary.totalRequirements, 14);
  assert.equal(packet.summary.completeRequirements, 10);
  assert.equal(packet.summary.blockedRequirements, 4);
  assert.equal(packet.summary.currentStep, "Review and record decision");
  assert.deepEqual(
    packet.currentBlockers.map((blocker) => blocker.id),
    ["human_approval_recorded", "real_postiz_inputs", "postiz_dry_run_package", "approved_mvp_complete"]
  );
  assert.equal(packet.nextSafeActions[0].id, "review_and_decide");
  assert.equal(packet.nextSafeActions[0].commands[0].id, "approve");
  assert.deepEqual(
    packet.nextSafeActions[0].commands.map((command) => [command.id, command.copyEnabled, command.requiresNoteEdit]),
    [
      ["approve", true, false],
      ["needs_revision", false, true],
      ["reject", false, true]
    ]
  );
  assert.deepEqual(
    packet.gatedUpcomingActions.map((action) => action.id),
    ["fill_local_postiz_inputs"]
  );
  assert.equal(packet.gatedUpcomingActions[0].status, "blocked");
  assert.equal(packet.gatedUpcomingActions[0].commands[0].id, "validate_postiz_inputs");
  assert.equal(packet.gatedUpcomingActions[0].commands[0].copyEnabled, false);
  assert.match(packet.gatedUpcomingActions[0].blockedUntil, /Human approval recorded/i);
  assert.doesNotMatch(packet.gatedUpcomingActions[0].blockedUntil, /Real local Postiz input values/i);
  assert.doesNotMatch(packet.gatedUpcomingActions[0].blockedUntil, /Postiz draft dry-run package/i);
  assert.doesNotMatch(packet.gatedUpcomingActions[0].blockedUntil, /Approved draft-only MVP complete/i);
  assert.equal(packet.postizValidation.status, "blocked");
  assert.equal(packet.postizValidation.missingChecks, 6);
  assert.equal(packet.handoffSnapshot.humanDecision.status, "ready_for_human_decision");
  assert.equal(packet.handoffSnapshot.humanDecision.readyAssets, 3);
  assert.equal(packet.handoffSnapshot.postizInputs.status, "needs_real_values");
  assert.equal(packet.handoffSnapshot.postizInputs.missingChecks, 6);
  assert.equal(packet.handoffSnapshot.postizInputs.sourceAssets.length, 3);
  assert.match(packet.handoffSnapshot.postizInputs.sourceAssets[0].sourceAssetUrl, /final-1\.mp4/);
  assert.equal(packet.handoffSnapshot.postizInputs.sourceAssets[0].valueShown, false);
  assert.equal(packet.postizInputChecklist.status, "needs_real_values");
  assert.equal(packet.postizInputChecklist.summary.requiredPlatforms, 3);
  assert.equal(packet.postizInputChecklist.summary.requiredMediaAssets, 3);
  assert.equal(packet.postizInputChecklist.summary.valuesShown, false);
  assert.deepEqual(
    packet.postizInputChecklist.integrationSlots.map((slot) => slot.platform),
    ["instagram", "facebook", "tiktok"]
  );
  assert.deepEqual(
    packet.postizInputChecklist.mediaUploadRefs.map((item) => item.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );
  assert.match(packet.postizInputChecklist.mediaUploadRefs[0].sourceAssetUrl, /final-1\.mp4/);
  assert.deepEqual(packet.postizInputChecklist.mediaUploadRefs[0].requiredFields, ["id", "path"]);
  assert.match(packet.postizInputChecklist.forbiddenFields.join("\n"), /API keys/i);
  assert.deepEqual(packet.operatorFiles.map((file) => file.file), [
    "social-studio/generated/cc-rubber-base-demo-2026-06-10/human-approval-handoff/human-approval-handoff.ui.json",
    "social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/integrations.local.json",
    "social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/uploaded-media.local.json"
  ]);
  assert.match(packet.forbiddenActions.join("\n"), /Do not call the Postiz API/i);
  assert.match(packet.forbiddenActions.join("\n"), /Do not schedule or publish/i);
  assert.match(packet.markdown, /MVP Operator Packet/);
  assert.match(packet.markdown, /Needs revision: copy disabled until notes are edited/i);
  assert.match(packet.markdown, /Reject: copy disabled until notes are edited/i);
  assert.match(packet.markdown, /Gated Upcoming Actions/);
  assert.match(packet.markdown, /Fill real local Postiz inputs: blocked/);
  assert.match(packet.markdown, /Readiness Snapshot/);
  assert.match(packet.markdown, /Postiz Input Checklist/);
  assert.match(packet.markdown, /Integration slots: instagram, facebook, tiktok/);
  assert.match(packet.markdown, /Normal post: \/social-studio\/cc-rubber-base-demo-2026-06-10\/review\/normal-post-03\.svg/);
  assert.match(packet.markdown, /Human decision: ready_for_human_decision/);
  assert.match(packet.markdown, /UGC video: \/social-studio\/cc-rubber-base-demo-2026-06-10\/review\/final-1\.mp4/);
  assert.doesNotMatch(JSON.stringify(packet.uiSummary), /C:\\|localPath|thumbnailPath|postiz-instagram-channel-id|postiz-facebook-channel-id/i);
});

test("writes operator packet JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-mvp-operator-packet-"));
  try {
    const completionPath = path.join(tempDir, "completion.ui.json");
    const finishPathPath = path.join(tempDir, "finish-path.ui.json");
    const validationPath = path.join(tempDir, "validation.ui.json");
    const humanApprovalPath = path.join(tempDir, "human-approval-handoff.ui.json");
    const postizInputKitPath = path.join(tempDir, "postiz-input-kit.ui.json");
    const outDir = path.join(tempDir, "operator-packet");
    await writeFile(completionPath, `${JSON.stringify(completionAudit(), null, 2)}\n`);
    await writeFile(finishPathPath, `${JSON.stringify(finishPath(), null, 2)}\n`);
    await writeFile(validationPath, `${JSON.stringify(postizValidation(), null, 2)}\n`);
    await writeFile(humanApprovalPath, `${JSON.stringify(humanApprovalHandoff(), null, 2)}\n`);
    await writeFile(postizInputKitPath, `${JSON.stringify(postizInputKit(), null, 2)}\n`);

    const result = await buildMvpOperatorPacketFromFiles({
      completionAuditPath: completionPath,
      finishPathPath,
      postizLocalValidationPath: validationPath,
      humanApprovalHandoffPath: humanApprovalPath,
      postizInputKitPath,
      outDir,
      generatedAt: "2026-06-11T09:20:00.000Z"
    });

    const saved = JSON.parse(await readFile(path.join(outDir, "mvp-operator-packet.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "mvp-operator-packet.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "mvp-operator-packet.md"), "utf8");

    assert.equal(result.status, "waiting_for_human_approval");
    assert.equal(saved.currentBlockers.length, 4);
    assert.equal(saved.handoffSnapshot.postizInputs.sourceAssets.length, 3);
    assert.equal(saved.postizInputChecklist.integrationSlots.length, 3);
    assert.equal(saved.postizInputChecklist.mediaUploadRefs.length, 3);
    assert.equal(ui.nextSafeActions[0].label, "Review and record decision");
    assert.deepEqual(
      ui.nextSafeActions[0].commands.map((command) => [command.id, command.copyEnabled, command.requiresNoteEdit]),
      [
        ["approve", true, false],
        ["needs_revision", false, true],
        ["reject", false, true]
      ]
    );
    assert.equal(ui.gatedUpcomingActions[0].label, "Fill real local Postiz inputs");
    assert.equal(ui.gatedUpcomingActions[0].commands[0].copyEnabled, false);
    assert.equal(ui.handoffSnapshot.humanDecision.readyAssets, 3);
    assert.equal(ui.postizInputChecklist.summary.requiredMediaAssets, 3);
    assert.match(ui.postizInputChecklist.integrationSlots[0].localInputFile, /integrations\.local\.json/);
    assert.match(ui.handoffSnapshot.postizInputs.sourceAssets[2].sourceAssetUrl, /normal-post-03\.svg/);
    assert.match(markdown, /Do not schedule or publish/i);
    assert.match(markdown, /Needs revision: copy disabled until notes are edited/i);
    assert.match(markdown, /Readiness Snapshot/i);
    assert.match(markdown, /Postiz Input Checklist/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
