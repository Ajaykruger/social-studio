import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runReviewDecisionCycle } from "../tools/run-review-decision-cycle.mjs";

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

async function seedBundle(tempDir) {
  const bundle = pendingBundle(tempDir);
  await writeFile(bundle.postizHandoff.media.localPath, "fake video");
  await writeFile(bundle.postizHandoff.media.thumbnailPath, "fake thumb");
  const input = path.join(tempDir, "draft-bundle.json");
  await writeFile(input, `${JSON.stringify(bundle, null, 2)}\n`);
  return input;
}

async function seedAllAssetReviewBoard(tempDir) {
  const paidAdPath = path.join(tempDir, "paid-ad-video-02.mp4");
  const normalPostPath = path.join(tempDir, "normal-post-03.svg");
  await writeFile(paidAdPath, "fake paid ad video");
  await writeFile(normalPostPath, "<svg />");

  const reviewBoard = {
    packageType: "social_studio_review_board",
    status: "needs_review",
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
        media: {
          localPath: path.join(tempDir, "final-1.mp4"),
          videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4",
          contactSheetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/contact-sheet.jpg",
          imageUrl: ""
        },
        postiz: { publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        label: "Paid ad video",
        contentType: "paid_ad_video",
        reviewAction: "review_decision_required",
        media: {
          localPath: paidAdPath,
          videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4",
          imageUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02-storyboard.svg"
        },
        postiz: { publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        label: "Normal post",
        contentType: "normal_post",
        reviewAction: "review_decision_required",
        media: {
          localPath: normalPostPath,
          videoUrl: "",
          imageUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg"
        },
        postiz: { publishAllowed: false }
      }
    ]
  };
  const reviewBoardPath = path.join(tempDir, "review-board.json");
  await writeFile(reviewBoardPath, `${JSON.stringify(reviewBoard, null, 2)}\n`);
  return reviewBoardPath;
}

test("approve cycle writes approved bundle, draft-ready manual package, and updated status", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-cycle-"));
  try {
    const input = await seedBundle(tempDir);
    const reviewBoardPath = await seedAllAssetReviewBoard(tempDir);
    const outDir = path.join(tempDir, "generated");
    const manualPackageDir = path.join(tempDir, "approved-manual-package");

    const result = await runReviewDecisionCycle({
      input,
      outDir,
      manualPackageDir,
      reviewBoardPath,
      decision: "approve",
      reviewer: "Andre",
      evidence: fullApprovalEvidence,
      approvedAt: "2026-06-10T12:00:00.000Z",
      notes: "Approved for Postiz draft upload only."
    });

    assert.equal(result.status, "approved_waiting_postiz_dry_run");
    assert.equal(result.bundlePath, path.join(outDir, "approved-bundle.json"));

    const approvedBundle = JSON.parse(await readFile(result.bundlePath, "utf8"));
    assert.equal(approvedBundle.reviewStatus.status, "approved");
    assert.equal(approvedBundle.postizHandoff.status, "draft_upload_ready");
    assert.equal(approvedBundle.reviewStatus.approval.evidenceSummary.status, "covered");
    assert.deepEqual(
      approvedBundle.reviewStatus.approval.evidenceSummary.gates.map((gate) => gate.label),
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
      approvedBundle.reviewStatus.approval.evidenceSummary.gates.map((gate) => gate.status),
      ["covered", "covered", "covered", "covered", "covered", "covered"]
    );
    assert.equal(approvedBundle.reviewStatus.approval.scope.allowsSchedulingOrPublishing, false);

    const manifest = JSON.parse(await readFile(path.join(manualPackageDir, "manifest.json"), "utf8"));
    assert.equal(manifest.packageType, "postiz_manual_draft_ready");
    assert.equal(manifest.postiz.status, "draft_upload_ready");

    const status = JSON.parse(await readFile(path.join(outDir, "workflow-status.json"), "utf8"));
    assert.equal(status.overall.status, "approved_waiting_postiz_dry_run");
    assert.equal(status.readiness.canCreatePostizDraft, false);
    assert.equal(status.readiness.canScheduleOrPublish, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approve cycle rejects approval when review board assets are missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-cycle-missing-board-"));
  try {
    const input = await seedBundle(tempDir);

    await assert.rejects(
      () =>
        runReviewDecisionCycle({
          input,
          outDir: path.join(tempDir, "generated"),
          manualPackageDir: path.join(tempDir, "approved-manual-package"),
          decision: "approve",
          reviewer: "Andre",
          evidence: fullApprovalEvidence,
          approvedAt: "2026-06-10T12:00:00.000Z",
          notes: "Approved for Postiz draft upload only."
        }),
      /review board assets/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approve cycle records every generated review asset from the review board", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-cycle-assets-"));
  try {
    const input = await seedBundle(tempDir);
    const reviewBoardPath = await seedAllAssetReviewBoard(tempDir);
    const outDir = path.join(tempDir, "generated");
    const manualPackageDir = path.join(tempDir, "approved-manual-package");

    const result = await runReviewDecisionCycle({
      input,
      outDir,
      manualPackageDir,
      reviewBoardPath,
      decision: "approve",
      reviewer: "Andre",
      evidence: fullApprovalEvidence,
      approvedAt: "2026-06-10T12:00:00.000Z",
      notes: "Approved for Postiz draft upload only."
    });

    const approvedBundle = JSON.parse(await readFile(result.bundlePath, "utf8"));
    assert.equal(approvedBundle.postizHandoff.reviewAssets.length, 3);
    assert.deepEqual(
      approvedBundle.postizHandoff.reviewAssets.map((asset) => asset.contentType),
      ["ugc_video", "paid_ad_video", "normal_post"]
    );

    const manifest = JSON.parse(await readFile(path.join(manualPackageDir, "manifest.json"), "utf8"));
    assert.equal(manifest.assets.length, 3);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("needs revision cycle keeps Postiz blocked and does not create approved package", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-cycle-"));
  try {
    const input = await seedBundle(tempDir);
    const outDir = path.join(tempDir, "generated");
    const manualPackageDir = path.join(tempDir, "approved-manual-package");

    const result = await runReviewDecisionCycle({
      input,
      outDir,
      manualPackageDir,
      decision: "needs_revision",
      reviewer: "Andre",
      evidence: "Reviewed MP4; too static for paid UGC.",
      approvedAt: "2026-06-10T12:00:00.000Z",
      notes: "Needs more creator-style footage."
    });

    assert.equal(result.status, "needs_revision");
    assert.equal(result.bundlePath, path.join(outDir, "revision-bundle.json"));
    assert.equal(result.manualPackagePath, "");

    const revisionBundle = JSON.parse(await readFile(result.bundlePath, "utf8"));
    assert.equal(revisionBundle.reviewStatus.status, "needs_revision");
    assert.equal(revisionBundle.postizHandoff.status, "needs_review");

    const status = JSON.parse(await readFile(path.join(outDir, "workflow-status.json"), "utf8"));
    assert.equal(status.overall.status, "needs_revision");
    assert.equal(status.readiness.canCreatePostizDraft, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("cycle rejects fake pending reviewer approval", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-cycle-"));
  try {
    const input = await seedBundle(tempDir);

    await assert.rejects(
      () =>
        runReviewDecisionCycle({
          input,
          outDir: path.join(tempDir, "generated"),
          decision: "approve",
          reviewer: "pending-human-review",
          evidence: "Reviewed MP4.",
          approvedAt: "2026-06-10T12:00:00.000Z"
        }),
      /real human reviewer/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
