import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  assertManualDraftHandoff,
  buildManualPostizPackage
} from "../handoff/postiz/build-manual-package.mjs";
import { applyReviewDecision } from "../tools/record-review-decision.mjs";

const fullApprovalEvidence = [
  "UGC video evidence reviewed",
  "Paid ad video evidence reviewed",
  "Normal post evidence reviewed",
  "Artifact freshness checked",
  "Rollback and not-live proof reviewed",
  "Approved for Postiz draft upload only"
].join("; ");

function safeBundle(baseDir) {
  const media = path.join(baseDir, "draft.mp4");
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
      handoffMode: "manual_upload",
      platforms: ["instagram", "facebook", "tiktok"],
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
        notes: "Preview package only."
      }
    }
  };
}

function addReviewAssets(bundle, baseDir) {
  bundle.postizHandoff.reviewAssets = [
    {
      assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
      label: "UGC video",
      contentType: "ugc_video",
      mediaType: "video",
      localPath: bundle.postizHandoff.media.localPath,
      assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
      label: "Paid ad video",
      contentType: "paid_ad_video",
      mediaType: "video",
      localPath: path.join(baseDir, "paid-ad-video-02.mp4"),
      assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
      label: "Normal post",
      contentType: "normal_post",
      mediaType: "image",
      localPath: path.join(baseDir, "normal-post-03.svg"),
      assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg"
    }
  ];
  return bundle;
}

test("rejects non-manual or scheduled handoffs", () => {
  const bundle = safeBundle("C:\\temp");
  bundle.postizHandoff.status = "handed_to_postiz";

  assert.throws(
    () => assertManualDraftHandoff(bundle),
    /needs_review or draft_upload_ready/i
  );

  bundle.postizHandoff.status = "needs_review";
  bundle.postizHandoff.handoffMode = "postiz_api_draft";
  assert.throws(
    () => assertManualDraftHandoff(bundle),
    /manual_upload/i
  );
});

test("builds manual package with media, caption, hashtags, and checklist", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-"));
  try {
    const bundle = safeBundle(tempDir);
    await writeFile(bundle.postizHandoff.media.localPath, "fake video");
    await writeFile(bundle.postizHandoff.media.thumbnailPath, "fake image");

    const outDir = path.join(tempDir, "package");
    const result = await buildManualPostizPackage({ bundle, outDir });

    assert.match(result.packageDir, /package$/);
    assert.equal(result.status, "needs_review");

    const manifest = JSON.parse(await readFile(path.join(outDir, "manifest.json"), "utf8"));
    assert.equal(manifest.postiz.status, "needs_review");
    assert.equal(manifest.postiz.handoffMode, "manual_upload");
    assert.equal(manifest.review.notLiveConfirmed, true);

    const caption = await readFile(path.join(outDir, "caption.txt"), "utf8");
    assert.match(caption, /Smooth base/);

    const checklist = await readFile(path.join(outDir, "review-checklist.md"), "utf8");
    assert.match(checklist, /Do not upload to Postiz until/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("builds approved manual package with every generated review asset", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-all-assets-postiz-"));
  try {
    const pending = addReviewAssets(safeBundle(tempDir), tempDir);
    await writeFile(pending.postizHandoff.media.localPath, "fake ugc video");
    await writeFile(pending.postizHandoff.media.thumbnailPath, "fake thumb");
    await writeFile(path.join(tempDir, "paid-ad-video-02.mp4"), "fake paid ad video");
    await writeFile(path.join(tempDir, "normal-post-03.svg"), "<svg />");

    const approved = applyReviewDecision(pending, {
      decision: "approve",
      reviewer: "Andre",
      evidence: fullApprovalEvidence,
      approvedAt: "2026-06-10T12:00:00.000Z",
      notes: "Approved for manual Postiz draft upload only."
    });
    const outDir = path.join(tempDir, "approved-package");
    await buildManualPostizPackage({ bundle: approved, outDir });

    const manifest = JSON.parse(await readFile(path.join(outDir, "manifest.json"), "utf8"));
    assert.equal(manifest.assets.length, 3);
    assert.deepEqual(
      manifest.assets.map((asset) => asset.contentType),
      ["ugc_video", "paid_ad_video", "normal_post"]
    );
    for (const asset of manifest.assets) {
      assert.match(await readFile(path.join(outDir, asset.mediaFile), "utf8"), /fake|svg/i);
    }

    const checklist = await readFile(path.join(outDir, "review-checklist.md"), "utf8");
    assert.match(checklist, /UGC video.*media\/draft\.mp4/i);
    assert.match(checklist, /Paid ad video.*media\/paid-ad-video-02\.mp4/i);
    assert.match(checklist, /Normal post.*media\/normal-post-03\.svg/i);
    assert.doesNotMatch(checklist, /Upload the MP4 to Postiz/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("builds approved manual package only with real approval evidence", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-approved-postiz-"));
  try {
    const pending = safeBundle(tempDir);
    await writeFile(pending.postizHandoff.media.localPath, "fake video");
    await writeFile(pending.postizHandoff.media.thumbnailPath, "fake image");

    const approved = applyReviewDecision(pending, {
      decision: "approve",
      reviewer: "Andre",
      evidence: fullApprovalEvidence,
      approvedAt: "2026-06-10T12:00:00.000Z",
      notes: "Approved for manual Postiz draft upload only."
    });
    const outDir = path.join(tempDir, "approved-package");
    const result = await buildManualPostizPackage({ bundle: approved, outDir });

    assert.equal(result.status, "draft_upload_ready");
    assert.equal(result.packageType, "postiz_manual_draft_ready");

    const manifest = JSON.parse(await readFile(path.join(outDir, "manifest.json"), "utf8"));
    assert.equal(manifest.packageType, "postiz_manual_draft_ready");
    assert.equal(manifest.postiz.status, "draft_upload_ready");
    assert.equal(manifest.review.approvedBy, "Andre");
    assert.equal(manifest.review.approvalEvidenceSummary.status, "covered");
    assert.equal(manifest.review.approvalEvidenceSummary.summary.coveredGates, 6);
    assert.equal(manifest.review.approvalScope.approvedFor, "postiz_draft_upload_only");
    assert.equal(manifest.review.approvalScope.allowsSchedulingOrPublishing, false);

    const checklist = await readFile(path.join(outDir, "review-checklist.md"), "utf8");
    assert.match(checklist, /Keep it as a draft in Postiz/i);
    assert.match(checklist, /Do not publish/i);
    assert.match(checklist, /Evidence gates: 6\/6 covered/i);
    assert.match(checklist, /Approval scope: Postiz draft upload only/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
