import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applyReviewDecision } from "../tools/record-review-decision.mjs";
import { runPostizDryRunCycle } from "../tools/run-postiz-dry-run-cycle.mjs";

const fullApprovalEvidence = [
  "UGC video evidence reviewed",
  "Paid ad video evidence reviewed",
  "Normal post evidence reviewed",
  "Artifact freshness checked",
  "Rollback and not-live proof reviewed",
  "Approved for Postiz draft upload only"
].join("; ");

function pendingBundle(baseDir) {
  const media = path.join(baseDir, "final-1.mp4");
  const thumbnail = path.join(baseDir, "thumb.jpg");
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    reviewStatus: {
      campaignId: "cc-rubber-base-demo-2026-06-10",
      assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
      status: "needs_review",
      reviewer: "pending-human-review",
      checks: {
        brandFit: false,
        claimSafe: false,
        productVisible: false,
        captionReady: false,
        ctaReady: false,
        platformReady: false,
        notLive: true
      },
      notes: "Needs review.",
      approval: {
        approvedBy: "",
        approvedAt: "",
        approvalEvidence: ""
      }
    },
    postizHandoff: {
      campaignId: "cc-rubber-base-demo-2026-06-10",
      assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
      handoffMode: "manual_upload",
      platforms: ["instagram", "facebook"],
      media: {
        localPath: media,
        thumbnailPath: thumbnail,
        mediaType: "video",
        aspectRatio: "9:16"
      },
      caption: "Smooth base for cleaner salon work. Shop Crystal Clawz French Rubber Base.",
      hashtags: ["#CrystalClawz", "#NailTechSA"],
      scheduledFor: "",
      status: "needs_review",
      review: {
        approvedBy: "pending-human-review",
        approvedAt: "",
        notLiveConfirmed: true,
        notes: "Preview only."
      }
    },
    moneyprinterTask: {
      taskId: "task-123",
      state: 1,
      progress: 100,
      crossPostResults: null
    }
  };
}

function approvedBundle(baseDir) {
  return applyReviewDecision(pendingBundle(baseDir), {
    decision: "approve",
    reviewer: "Andre",
    evidence: fullApprovalEvidence,
    approvedAt: "2026-06-10T12:00:00.000Z",
    notes: "Approved for Postiz draft creation only."
  });
}

function approvedBundleWithReviewAssets(baseDir) {
  const bundle = approvedBundle(baseDir);
  bundle.postizHandoff.reviewAssets = [
    {
      assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
      label: "UGC video",
      contentType: "ugc_video",
      mediaType: "video",
      localPath: path.join(baseDir, "final-1.mp4"),
      assetUrl: "/social-studio/current/final-1.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
      label: "Paid ad video",
      contentType: "paid_ad_video",
      mediaType: "video",
      localPath: path.join(baseDir, "paid-ad-video-02.mp4"),
      assetUrl: "/social-studio/current/paid-ad-video-02.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
      label: "Normal post",
      contentType: "normal_post",
      mediaType: "image",
      localPath: path.join(baseDir, "normal-post-03.svg"),
      assetUrl: "/social-studio/current/normal-post-03.svg"
    }
  ];
  return bundle;
}

function integrations() {
  return [
    {
      platform: "instagram",
      id: "postiz-instagram-channel-id",
      settings: {
        __type: "instagram",
        post_type: "reel"
      }
    },
    {
      platform: "facebook",
      id: "postiz-facebook-channel-id",
      settings: {
        __type: "facebook"
      }
    }
  ];
}

function uploadedMedia() {
  return [
    {
      id: "uploaded-media-id",
      path: "https://uploads.postiz.com/final-1.mp4"
    }
  ];
}

function uploadedMediaForAllAssets() {
  return [
    {
      assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
      contentType: "ugc_video",
      id: "uploaded-ugc-video-id",
      path: "https://uploads.postiz.com/final-1.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
      contentType: "paid_ad_video",
      id: "uploaded-paid-ad-video-id",
      path: "https://uploads.postiz.com/paid-ad-video-02.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
      contentType: "normal_post",
      id: "uploaded-normal-post-id",
      path: "https://uploads.postiz.com/normal-post-03.svg"
    }
  ];
}

function reviewPacket() {
  return {
    packageType: "social_studio_review_packet",
    safety: {
      notLiveConfirmed: true,
      scheduleOrPublishReady: false
    },
    assets: {
      videoUrl: "/social-studio/current/final-1.mp4"
    }
  };
}

function manualManifest(bundle) {
  return {
    campaignId: bundle.campaignId,
    assetId: bundle.assetId,
    packageType: "postiz_manual_draft_ready",
    postiz: {
      handoffMode: "manual_upload",
      status: "draft_upload_ready",
      scheduledFor: ""
    },
    review: {
      approvedBy: "Andre",
      approvedAt: "2026-06-10T12:00:00.000Z",
      notLiveConfirmed: true,
      approvalEvidenceSummary: bundle.reviewStatus.approval.evidenceSummary,
      approvalScope: bundle.reviewStatus.approval.scope
    }
  };
}

function humanApprovalHandoff() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "approval_recorded",
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    scheduleOrPublishReady: false,
    reviewAssets: [
      { contentType: "ugc_video", label: "UGC video" },
      { contentType: "paid_ad_video", label: "Paid ad video" },
      { contentType: "normal_post", label: "Normal post" }
    ],
    decisionCommands: [],
    nextAction: "Approval has been recorded."
  };
}

function contentPlan() {
  return {
    packageType: "social_studio_content_plan",
    safety: {
      noLivePosting: true,
      postizDraftOnlyAfterApproval: true
    },
    assets: [
      {
        contentType: "ugc_video",
        review: { required: true, status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "paid_ad_video",
        review: { required: true, status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "normal_post",
        review: { required: true, status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
  };
}

function brandClaimLedger() {
  return {
    packageType: "social_studio_brand_claim_ledger",
    status: "needs_review",
    safety: {
      noLivePosting: true,
      postizBlockedUntilApproval: true,
      publishAllowed: false
    },
    brandRules: ["Speak to South African nail technicians."],
    summary: {
      totalAssets: 3,
      assetsNeedingHumanClaimCheck: 3,
      publishAllowed: 0
    },
    assets: [
      {
        contentType: "ugc_video",
        claimRules: { approvedBenefits: ["smooth base"], blockedClaims: ["medical claims"], sourceRef: "source" },
        reviewChecks: { notLive: true },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "paid_ad_video",
        claimRules: { approvedBenefits: ["smooth base"], blockedClaims: ["invented testimonials"], sourceRef: "source" },
        reviewChecks: { notLive: true },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "normal_post",
        claimRules: { approvedBenefits: ["cleaner colour application"], blockedClaims: ["guaranteed results"], sourceRef: "source" },
        reviewChecks: { notLive: true },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
  };
}

function productionPackets() {
  return {
    packageType: "social_studio_production_packets",
    safety: {
      noLivePosting: true,
      networkCallsAllowed: false,
      postizBlockedUntilApproval: true,
      publishAllowed: false
    },
    assets: [
      {
        contentType: "ugc_video",
        packetType: "moneyprinter_video_request",
        execution: { networkCallsAllowed: false },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "paid_ad_video",
        packetType: "moneyprinter_video_request",
        execution: { networkCallsAllowed: false },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "normal_post",
        packetType: "static_post_copy_brief",
        execution: { networkCallsAllowed: false },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
  };
}

function productionQueue() {
  return {
    packageType: "social_studio_production_queue",
    status: "needs_review",
    safety: {
      noLivePosting: true,
      networkCallsAllowed: false,
      postizBlockedUntilApproval: true,
      publishAllowed: false
    },
    summary: {
      totalAssets: 3,
      generatedAssets: 1,
      needsReview: 1,
      packetReady: 2,
      publishAllowed: 0
    },
    items: [
      {
        contentType: "ugc_video",
        state: "generated_needs_review",
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "paid_ad_video",
        state: "packet_ready",
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "normal_post",
        state: "packet_ready",
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
  };
}

function reviewBoard() {
  return {
    packageType: "social_studio_review_board",
    status: "needs_review",
    safety: {
      noLivePosting: true,
      liveActionsEnabled: false,
      postizBlockedUntilApproval: true,
      publishAllowed: false
    },
    summary: {
      totalAssets: 3,
      decisionRequired: 1,
      produceBeforeReview: 2,
      publishAllowed: 0
    },
    items: [
      {
        contentType: "ugc_video",
        reviewAction: "review_decision_required",
        decisions: [{ decision: "approve" }, { decision: "needs_revision" }, { decision: "reject" }],
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "paid_ad_video",
        reviewAction: "produce_before_review",
        decisions: [],
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "normal_post",
        reviewAction: "produce_before_review",
        decisions: [],
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
  };
}

async function seedFiles(tempDir, bundle, uploadedMediaFixture = uploadedMedia()) {
  await writeFile(bundle.postizHandoff.media.localPath, "fake video");
  await writeFile(bundle.postizHandoff.media.thumbnailPath, "fake thumb");
  const bundlePath = path.join(tempDir, "bundle.json");
  const integrationsPath = path.join(tempDir, "integrations.json");
  const uploadedMediaPath = path.join(tempDir, "uploaded-media.json");
  const reviewPacketPath = path.join(tempDir, "review-packet.json");
  const manualManifestPath = path.join(tempDir, "manifest.json");
  const contentPlanPath = path.join(tempDir, "content-plan.json");
  const brandClaimLedgerPath = path.join(tempDir, "brand-claim-ledger.json");
  const productionPacketsPath = path.join(tempDir, "production-packets.json");
  const productionQueuePath = path.join(tempDir, "production-queue.json");
  const reviewBoardPath = path.join(tempDir, "review-board.json");
  const mvpPlanPath = path.join(tempDir, "mvp-plan.md");
  const humanApprovalHandoffPath = path.join(tempDir, "human-approval-handoff.ui.json");
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  await writeFile(integrationsPath, `${JSON.stringify(integrations(), null, 2)}\n`);
  await writeFile(uploadedMediaPath, `${JSON.stringify(uploadedMediaFixture, null, 2)}\n`);
  await writeFile(reviewPacketPath, `${JSON.stringify(reviewPacket(), null, 2)}\n`);
  await writeFile(manualManifestPath, `${JSON.stringify(manualManifest(bundle), null, 2)}\n`);
  await writeFile(contentPlanPath, `${JSON.stringify(contentPlan(), null, 2)}\n`);
  await writeFile(brandClaimLedgerPath, `${JSON.stringify(brandClaimLedger(), null, 2)}\n`);
  await writeFile(productionPacketsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);
  await writeFile(productionQueuePath, `${JSON.stringify(productionQueue(), null, 2)}\n`);
  await writeFile(reviewBoardPath, `${JSON.stringify(reviewBoard(), null, 2)}\n`);
  await writeFile(
    mvpPlanPath,
    [
      "# MVP plan",
      "",
      "Review-first Postiz draft workflow.",
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
      "4. Edit the failing part only.",
      ""
    ].join("\n")
  );
  await writeFile(humanApprovalHandoffPath, `${JSON.stringify(humanApprovalHandoff(), null, 2)}\n`);
  return {
    bundlePath,
    integrationsPath,
    uploadedMediaPath,
    reviewPacketPath,
    manualManifestPath,
    contentPlanPath,
    brandClaimLedgerPath,
    productionPacketsPath,
    productionQueuePath,
    reviewBoardPath,
    mvpPlanPath,
    humanApprovalHandoffPath
  };
}

test("approved cycle writes dry-run Postiz payload, workflow status, and ready audit", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-cycle-"));
  try {
    const files = await seedFiles(tempDir, approvedBundle(tempDir));
    const outDir = path.join(tempDir, "generated");

    const result = await runPostizDryRunCycle({
      input: files.bundlePath,
      integrationsPath: files.integrationsPath,
      uploadedMediaPath: files.uploadedMediaPath,
      reviewPacketPath: files.reviewPacketPath,
      manualManifestPath: files.manualManifestPath,
      contentPlanPath: files.contentPlanPath,
      brandClaimLedgerPath: files.brandClaimLedgerPath,
      productionPacketsPath: files.productionPacketsPath,
      productionQueuePath: files.productionQueuePath,
      reviewBoardPath: files.reviewBoardPath,
      outDir,
      verification: {
        testsPassing: true,
        buildPassing: true,
        secretScanPassing: true,
        pathLeakScanPassing: true
      },
      generatedAt: "2026-06-10T15:00:00.000Z"
    });

    assert.equal(result.status, "postiz_draft_ready");
    assert.equal(result.auditStatus, "draft_mvp_ready");

    const dryRun = JSON.parse(await readFile(path.join(outDir, "postiz-draft.dry-run.json"), "utf8"));
    assert.equal(dryRun.dryRunOnly, true);
    assert.equal(dryRun.transport.networkCallsAllowed, false);
    assert.equal(dryRun.postizPayload.type, "draft");

    const status = JSON.parse(await readFile(path.join(outDir, "workflow-status.json"), "utf8"));
    assert.equal(status.overall.status, "postiz_draft_ready");
    assert.equal(status.readiness.canCreatePostizDraft, true);

    const audit = JSON.parse(await readFile(path.join(outDir, "mvp-readiness-audit.json"), "utf8"));
    assert.equal(audit.overall.status, "draft_mvp_ready");
    assert.equal(audit.overall.mvpComplete, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approved cycle writes dry-run payload values for every approved review asset", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-cycle-assets-"));
  try {
    const files = await seedFiles(
      tempDir,
      approvedBundleWithReviewAssets(tempDir),
      uploadedMediaForAllAssets()
    );
    const outDir = path.join(tempDir, "generated");

    await runPostizDryRunCycle({
      input: files.bundlePath,
      integrationsPath: files.integrationsPath,
      uploadedMediaPath: files.uploadedMediaPath,
      reviewPacketPath: files.reviewPacketPath,
      manualManifestPath: files.manualManifestPath,
      contentPlanPath: files.contentPlanPath,
      brandClaimLedgerPath: files.brandClaimLedgerPath,
      productionPacketsPath: files.productionPacketsPath,
      productionQueuePath: files.productionQueuePath,
      reviewBoardPath: files.reviewBoardPath,
      outDir,
      verification: {
        testsPassing: true,
        buildPassing: true,
        secretScanPassing: true,
        pathLeakScanPassing: true
      },
      generatedAt: "2026-06-10T15:00:00.000Z"
    });

    const dryRun = JSON.parse(await readFile(path.join(outDir, "postiz-draft.dry-run.json"), "utf8"));
    assert.equal(dryRun.approvedAssets.length, 3);
    assert.equal(dryRun.postizPayload.posts[0].value.length, 3);
    assert.deepEqual(
      dryRun.postizPayload.posts[0].value.map((value) => value.image[0].id),
      ["uploaded-ugc-video-id", "uploaded-paid-ad-video-id", "uploaded-normal-post-id"]
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approved cycle refreshes completion, command center, readiness, and finish path", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-cycle-complete-"));
  try {
    const files = await seedFiles(
      tempDir,
      approvedBundleWithReviewAssets(tempDir),
      uploadedMediaForAllAssets()
    );
    const outDir = path.join(tempDir, "generated");

    const result = await runPostizDryRunCycle({
      input: files.bundlePath,
      integrationsPath: files.integrationsPath,
      uploadedMediaPath: files.uploadedMediaPath,
      reviewPacketPath: files.reviewPacketPath,
      manualManifestPath: files.manualManifestPath,
      contentPlanPath: files.contentPlanPath,
      brandClaimLedgerPath: files.brandClaimLedgerPath,
      productionPacketsPath: files.productionPacketsPath,
      productionQueuePath: files.productionQueuePath,
      reviewBoardPath: files.reviewBoardPath,
      mvpPlanPath: files.mvpPlanPath,
      humanApprovalHandoffPath: files.humanApprovalHandoffPath,
      outDir,
      verification: {
        testsPassing: true,
        buildPassing: true,
        secretScanPassing: true,
        pathLeakScanPassing: true
      },
      generatedAt: "2026-06-10T15:00:00.000Z"
    });

    assert.equal(result.completionStatus, "complete");
    assert.equal(result.finishPathStatus, "complete");
    assert.equal(result.postizReadinessStatus, "dry_run_ready");
    assert.equal(result.commandCenterStatus, "dry_run_ready");
    assert.equal(result.postizLocalValidationStatus, "ready");

    const completion = JSON.parse(
      await readFile(path.join(outDir, "mvp-completion-audit", "mvp-completion-audit.json"), "utf8")
    );
    const finishPath = JSON.parse(
      await readFile(path.join(outDir, "mvp-finish-path", "mvp-finish-path.json"), "utf8")
    );
    const postizReadiness = JSON.parse(
      await readFile(path.join(outDir, "postiz-dry-run-readiness", "postiz-dry-run-readiness.json"), "utf8")
    );
    const commandCenter = JSON.parse(
      await readFile(path.join(outDir, "postiz-command-center", "postiz-command-center.json"), "utf8")
    );
    const postizLocalValidation = JSON.parse(
      await readFile(path.join(outDir, "postiz-input-kit", "postiz-local-input-validation.json"), "utf8")
    );

    assert.equal(completion.mvpComplete, true);
    assert.equal(completion.summary.totalRequirements, 14);
    assert.equal(completion.summary.completeRequirements, 14);
    assert.equal(
      completion.requirements.find((item) => item.id === "postiz_local_input_validation").status,
      "complete"
    );
    assert.equal(
      completion.requirements.find((item) => item.id === "agent_skill_loop").status,
      "complete"
    );
    assert.equal(
      completion.requirements.find((item) => item.id === "rollback_not_live_proof").status,
      "complete"
    );
    assert.equal(finishPath.summary.completeSteps, 5);
    assert.equal(postizReadiness.status, "dry_run_ready");
    assert.equal(postizReadiness.summary.requiredMediaAssets, 3);
    assert.equal(postizReadiness.summary.uploadedMediaReady, 3);
    assert.equal(commandCenter.status, "dry_run_ready");
    assert.equal(postizLocalValidation.status, "ready");
    assert.equal(postizLocalValidation.readyForDryRun, true);
    assert.equal(postizLocalValidation.networkCallsAllowed, false);
    assert.equal(postizLocalValidation.summary.missingChecks, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("cycle rejects needs-review bundles before creating any dry-run payload", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-cycle-"));
  try {
    const files = await seedFiles(tempDir, pendingBundle(tempDir));

    await assert.rejects(
      () =>
        runPostizDryRunCycle({
          input: files.bundlePath,
          integrationsPath: files.integrationsPath,
          uploadedMediaPath: files.uploadedMediaPath,
          reviewPacketPath: files.reviewPacketPath,
          manualManifestPath: files.manualManifestPath,
          outDir: path.join(tempDir, "generated"),
          verification: {
            testsPassing: true,
            buildPassing: true,
            secretScanPassing: true,
            pathLeakScanPassing: true
          }
        }),
      /approved bundle/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("cycle rejects stale approved manual manifests before creating any dry-run payload", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-cycle-stale-manifest-"));
  try {
    const files = await seedFiles(tempDir, approvedBundle(tempDir));
    const staleManifest = manualManifest(approvedBundle(tempDir));
    staleManifest.campaignId = "older-campaign";
    staleManifest.assetId = "older-asset";
    staleManifest.review.approvalScope = {
      approvedFor: "schedule_and_publish",
      allowsSchedulingOrPublishing: true
    };
    await writeFile(files.manualManifestPath, `${JSON.stringify(staleManifest, null, 2)}\n`);
    const outDir = path.join(tempDir, "generated");

    await assert.rejects(
      () =>
        runPostizDryRunCycle({
          input: files.bundlePath,
          integrationsPath: files.integrationsPath,
          uploadedMediaPath: files.uploadedMediaPath,
          reviewPacketPath: files.reviewPacketPath,
          manualManifestPath: files.manualManifestPath,
          outDir,
          verification: {
            testsPassing: true,
            buildPassing: true,
            secretScanPassing: true,
            pathLeakScanPassing: true
          }
        }),
      /approved manual manifest/i
    );
    await assert.rejects(
      () => readFile(path.join(outDir, "postiz-draft.dry-run.json"), "utf8"),
      /ENOENT/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("cycle rejects remote Postiz API bases", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-cycle-"));
  try {
    const files = await seedFiles(tempDir, approvedBundle(tempDir));

    await assert.rejects(
      () =>
        runPostizDryRunCycle({
          input: files.bundlePath,
          integrationsPath: files.integrationsPath,
          uploadedMediaPath: files.uploadedMediaPath,
          reviewPacketPath: files.reviewPacketPath,
          manualManifestPath: files.manualManifestPath,
          outDir: path.join(tempDir, "generated"),
          apiBaseUrl: "https://api.postiz.com/public/v1",
          verification: {
            testsPassing: true,
            buildPassing: true,
            secretScanPassing: true,
            pathLeakScanPassing: true
          }
        }),
      /local Postiz API base/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("cycle rejects example placeholder integration and media files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-cycle-"));
  try {
    const files = await seedFiles(tempDir, approvedBundle(tempDir));
    const placeholderIntegrationsPath = path.resolve("social-studio/handoff/postiz/api-draft/integrations.example.json");
    const placeholderUploadedMediaPath = path.resolve("social-studio/handoff/postiz/api-draft/uploaded-media.example.json");

    await assert.rejects(
      () =>
        runPostizDryRunCycle({
          input: files.bundlePath,
          integrationsPath: placeholderIntegrationsPath,
          uploadedMediaPath: placeholderUploadedMediaPath,
          reviewPacketPath: files.reviewPacketPath,
          manualManifestPath: files.manualManifestPath,
          outDir: path.join(tempDir, "generated"),
          verification: {
            testsPassing: true,
            buildPassing: true,
            secretScanPassing: true,
            pathLeakScanPassing: true
          }
        }),
      /placeholder/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
