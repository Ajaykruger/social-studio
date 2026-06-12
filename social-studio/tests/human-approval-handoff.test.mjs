import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildHumanApprovalHandoff,
  buildHumanApprovalHandoffFromFiles
} from "../tools/build-human-approval-handoff.mjs";

function reviewPacket() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    status: "needs_review",
    decisionRequired: true,
    notLiveConfirmed: true,
    scheduleOrPublishReady: false,
    videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4",
    contactSheetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/contact-sheet.jpg",
    thumbnailUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/moneyprinter-final-thumb.jpg",
    caption: "Smooth base for cleaner salon work. Shop Crystal Clawz French Rubber Base.",
    hashtags: ["#CrystalClawz", "#NailTechSA"],
    visualReviewSummary:
      "The draft is suitable for workflow proof and manual review. It should not be treated as final approved creative yet.",
    nextAction: "Review the MP4 and contact sheet, then record approve, needs_revision, or reject."
  };
}

function decisionCommands() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    status: "needs_review",
    commandOnly: true,
    liveActionsEnabled: false,
    summary: {
      commandCount: 3,
      liveActionsEnabled: false,
      blocker: "Human review decision is required before Postiz draft creation.",
      nextAction: "Review the MP4/contact sheet, then copy the approve, needs_revision, or reject command."
    },
    commands: [
      {
        decision: "approve",
        label: "Approve",
        resultStatus: "approved_waiting_postiz_dry_run",
        effect: {
          createsApprovedBundle: true,
          createsManualPostizPackage: true,
          keepsPostizBlocked: false,
          allowsSchedulingOrPublishing: false,
          operatorSummary:
            "Creates the approved bundle and manual Postiz package for Postiz draft upload only. Scheduling and publishing still need separate approval."
        },
        evidenceChecklist: [
          "UGC video evidence reviewed",
          "Paid ad video evidence reviewed",
          "Normal post evidence reviewed",
          "Artifact freshness checked",
          "Rollback and not-live proof reviewed",
          "Approved for Postiz draft upload only"
        ],
        requiresNoteEdit: false,
        copyEnabled: true,
        noteGuidance: "Approval notes are already scoped to Postiz draft upload only.",
        command:
          "node social-studio\\tools\\run-review-decision-cycle.mjs `\n  --decision=approve `\n  --reviewer=\"Andre\""
      },
      {
        decision: "needs_revision",
        label: "Needs revision",
        resultStatus: "needs_revision",
        effect: {
          createsApprovedBundle: false,
          createsManualPostizPackage: false,
          keepsPostizBlocked: true,
          allowsSchedulingOrPublishing: false,
          operatorSummary:
            "Keeps Postiz blocked and records the requested changes before any draft upload can continue."
        },
        evidenceChecklist: [
          "UGC video evidence reviewed",
          "Paid ad video evidence reviewed",
          "Normal post evidence reviewed",
          "Artifact freshness checked",
          "Revision notes describe exactly what must change",
          "Postiz remains blocked"
        ],
        requiresNoteEdit: true,
        copyEnabled: false,
        noteGuidance: "Edit --notes with specific revision notes before running.",
        command:
          "node social-studio\\tools\\run-review-decision-cycle.mjs `\n  --decision=needs_revision `\n  --reviewer=\"Andre\""
      },
      {
        decision: "reject",
        label: "Reject",
        resultStatus: "rejected",
        effect: {
          createsApprovedBundle: false,
          createsManualPostizPackage: false,
          keepsPostizBlocked: true,
          allowsSchedulingOrPublishing: false,
          operatorSummary:
            "Stops this asset from continuing to Postiz. No approved bundle, draft upload, scheduling, or publishing is created."
        },
        evidenceChecklist: [
          "UGC video evidence reviewed",
          "Paid ad video evidence reviewed",
          "Normal post evidence reviewed",
          "Artifact freshness checked",
          "Rejection notes describe why the campaign should stop",
          "Postiz remains blocked"
        ],
        requiresNoteEdit: true,
        copyEnabled: false,
        noteGuidance: "Edit --notes with specific rejection notes before running.",
        command:
          "node social-studio\\tools\\run-review-decision-cycle.mjs `\n  --decision=reject `\n  --reviewer=\"Andre\""
      }
    ]
  };
}

function brandClaimLedger() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    noLivePosting: true,
    postizBlockedUntilApproval: true,
    summary: {
      totalAssets: 3,
      assetsNeedingHumanClaimCheck: 3,
      publishAllowed: 0
    },
    brandRules: [
      "Use product-page or human-approved claims only.",
      "Do not invent reviews, awards, lab results, testimonials, before-and-after proof, or medical-style claims."
    ],
    assets: [
      { contentType: "ugc_video", label: "UGC video", reviewStatus: "needs_review", publishAllowed: false },
      { contentType: "paid_ad_video", label: "Paid ad video", reviewStatus: "needs_review", publishAllowed: false },
      { contentType: "normal_post", label: "Normal post", reviewStatus: "needs_review", publishAllowed: false }
    ]
  };
}

function productionPackets() {
  return {
    packageType: "social_studio_production_packets",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    safety: {
      noLivePosting: true,
      networkCallsAllowed: false,
      postizBlockedUntilApproval: true,
      scheduleAllowed: false,
      publishAllowed: false
    },
    assets: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        contentType: "ugc_video",
        label: "UGC video",
        packetType: "moneyprinter_video_request",
        generator: "MoneyPrinterTurbo",
        moneyprinterRequest: {
          video_script_prompt: "UGC prompt with smooth base benefit and no invented testimonials."
        },
        review: {
          focus: ["creator-style hook feels natural", "product is visible early"]
        }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        contentType: "paid_ad_video",
        label: "Paid ad video",
        packetType: "moneyprinter_video_request",
        generator: "MoneyPrinterTurbo",
        moneyprinterRequest: {
          video_script_prompt: "Paid ad prompt with clear hook, product visibility, and CTA."
        },
        review: {
          focus: ["first three seconds show the problem or product clearly", "offer and CTA are explicit"]
        }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        contentType: "normal_post",
        label: "Normal post",
        packetType: "static_post_copy_brief",
        generator: "Manual or Canva-style post builder",
        staticPost: {
          captionDraft: "French Rubber Base helps with smooth base. Shop Crystal Clawz French Rubber Base.",
          designBrief: "Show French Rubber Base helping South African nail technicians.",
          suggestedFormats: ["1:1", "4:5"]
        },
        review: {
          focus: ["caption is useful without overclaiming", "CTA is clear"]
        }
      }
    ]
  };
}

function completionAudit() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "incomplete",
    mvpComplete: false,
    summary: {
      totalRequirements: 12,
      completeRequirements: 8,
      blockedRequirements: 4
    },
    nextAction: "Record human approval before treating the MVP as complete.",
    requirements: [
      {
        id: "rollback_not_live_proof",
        label: "Rollback and not-live proof",
        status: "complete"
      },
      { id: "human_approval_recorded", label: "Human approval recorded", status: "blocked" },
      { id: "real_postiz_inputs", label: "Real local Postiz input values", status: "blocked" },
      { id: "postiz_dry_run_package", label: "Postiz draft dry-run package", status: "blocked" },
      { id: "approved_mvp_complete", label: "Approved draft-only MVP complete", status: "blocked" }
    ]
  };
}

function reviewBoard() {
  return {
    packageType: "social_studio_review_board",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    noLivePosting: true,
    liveActionsEnabled: false,
    summary: {
      totalAssets: 3,
      decisionRequired: 3,
      produceBeforeReview: 0,
      publishAllowed: 0
    },
    items: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        label: "UGC video",
        contentType: "ugc_video",
        reviewAction: "review_decision_required",
        videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4",
        contactSheetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/contact-sheet.jpg",
        imageUrl: "",
        decisionCount: 3,
        publishAllowed: false
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        label: "Paid ad video",
        contentType: "paid_ad_video",
        reviewAction: "review_decision_required",
        videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4",
        contactSheetUrl: "",
        imageUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02-storyboard.svg",
        decisionCount: 3,
        publishAllowed: false
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        label: "Normal post",
        contentType: "normal_post",
        reviewAction: "review_decision_required",
        videoUrl: "",
        contactSheetUrl: "",
        imageUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg",
        decisionCount: 3,
        publishAllowed: false
      }
    ]
  };
}

test("builds a copy-only human approval handoff for the current review blocker", () => {
  const handoff = buildHumanApprovalHandoff({
    reviewPacket: reviewPacket(),
    decisionCommands: decisionCommands(),
    brandClaimLedger: brandClaimLedger(),
    completionAudit: completionAudit(),
    reviewBoard: reviewBoard(),
    productionPackets: productionPackets(),
    generatedAt: "2026-06-10T23:00:00.000Z"
  });

  assert.equal(handoff.packageType, "social_studio_human_approval_handoff");
  assert.equal(handoff.status, "awaiting_human_decision");
  assert.equal(handoff.commandOnly, true);
  assert.equal(handoff.networkCallsAllowed, false);
  assert.equal(handoff.liveActionsEnabled, false);
  assert.equal(handoff.scheduleOrPublishReady, false);
  assert.equal(handoff.summary.availableDecisionCommands, 3);
  assert.equal(handoff.summary.completeRequirements, 8);
  assert.deepEqual(
    handoff.decisionCommands.map((command) => command.decision),
    ["approve", "needs_revision", "reject"]
  );
  assert.equal(handoff.decisionCommands[0].effect.createsApprovedBundle, true);
  assert.equal(handoff.decisionCommands[0].effect.allowsSchedulingOrPublishing, false);
  assert.match(handoff.decisionCommands[0].effect.operatorSummary, /draft upload only/i);
  assert.deepEqual(handoff.decisionCommands[0].evidenceChecklist, [
    "UGC video evidence reviewed",
    "Paid ad video evidence reviewed",
    "Normal post evidence reviewed",
    "Artifact freshness checked",
    "Rollback and not-live proof reviewed",
    "Approved for Postiz draft upload only"
  ]);
  assert.equal(handoff.approvalEvidenceSummary.status, "ready");
  assert.equal(handoff.approvalEvidenceSummary.summary.totalGates, 6);
  assert.equal(handoff.approvalEvidenceSummary.summary.coveredGates, 6);
  assert.equal(handoff.approvalEvidenceSummary.summary.blockedGates, 0);
  assert.deepEqual(
    handoff.approvalEvidenceSummary.gates.map((gate) => gate.label),
    [
      "UGC video evidence reviewed",
      "Paid ad video evidence reviewed",
      "Normal post evidence reviewed",
      "Artifact freshness checked",
      "Rollback and not-live proof reviewed",
      "Approved for Postiz draft upload only"
    ]
  );
  assert.deepEqual(
    handoff.approvalEvidenceSummary.gates.map((gate) => gate.status),
    ["covered", "covered", "covered", "covered", "covered", "covered"]
  );
  assert.equal(handoff.decisionCommands[0].requiresNoteEdit, false);
  assert.equal(handoff.decisionCommands[0].copyEnabled, true);
  assert.match(handoff.decisionCommands[0].noteGuidance, /scoped to Postiz draft upload only/i);
  assert.equal(handoff.decisionCommands[1].effect.keepsPostizBlocked, true);
  assert.equal(handoff.decisionCommands[1].requiresNoteEdit, true);
  assert.equal(handoff.decisionCommands[1].copyEnabled, false);
  assert.match(handoff.media.videoUrl, /final-1\.mp4/);
  assert.match(handoff.media.contactSheetUrl, /contact-sheet\.jpg/);
  assert.equal(handoff.reviewAssets.length, 3);
  assert.equal(handoff.approvalChecklist.length, 3);
  assert.equal(handoff.decisionReadiness.status, "ready_for_human_decision");
  assert.equal(handoff.decisionReadiness.summary.readyAssets, 3);
  assert.equal(handoff.decisionReadiness.items.length, 3);
  assert.deepEqual(
    handoff.decisionReadiness.items.find((item) => item.contentType === "ugc_video").checks.map((check) => check.id),
    ["review_media", "review_evidence", "decision_commands", "publish_blocked", "not_live_proof"]
  );
  assert.equal(
    handoff.decisionReadiness.items.every((item) => item.status === "ready"),
    true
  );
  assert.equal(
    handoff.decisionReadiness.items.every((item) =>
      item.checks.every((check) => check.status === "ready")
    ),
    true
  );
  assert.deepEqual(
    handoff.approvalChecklist.map((item) => item.assetId),
    [
      "cc-rubber-base-demo-2026-06-10-ugc-video-01",
      "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
      "cc-rubber-base-demo-2026-06-10-normal-post-03"
    ]
  );
  assert.equal(
    handoff.approvalChecklist.every((item) => item.requiredChecks.includes("Confirm asset is not live or scheduled.")),
    true
  );
  const ugcChecklist = handoff.approvalChecklist.find((item) => item.contentType === "ugc_video");
  assert.deepEqual(
    ugcChecklist.reviewEvidence.map((item) => item.label),
    ["Video", "Contact sheet", "MoneyPrinter prompt", "Review focus"]
  );
  assert.match(ugcChecklist.reviewEvidence.find((item) => item.type === "prompt").summary, /smooth base benefit/i);
  const paidAdChecklist = handoff.approvalChecklist.find((item) => item.contentType === "paid_ad_video");
  assert.deepEqual(
    paidAdChecklist.reviewEvidence.map((item) => item.label),
    ["Video", "Storyboard", "MoneyPrinter prompt", "Review focus"]
  );
  assert.match(paidAdChecklist.reviewEvidence.find((item) => item.label === "Storyboard").url, /storyboard\.svg/);
  const normalPostChecklist = handoff.approvalChecklist.find((item) => item.contentType === "normal_post");
  assert.deepEqual(
    normalPostChecklist.reviewEvidence.map((item) => item.label),
    ["Image", "Caption draft", "Design brief", "Review focus"]
  );
  assert.match(normalPostChecklist.reviewEvidence.find((item) => item.label === "Caption draft").summary, /French Rubber Base/i);
  assert.equal(handoff.reviewAssets.find((asset) => asset.contentType === "paid_ad_video").assetUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4");
  assert.equal(handoff.reviewAssets.find((asset) => asset.contentType === "normal_post").assetUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg");
  assert.equal(handoff.reviewChecks.notLiveConfirmed, true);
  assert.equal(handoff.reviewChecks.rollbackNotLiveProofReady, true);
  assert.equal(handoff.reviewChecks.publishAllowed, 0);
  assert.equal(handoff.reviewChecks.claimCheckRequired, true);
  assert.deepEqual(
    handoff.decisionIntake.requiredFields.map((field) => field.id),
    ["decision", "reviewer", "evidence", "notes"]
  );
  assert.deepEqual(handoff.decisionIntake.validDecisions, ["approve", "needs_revision", "reject"]);
  assert.match(handoff.decisionIntake.approvalBoundary, /Postiz draft upload only/i);
  assert.equal(handoff.decisionIntake.notLiveRequired, true);
  assert.match(handoff.nextAction, /Review all generated assets/i);
  assert.match(handoff.nextAction, /copy approve or edit notes before running needs_revision or reject/i);
  assert.doesNotMatch(JSON.stringify(handoff.uiSummary), /C:\\|localPath|thumbnailPath|TODO|replace-with|placeholder/i);
});

test("writes human approval handoff JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-human-approval-"));
  try {
    const reviewPacketPath = path.join(tempDir, "review-packet.ui.json");
    const decisionCommandsPath = path.join(tempDir, "review-decision-commands.ui.json");
    const brandClaimLedgerPath = path.join(tempDir, "brand-claim-ledger.ui.json");
    const completionAuditPath = path.join(tempDir, "mvp-completion-audit.ui.json");
    const productionPacketsPath = path.join(tempDir, "production-packets.json");
    const outDir = path.join(tempDir, "human-approval-handoff");

    await writeFile(reviewPacketPath, `${JSON.stringify(reviewPacket(), null, 2)}\n`);
    await writeFile(decisionCommandsPath, `${JSON.stringify(decisionCommands(), null, 2)}\n`);
    await writeFile(brandClaimLedgerPath, `${JSON.stringify(brandClaimLedger(), null, 2)}\n`);
    await writeFile(completionAuditPath, `${JSON.stringify(completionAudit(), null, 2)}\n`);
    await writeFile(productionPacketsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);
    const reviewBoardPath = path.join(tempDir, "review-board.ui.json");
    await writeFile(reviewBoardPath, `${JSON.stringify(reviewBoard(), null, 2)}\n`);

    const result = await buildHumanApprovalHandoffFromFiles({
      reviewPacketPath,
      decisionCommandsPath,
      brandClaimLedgerPath,
      completionAuditPath,
      reviewBoardPath,
      productionPacketsPath,
      outDir,
      generatedAt: "2026-06-10T23:00:00.000Z"
    });

    assert.equal(result.status, "awaiting_human_decision");
    const saved = JSON.parse(await readFile(path.join(outDir, "human-approval-handoff.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "human-approval-handoff.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "human-approval-handoff.md"), "utf8");
    assert.equal(saved.summary.availableDecisionCommands, 3);
    assert.equal(saved.reviewAssets.length, 3);
    assert.equal(saved.approvalChecklist.length, 3);
    assert.match(saved.approvalChecklist[0].prompt, /Approve or request changes/i);
    assert.equal(ui.decisionCommands.length, 3);
    assert.equal(ui.approvalEvidenceSummary.status, "ready");
    assert.equal(ui.approvalEvidenceSummary.summary.coveredGates, 6);
    assert.match(ui.approvalEvidenceSummary.gates[0].evidence, /UGC video/i);
    assert.equal(ui.decisionCommands[0].effect.createsApprovedBundle, true);
    assert.equal(ui.decisionCommands[0].effect.allowsSchedulingOrPublishing, false);
    assert.equal(ui.decisionCommands[0].copyEnabled, true);
    assert.match(ui.decisionCommands[0].evidenceChecklist.join("\n"), /Rollback and not-live proof reviewed/);
    assert.equal(ui.decisionCommands[1].copyEnabled, false);
    assert.equal(ui.decisionCommands[2].copyEnabled, false);
    assert.match(ui.decisionCommands[1].noteGuidance, /specific revision notes/i);
    assert.equal(ui.reviewAssets.length, 3);
    assert.equal(ui.approvalChecklist.length, 3);
    assert.equal(ui.decisionReadiness.status, "ready_for_human_decision");
    assert.equal(ui.decisionReadiness.summary.readyAssets, 3);
    assert.match(ui.decisionReadiness.items[0].checks[0].label, /Review media/i);
    assert.equal(ui.approvalChecklist[0].reviewEvidence.length, 4);
    assert.match(ui.approvalChecklist[1].reviewEvidence.find((item) => item.label === "Storyboard").url, /storyboard\.svg/);
    assert.match(ui.approvalChecklist[2].reviewEvidence.find((item) => item.label === "Caption draft").summary, /French Rubber Base/i);
    assert.equal(ui.reviewChecks.rollbackNotLiveProofReady, true);
    assert.equal(ui.decisionIntake.requiredFields.length, 4);
    assert.match(ui.decisionIntake.requiredFields.find((field) => field.id === "evidence").label, /Evidence/i);
    assert.match(markdown, /Human Approval Handoff/);
    assert.match(markdown, /Decision Intake/);
    assert.match(markdown, /Reviewer name/);
    assert.match(markdown, /Rollback and not-live proof/);
    assert.match(markdown, /Per-Asset Approval Checklist/);
    assert.match(markdown, /Decision Readiness/);
    assert.match(markdown, /Approval Evidence Summary/);
    assert.match(markdown, /UGC video evidence reviewed: covered/);
    assert.match(markdown, /Approved for Postiz draft upload only: covered/);
    assert.match(markdown, /Review media: ready/);
    assert.match(markdown, /Publish blocked: ready/);
    assert.match(markdown, /Review Evidence/);
    assert.match(markdown, /MoneyPrinter prompt/);
    assert.match(markdown, /Caption draft/);
    assert.match(markdown, /Confirm asset is not live or scheduled/);
    assert.match(markdown, /Paid ad video/);
    assert.match(markdown, /Evidence checklist/);
    assert.match(markdown, /Creates approved bundle: yes/);
    assert.match(markdown, /Allows scheduling or publishing: no/);
    assert.match(markdown, /Copy disabled until notes are edited/i);
    assert.match(markdown, /Edit --notes with specific revision notes before running/);
    assert.doesNotMatch(JSON.stringify(ui), /C:\\|localPath|thumbnailPath|TODO|replace-with|placeholder/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
