import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildMvpReadinessAudit,
  buildMvpReadinessAuditFromFiles
} from "../tools/build-mvp-readiness-audit.mjs";

function workflowStatus(status = "needs_review") {
  const approved = status !== "needs_review";
  const draftReady = status === "postiz_draft_ready";
  return {
    packageType: "social_studio_workflow_status",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    overall: {
      status,
      mvpComplete: false,
      reason: "MVP remains review-first."
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
    },
    blockers:
      status === "needs_review"
        ? ["Human review approval is required before Postiz draft creation."]
        : draftReady
          ? []
          : ["Postiz dry-run package is missing."],
    nextActions:
      status === "needs_review"
        ? ["Complete human review of the MP4/contact sheet and record approve, needs_revision, or reject."]
        : draftReady
          ? ["Use the dry-run payload to create a Postiz draft only after separate approval for API use."]
          : ["Upload approved media to local Postiz, capture returned media id/path, then build the dry-run draft payload."]
  };
}

function reviewPacket() {
  return {
    packageType: "social_studio_review_packet",
    status: "needs_review",
    review: {
      decisionRequired: true
    },
    safety: {
      notLiveConfirmed: true,
      scheduleOrPublishReady: false
    },
    assets: {
      videoUrl: "/social-studio/current/final-1.mp4",
      contactSheetUrl: "/social-studio/current/contact-sheet.jpg"
    }
  };
}

function manualManifest(status = "needs_review") {
  return {
    packageType: status === "draft_upload_ready" ? "postiz_manual_draft_ready" : "postiz_manual_upload_preview",
    postiz: {
      handoffMode: "manual_upload",
      status,
      scheduledFor: ""
    },
    review: {
      approvedBy: status === "draft_upload_ready" ? "Andre" : "pending-human-review",
      approvedAt: status === "draft_upload_ready" ? "2026-06-10T12:00:00.000Z" : "",
      notLiveConfirmed: true
    }
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
    brandRules: [
      "Speak to South African nail technicians.",
      "Use product-page or human-approved claims only."
    ],
    summary: {
      totalAssets: 3,
      assetsNeedingHumanClaimCheck: 3,
      publishAllowed: 0
    },
    assets: [
      {
        contentType: "ugc_video",
        claimRules: {
          approvedBenefits: ["smooth base"],
          blockedClaims: ["medical claims"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        requiredVisuals: ["product_closeup"],
        reviewChecks: { notLive: true, brandFit: false, claimSafe: false },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "paid_ad_video",
        claimRules: {
          approvedBenefits: ["smooth base"],
          blockedClaims: ["invented testimonials"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        requiredVisuals: ["product_closeup"],
        reviewChecks: { notLive: true, brandFit: false, claimSafe: false },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "normal_post",
        claimRules: {
          approvedBenefits: ["cleaner colour application"],
          blockedClaims: ["guaranteed results"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        requiredVisuals: ["product_closeup"],
        reviewChecks: { notLive: true, brandFit: false, claimSafe: false },
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
        generated: { mediaPresent: true },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "paid_ad_video",
        state: "packet_ready",
        generated: { mediaPresent: false },
        review: { status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        contentType: "normal_post",
        state: "packet_ready",
        generated: { mediaPresent: false },
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

function dryRunPackage() {
  return {
    packageType: "postiz_api_draft_dry_run",
    dryRunOnly: true,
    transport: {
      networkCallsAllowed: false
    },
    postizPayload: {
      type: "draft",
      posts: [{ integration: { id: "integration-id" }, value: [{ image: [{ id: "media-id" }] }] }]
    },
    safety: {
      notLiveConfirmed: true
    }
  };
}

test("current needs-review state is not complete and points to human review", () => {
  const audit = buildMvpReadinessAudit({
    workflowStatus: workflowStatus("needs_review"),
    reviewPacket: reviewPacket(),
    manualManifest: manualManifest("needs_review"),
    contentPlan: contentPlan(),
    brandClaimLedger: brandClaimLedger(),
    productionPackets: productionPackets(),
    productionQueue: productionQueue(),
    reviewBoard: reviewBoard(),
    verification: {
      testsPassing: true,
      buildPassing: true,
      secretScanPassing: true,
      pathLeakScanPassing: true
    }
  });

  assert.equal(audit.overall.status, "blocked_by_human_review");
  assert.equal(audit.overall.mvpComplete, false);
  assert.equal(audit.gates.contentPlan.status, "ready");
  assert.equal(audit.gates.brandClaimLedger.status, "ready");
  assert.equal(audit.gates.productionPackets.status, "ready");
  assert.equal(audit.gates.productionQueue.status, "ready");
  assert.equal(audit.gates.reviewBoard.status, "ready");
  assert.equal(audit.gates.humanApproval.status, "blocked");
  assert.match(audit.nextActions[0], /human review/i);
  assert.match(audit.markdown, /MVP complete: no/);
});

test("approved state waits for Postiz dry-run package", () => {
  const audit = buildMvpReadinessAudit({
    workflowStatus: workflowStatus("approved_waiting_postiz_dry_run"),
    reviewPacket: { ...reviewPacket(), status: "approved", review: { decisionRequired: false } },
    manualManifest: manualManifest("draft_upload_ready"),
    contentPlan: contentPlan(),
    brandClaimLedger: brandClaimLedger(),
    productionPackets: productionPackets(),
    productionQueue: productionQueue(),
    reviewBoard: reviewBoard(),
    verification: {
      testsPassing: true,
      buildPassing: true,
      secretScanPassing: true,
      pathLeakScanPassing: true
    }
  });

  assert.equal(audit.overall.status, "approved_waiting_postiz_dry_run");
  assert.equal(audit.gates.humanApproval.status, "ready");
  assert.equal(audit.gates.postizApiDryRun.status, "blocked");
  assert.equal(audit.overall.mvpComplete, false);
});

test("postiz draft-ready state is complete for the draft-only MVP but still not publish-ready", () => {
  const audit = buildMvpReadinessAudit({
    workflowStatus: workflowStatus("postiz_draft_ready"),
    reviewPacket: { ...reviewPacket(), status: "approved", review: { decisionRequired: false } },
    manualManifest: manualManifest("draft_upload_ready"),
    contentPlan: contentPlan(),
    brandClaimLedger: brandClaimLedger(),
    productionPackets: productionPackets(),
    productionQueue: productionQueue(),
    reviewBoard: reviewBoard(),
    postizDryRunPackage: dryRunPackage(),
    verification: {
      testsPassing: true,
      buildPassing: true,
      secretScanPassing: true,
      pathLeakScanPassing: true
    }
  });

  assert.equal(audit.overall.status, "draft_mvp_ready");
  assert.equal(audit.overall.mvpComplete, true);
  assert.equal(audit.gates.postizApiDryRun.status, "ready");
  assert.equal(audit.gates.noLivePosting.status, "ready");
  assert.equal(audit.gates.finalPublish.status, "not_in_scope");
});

test("placeholder Postiz dry-run values keep the MVP audit blocked", () => {
  const placeholderDryRun = dryRunPackage();
  placeholderDryRun.postizPayload.posts[0].integration.id = "replace-with-postiz-integration-id";
  placeholderDryRun.postizPayload.posts[0].value[0].image[0].id = "replace-with-media-id";

  const audit = buildMvpReadinessAudit({
    workflowStatus: workflowStatus("postiz_draft_ready"),
    reviewPacket: { ...reviewPacket(), status: "approved", review: { decisionRequired: false } },
    manualManifest: manualManifest("draft_upload_ready"),
    contentPlan: contentPlan(),
    brandClaimLedger: brandClaimLedger(),
    productionPackets: productionPackets(),
    productionQueue: productionQueue(),
    reviewBoard: reviewBoard(),
    postizDryRunPackage: placeholderDryRun,
    verification: {
      testsPassing: true,
      buildPassing: true,
      secretScanPassing: true,
      pathLeakScanPassing: true
    }
  });

  assert.equal(audit.overall.status, "approved_waiting_postiz_dry_run");
  assert.equal(audit.overall.mvpComplete, false);
  assert.equal(audit.gates.postizApiDryRun.status, "blocked");
});

test("writes JSON and Markdown audit from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-mvp-audit-"));
  try {
    const workflowPath = path.join(tempDir, "workflow-status.json");
    const reviewPath = path.join(tempDir, "review-packet.json");
    const manifestPath = path.join(tempDir, "manifest.json");
    const contentPlanPath = path.join(tempDir, "content-plan.json");
    const brandClaimLedgerPath = path.join(tempDir, "brand-claim-ledger.json");
    const productionPacketsPath = path.join(tempDir, "production-packets.json");
    const productionQueuePath = path.join(tempDir, "production-queue.json");
    const reviewBoardPath = path.join(tempDir, "review-board.json");
    const jsonOut = path.join(tempDir, "mvp-readiness-audit.json");
    const markdownOut = path.join(tempDir, "mvp-readiness-audit.md");
    await writeFile(workflowPath, `${JSON.stringify(workflowStatus("needs_review"), null, 2)}\n`);
    await writeFile(reviewPath, `${JSON.stringify(reviewPacket(), null, 2)}\n`);
    await writeFile(manifestPath, `${JSON.stringify(manualManifest("needs_review"), null, 2)}\n`);
    await writeFile(contentPlanPath, `${JSON.stringify(contentPlan(), null, 2)}\n`);
    await writeFile(brandClaimLedgerPath, `${JSON.stringify(brandClaimLedger(), null, 2)}\n`);
    await writeFile(productionPacketsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);
    await writeFile(productionQueuePath, `${JSON.stringify(productionQueue(), null, 2)}\n`);
    await writeFile(reviewBoardPath, `${JSON.stringify(reviewBoard(), null, 2)}\n`);

    const result = await buildMvpReadinessAuditFromFiles({
      workflowStatusPath: workflowPath,
      reviewPacketPath: reviewPath,
      manualManifestPath: manifestPath,
      contentPlanPath,
      brandClaimLedgerPath,
      productionPacketsPath,
      productionQueuePath,
      reviewBoardPath,
      jsonOut,
      markdownOut,
      verification: {
        testsPassing: true,
        buildPassing: true,
        secretScanPassing: true,
        pathLeakScanPassing: true
      }
    });

    assert.equal(result.status, "blocked_by_human_review");
    const saved = JSON.parse(await readFile(jsonOut, "utf8"));
    const markdown = await readFile(markdownOut, "utf8");
    assert.equal(saved.overall.mvpComplete, false);
    assert.match(markdown, /Human approval/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
