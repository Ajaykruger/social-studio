import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { refreshCurrentReviewState } from "../tools/refresh-current-review-state.mjs";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function pendingBundle(baseDir) {
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
        localPath: path.join(baseDir, "final-1.mp4"),
        thumbnailPath: path.join(baseDir, "thumb.jpg"),
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

function brief() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    campaignName: "French Rubber Base Draft Demo",
    product: {
      name: "French Rubber Base",
      category: "Rubber Base Gel",
      url: "https://crystalclawz.co.za/collections/french-rubber-base"
    },
    audience: "South African nail technicians",
    painPoint: "French and colour work can look messy when the base is uneven",
    contentType: "ugc_video",
    platforms: ["instagram", "facebook", "tiktok"],
    cta: "Shop Crystal Clawz French Rubber Base",
    tone: "Friendly, professional, practical, salon-focused",
    claimSource: {
      sourceType: "product_page",
      sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base",
      approvedBenefits: ["smooth base", "cleaner colour application", "salon-ready base"],
      blockedClaims: ["medical or health claims", "guaranteed perfect results"]
    },
    reviewer: "pending-human-review",
    dueDate: "",
    status: "brief"
  };
}

function product() {
  return {
    productId: "french-rubber-base",
    name: "French Rubber Base",
    category: "Rubber Base Gel",
    sourceUrl: "https://crystalclawz.co.za/collections/french-rubber-base",
    approvedBenefits: ["smooth base", "cleaner colour application", "salon-ready base"],
    blockedClaims: ["medical or health claims", "guaranteed perfect results", "invented testimonials"],
    requiredVisuals: ["product_closeup", "shade_or_swatch", "cta_end_frame"],
    mediaFolder: "",
    approvalNote: "Use only product-page-supported claims or human-approved Crystal Clawz wording.",
    lastReviewedAt: "",
    reviewedBy: ""
  };
}

async function seedPendingReview(tempDir, bundle = pendingBundle(tempDir)) {
  await writeFile(bundle.postizHandoff.media.localPath, "fake video");
  await writeFile(bundle.postizHandoff.media.thumbnailPath, "fake thumb");
  const contactSheetPath = path.join(tempDir, "contact_sheet.jpg");
  const visualReviewPath = path.join(tempDir, "visual-review.md");
  await writeFile(contactSheetPath, "fake contact sheet");
  await writeFile(
    visualReviewPath,
    [
      "Product visible, but this still needs human review.",
      `Reviewed file: ${bundle.postizHandoff.media.localPath}`
    ].join("\n")
  );
  const bundlePath = path.join(tempDir, "draft-bundle.json");
  const briefPath = path.join(tempDir, "brief.json");
  const productPath = path.join(tempDir, "product.json");
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  await writeFile(briefPath, `${JSON.stringify(brief(), null, 2)}\n`);
  await writeFile(productPath, `${JSON.stringify(product(), null, 2)}\n`);
  return { bundlePath, briefPath, productPath, contactSheetPath, visualReviewPath };
}

function fakePaidAdVideoBuilder(calls) {
  return async ({ videoPath }) => {
    calls.push(videoPath);
    await writeFile(videoPath, "fake paid ad video");
  };
}

test("refreshes the current unapproved review state without approval or Postiz API side effects", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-refresh-"));
  try {
    const files = await seedPendingReview(tempDir);
    const generatedDir = path.join(tempDir, "generated");
    const manualPackageDir = path.join(tempDir, "manual-package");
    const publicOutDir = path.join(tempDir, "public-review");
    const paidAdVideoBuilds = [];

    const result = await refreshCurrentReviewState({
      bundlePath: files.bundlePath,
      briefPath: files.briefPath,
      productPath: files.productPath,
      generatedDir,
      manualPackageDir,
      contactSheetPath: files.contactSheetPath,
      visualReviewPath: files.visualReviewPath,
      publicOutDir,
      publicUrlBase: "/social-studio/current/review",
      generatedAt: "2026-06-10T16:30:00.000Z",
      verification: {
        testsPassing: true,
        buildPassing: true,
        secretScanPassing: true,
        pathLeakScanPassing: true
      },
      paidAdVideoBuilder: fakePaidAdVideoBuilder(paidAdVideoBuilds)
    });

    assert.equal(result.status, "blocked_by_human_review");
    assert.equal(result.workflowStatus, "needs_review");
    assert.equal(result.approvalCreated, false);
    assert.equal(result.postizDryRunCreated, false);
    assert.equal(await exists(result.paths.postizInputKit), true);
    assert.equal(await exists(result.paths.postizInputKitUi), true);
    assert.equal(await exists(result.paths.postizLocalInputValidation), true);
    assert.equal(await exists(result.paths.postizLocalInputValidationUi), true);
    assert.equal(await exists(result.paths.postizDryRunReadiness), true);
    assert.equal(await exists(result.paths.postizDryRunReadinessUi), true);
    assert.equal(await exists(result.paths.postizCommandCenter), true);
    assert.equal(await exists(result.paths.postizCommandCenterUi), true);
    assert.equal(await exists(result.paths.normalPostReview), true);
    assert.equal(await exists(result.paths.normalPostReviewUi), true);
    assert.equal(await exists(result.paths.paidAdVideoReview), true);
    assert.equal(await exists(result.paths.paidAdVideoReviewUi), true);
    assert.equal(await exists(result.paths.humanApprovalHandoff), true);
    assert.equal(await exists(result.paths.humanApprovalHandoffUi), true);
    assert.equal(await exists(path.join(publicOutDir, "normal-post-03.svg")), true);
    assert.equal(await exists(path.join(publicOutDir, "paid-ad-video-02.mp4")), true);
    assert.equal(await exists(path.join(publicOutDir, "paid-ad-video-02-storyboard.svg")), true);
    assert.equal(paidAdVideoBuilds.length, 1);
    assert.equal(await exists(path.join(generatedDir, "approved-bundle.json")), false);
    assert.equal(await exists(path.join(generatedDir, "postiz-draft.dry-run.json")), false);

    const workflow = JSON.parse(await readFile(path.join(generatedDir, "workflow-status.json"), "utf8"));
    const packet = JSON.parse(await readFile(path.join(generatedDir, "review-packet", "review-packet.json"), "utf8"));
    const manifest = JSON.parse(await readFile(path.join(manualPackageDir, "manifest.json"), "utf8"));
    const contentPlan = JSON.parse(await readFile(path.join(generatedDir, "content-plan", "content-plan.json"), "utf8"));
    const brandLedger = JSON.parse(
      await readFile(path.join(generatedDir, "brand-claim-ledger", "brand-claim-ledger.json"), "utf8")
    );
    const productionPackets = JSON.parse(
      await readFile(path.join(generatedDir, "production-packets", "production-packets.json"), "utf8")
    );
    const productionQueue = JSON.parse(
      await readFile(path.join(generatedDir, "production-queue", "production-queue.json"), "utf8")
    );
    const contentCoverage = JSON.parse(
      await readFile(path.join(generatedDir, "content-coverage-audit", "content-coverage-audit.json"), "utf8")
    );
    const normalPostReview = JSON.parse(
      await readFile(path.join(generatedDir, "normal-post-review", "normal-post-review.json"), "utf8")
    );
    const paidAdVideoReview = JSON.parse(
      await readFile(path.join(generatedDir, "paid-ad-video-review", "paid-ad-video-review.json"), "utf8")
    );
    const reviewBoard = JSON.parse(await readFile(path.join(generatedDir, "review-board", "review-board.json"), "utf8"));
    const postizReadiness = JSON.parse(
      await readFile(path.join(generatedDir, "postiz-dry-run-readiness", "postiz-dry-run-readiness.json"), "utf8")
    );
    const postizInputKit = JSON.parse(
      await readFile(path.join(generatedDir, "postiz-input-kit", "postiz-input-kit.json"), "utf8")
    );
    const postizLocalValidation = JSON.parse(
      await readFile(path.join(generatedDir, "postiz-input-kit", "postiz-local-input-validation.json"), "utf8")
    );
    const completionAudit = JSON.parse(
      await readFile(path.join(generatedDir, "mvp-completion-audit", "mvp-completion-audit.json"), "utf8")
    );
    const postizCommandCenter = JSON.parse(
      await readFile(path.join(generatedDir, "postiz-command-center", "postiz-command-center.json"), "utf8")
    );
    const humanApprovalHandoff = JSON.parse(
      await readFile(path.join(generatedDir, "human-approval-handoff", "human-approval-handoff.json"), "utf8")
    );
    const commands = JSON.parse(
      await readFile(path.join(generatedDir, "review-decision-commands", "review-decision-commands.json"), "utf8")
    );
    const audit = JSON.parse(await readFile(path.join(generatedDir, "mvp-readiness-audit.json"), "utf8"));

    assert.equal(workflow.overall.status, "needs_review");
    assert.equal(packet.review.decisionRequired, true);
    assert.equal(manifest.packageType, "postiz_manual_upload_preview");
    assert.equal(manifest.assets.length, 3);
    assert.deepEqual(
      manifest.assets.map((asset) => asset.contentType),
      ["ugc_video", "paid_ad_video", "normal_post"]
    );
    for (const asset of manifest.assets) {
      assert.equal(await exists(path.join(manualPackageDir, asset.mediaFile)), true);
    }
    assert.equal(contentPlan.assets.length, 3);
    assert.equal(brandLedger.assets.length, 3);
    assert.equal(productionPackets.assets.length, 3);
    assert.equal(productionQueue.items.length, 3);
    assert.equal(productionQueue.summary.generatedAssets, 3);
    assert.equal(productionQueue.summary.packetReady, 0);
    assert.equal(productionQueue.items.find((item) => item.contentType === "paid_ad_video").state, "generated_needs_review");
    assert.equal(productionQueue.items.find((item) => item.contentType === "normal_post").state, "generated_needs_review");
    assert.equal(contentCoverage.summary.generatedContentTypes, 3);
    assert.equal(contentCoverage.summary.pendingProductionContentTypes, 0);
    assert.equal(normalPostReview.contentType, "normal_post");
    assert.equal(normalPostReview.publishAllowed, false);
    assert.equal(paidAdVideoReview.contentType, "paid_ad_video");
    assert.equal(paidAdVideoReview.publishAllowed, false);
    assert.equal(reviewBoard.items.length, 3);
    assert.equal(reviewBoard.summary.decisionRequired, 3);
    assert.equal(postizReadiness.status, "blocked_by_human_review");
    assert.equal(postizReadiness.networkCallsAllowed, false);
    assert.equal(postizInputKit.status, "needs_real_values");
    assert.equal(postizInputKit.summary.requiredMediaAssets, 3);
    assert.equal(postizInputKit.templates.uploadedMedia.length, 3);
    assert.equal(postizInputKit.networkCallsAllowed, false);
    assert.equal(postizLocalValidation.status, "blocked");
    assert.equal(postizLocalValidation.readyForDryRun, false);
    assert.equal(postizLocalValidation.summary.missingChecks, 5);
    assert.equal(postizLocalValidation.networkCallsAllowed, false);
    assert.equal(
      completionAudit.requirements.find((item) => item.id === "postiz_local_input_validation").status,
      "complete"
    );
    assert.equal(completionAudit.summary.totalRequirements, 14);
    assert.equal(completionAudit.summary.completeRequirements, 10);
    assert.equal(postizCommandCenter.status, "blocked_by_human_review");
    assert.equal(postizCommandCenter.commandOnly, true);
    assert.equal(postizCommandCenter.networkCallsAllowed, false);
    assert.equal(humanApprovalHandoff.status, "awaiting_human_decision");
    assert.equal(humanApprovalHandoff.commandOnly, true);
    assert.equal(humanApprovalHandoff.liveActionsEnabled, false);
    assert.equal(humanApprovalHandoff.summary.availableDecisionCommands, 3);
    assert.equal(commands.commandOnly, true);
    assert.equal(audit.overall.status, "blocked_by_human_review");
    assert.equal(audit.gates.contentPlan.status, "ready");
    assert.equal(audit.gates.brandClaimLedger.status, "ready");
    assert.equal(audit.gates.productionPackets.status, "ready");
    assert.equal(audit.gates.productionQueue.status, "ready");
    assert.equal(audit.gates.reviewBoard.status, "ready");
    assert.equal(audit.overall.mvpComplete, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("normal refresh prefers prepared local Postiz input files when they exist", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-refresh-"));
  try {
    const files = await seedPendingReview(tempDir);
    const generatedDir = path.join(tempDir, "generated");
    const paidAdVideoBuilds = [];
    const inputKitDir = path.join(generatedDir, "postiz-input-kit");
    await mkdir(inputKitDir, { recursive: true });
    await writeFile(
      path.join(inputKitDir, "integrations.local.json"),
      `${JSON.stringify(
        [
          { platform: "instagram", id: "TODO_POSTIZ_INSTAGRAM_INTEGRATION_ID", settings: { __type: "instagram" } },
          { platform: "facebook", id: "TODO_POSTIZ_FACEBOOK_INTEGRATION_ID", settings: { __type: "facebook" } },
          { platform: "tiktok", id: "TODO_POSTIZ_TIKTOK_INTEGRATION_ID", settings: { __type: "tiktok" } }
        ],
        null,
        2
      )}\n`
    );
    await writeFile(
      path.join(inputKitDir, "uploaded-media.local.json"),
      `${JSON.stringify(
        [
          {
            assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
            contentType: "ugc_video",
            id: "TODO_POSTIZ_UGC_VIDEO_UPLOADED_MEDIA_ID",
            path: "TODO_POSTIZ_UGC_VIDEO_UPLOADED_MEDIA_MP4_PATH"
          }
        ],
        null,
        2
      )}\n`
    );

    await refreshCurrentReviewState({
      bundlePath: files.bundlePath,
      briefPath: files.briefPath,
      productPath: files.productPath,
      generatedDir,
      manualPackageDir: path.join(tempDir, "manual-package"),
      contactSheetPath: files.contactSheetPath,
      visualReviewPath: files.visualReviewPath,
      publicOutDir: path.join(tempDir, "public-review"),
      publicUrlBase: "/social-studio/current/review",
      generatedAt: "2026-06-10T16:30:00.000Z",
      paidAdVideoBuilder: fakePaidAdVideoBuilder(paidAdVideoBuilds)
    });

    const postizInputKit = JSON.parse(
      await readFile(path.join(inputKitDir, "postiz-input-kit.json"), "utf8")
    );
    const postizLocalValidation = JSON.parse(
      await readFile(path.join(inputKitDir, "postiz-local-input-validation.json"), "utf8")
    );
    const postizReadiness = JSON.parse(
      await readFile(path.join(generatedDir, "postiz-dry-run-readiness", "postiz-dry-run-readiness.json"), "utf8")
    );

    assert.equal(postizInputKit.files.integrationsLocal, "integrations.local.json");
    assert.equal(postizInputKit.files.uploadedMediaLocal, "uploaded-media.local.json");
    assert.match(postizInputKit.nextAction, /Edit integrations\.local\.json and uploaded-media\.local\.json/i);
    assert.equal(postizInputKit.summary.requiredMediaAssets, 3);
    assert.equal(postizLocalValidation.status, "blocked");
    assert.equal(postizLocalValidation.summary.missingChecks, 5);
    assert.equal(postizReadiness.summary.uploadedMediaReady, 0);
    assert.equal(paidAdVideoBuilds.length, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects refresh when the bundle is no longer in needs-review state", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-refresh-"));
  try {
    const bundle = pendingBundle(tempDir);
    bundle.reviewStatus.status = "approved";
    bundle.postizHandoff.status = "draft_upload_ready";
    bundle.postizHandoff.review.approvedBy = "Andre";
    bundle.postizHandoff.review.approvedAt = "2026-06-10T12:00:00.000Z";
    const files = await seedPendingReview(tempDir, bundle);

    await assert.rejects(
      () =>
        refreshCurrentReviewState({
          bundlePath: files.bundlePath,
          generatedDir: path.join(tempDir, "generated"),
          manualPackageDir: path.join(tempDir, "manual-package"),
          contactSheetPath: files.contactSheetPath,
          publicOutDir: path.join(tempDir, "public-review")
        }),
      /needs_review/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
