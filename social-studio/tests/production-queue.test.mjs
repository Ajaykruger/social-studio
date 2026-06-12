import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildProductionQueue,
  buildProductionQueueFromFiles
} from "../tools/build-production-queue.mjs";

function productionPackets() {
  return {
    packageType: "social_studio_production_packets",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    safety: {
      noLivePosting: true,
      networkCallsAllowed: false,
      postizBlockedUntilApproval: true
    },
    assets: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        contentType: "ugc_video",
        label: "UGC video",
        packetType: "moneyprinter_video_request",
        generator: "MoneyPrinterTurbo",
        execution: { networkCallsAllowed: false },
        review: { status: "needs_review", required: true },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        contentType: "paid_ad_video",
        label: "Paid ad video",
        packetType: "moneyprinter_video_request",
        generator: "MoneyPrinterTurbo",
        execution: { networkCallsAllowed: false },
        review: { status: "needs_review", required: true },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        contentType: "normal_post",
        label: "Normal post",
        packetType: "static_post_copy_brief",
        generator: "Manual or Canva-style post builder",
        execution: { networkCallsAllowed: false },
        review: { status: "needs_review", required: true },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
  };
}

function draftBundle(mediaPath) {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    reviewStatus: {
      status: "needs_review",
      reviewer: "pending-human-review"
    },
    postizHandoff: {
      status: "needs_review",
      media: {
        localPath: mediaPath,
        mediaType: "video",
        aspectRatio: "9:16"
      },
      review: {
        approvedBy: "pending-human-review",
        approvedAt: "",
        notLiveConfirmed: true
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

function staticPostReviewAsset() {
  return {
    packageType: "social_studio_static_post_review_asset",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
    contentType: "normal_post",
    status: "needs_review",
    networkCallsAllowed: false,
    publishAllowed: false,
    postizStatus: "blocked_until_approved",
    media: {
      mediaType: "image",
      mimeType: "image/svg+xml",
      imageUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg"
    }
  };
}

function paidAdVideoReviewAsset() {
  return {
    packageType: "social_studio_paid_ad_video_review_asset",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
    contentType: "paid_ad_video",
    status: "needs_review",
    networkCallsAllowed: false,
    publishAllowed: false,
    postizStatus: "blocked_until_approved",
    media: {
      mediaType: "video",
      mimeType: "video/mp4",
      videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4",
      storyboardUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02-storyboard.svg"
    }
  };
}

test("builds a review-first production queue with current generated UGC draft mapped to review", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-queue-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    await writeFile(mediaPath, "fake video");
    const queue = await buildProductionQueue({
      productionPackets: productionPackets(),
      draftBundle: draftBundle(mediaPath),
      generatedAt: "2026-06-10T19:00:00.000Z"
    });

    assert.equal(queue.packageType, "social_studio_production_queue");
    assert.equal(queue.status, "needs_review");
    assert.equal(queue.safety.noLivePosting, true);
    assert.equal(queue.safety.postizBlockedUntilApproval, true);
    assert.equal(queue.summary.totalAssets, 3);
    assert.equal(queue.summary.generatedAssets, 1);
    assert.equal(queue.summary.needsReview, 1);
    assert.equal(queue.summary.packetReady, 2);
    assert.equal(queue.summary.publishAllowed, 0);

    const ugc = queue.items.find((item) => item.contentType === "ugc_video");
    assert.equal(ugc.state, "generated_needs_review");
    assert.equal(ugc.generated.currentDraftAssetId, "cc-rubber-base-demo-2026-06-10-draft-001");
    assert.equal(ugc.generated.mediaPresent, true);
    assert.equal(ugc.review.status, "needs_review");
    assert.equal(ugc.postiz.publishAllowed, false);

    const paid = queue.items.find((item) => item.contentType === "paid_ad_video");
    const post = queue.items.find((item) => item.contentType === "normal_post");
    assert.equal(paid.state, "packet_ready");
    assert.equal(post.state, "packet_ready");
    assert.equal(JSON.stringify(queue.uiSummary).includes(mediaPath), false);
    assert.equal(JSON.stringify(queue.uiSummary).includes("C:\\"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("maps a review-safe UGC draft bundle without task metadata when local media exists", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-queue-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    await writeFile(mediaPath, "fake video");
    const bundle = draftBundle(mediaPath);
    delete bundle.moneyprinterTask;

    const queue = await buildProductionQueue({
      productionPackets: productionPackets(),
      draftBundle: bundle,
      generatedAt: "2026-06-11T16:35:00.000Z"
    });

    const ugc = queue.items.find((item) => item.contentType === "ugc_video");
    assert.equal(queue.summary.generatedAssets, 1);
    assert.equal(queue.summary.packetReady, 2);
    assert.equal(ugc.state, "generated_needs_review");
    assert.equal(ugc.generated.mediaPresent, true);
    assert.equal(ugc.generated.currentDraftAssetId, "cc-rubber-base-demo-2026-06-10-draft-001");
    assert.equal(ugc.postiz.publishAllowed, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("maps a local static normal-post review asset into the generated review queue", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-queue-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    await writeFile(mediaPath, "fake video");
    const queue = await buildProductionQueue({
      productionPackets: productionPackets(),
      draftBundle: draftBundle(mediaPath),
      staticPostReviewAsset: staticPostReviewAsset(),
      generatedAt: "2026-06-10T23:30:00.000Z"
    });

    assert.equal(queue.summary.totalAssets, 3);
    assert.equal(queue.summary.generatedAssets, 2);
    assert.equal(queue.summary.needsReview, 2);
    assert.equal(queue.summary.packetReady, 1);
    assert.equal(queue.summary.publishAllowed, 0);

    const paid = queue.items.find((item) => item.contentType === "paid_ad_video");
    const post = queue.items.find((item) => item.contentType === "normal_post");
    assert.equal(paid.state, "packet_ready");
    assert.equal(post.state, "generated_needs_review");
    assert.equal(post.generated.reviewAssetId, "cc-rubber-base-demo-2026-06-10-normal-post-03");
    assert.equal(post.generated.mediaPresent, true);
    assert.equal(post.generated.mediaType, "image");
    assert.equal(post.generated.imageUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg");
    assert.equal(post.postiz.publishAllowed, false);
    assert.equal(JSON.stringify(queue.uiSummary).includes("C:\\"), false);
    assert.equal(JSON.stringify(queue.uiSummary).includes("localPath"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("maps local paid-ad and normal-post review assets into full generated review coverage", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-queue-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    await writeFile(mediaPath, "fake video");
    const queue = await buildProductionQueue({
      productionPackets: productionPackets(),
      draftBundle: draftBundle(mediaPath),
      staticPostReviewAsset: staticPostReviewAsset(),
      paidAdVideoReviewAsset: paidAdVideoReviewAsset(),
      generatedAt: "2026-06-11T00:10:00.000Z"
    });

    assert.equal(queue.summary.totalAssets, 3);
    assert.equal(queue.summary.generatedAssets, 3);
    assert.equal(queue.summary.needsReview, 3);
    assert.equal(queue.summary.packetReady, 0);
    assert.equal(queue.summary.publishAllowed, 0);

    const paid = queue.items.find((item) => item.contentType === "paid_ad_video");
    assert.equal(paid.state, "generated_needs_review");
    assert.equal(paid.generated.reviewAssetId, "cc-rubber-base-demo-2026-06-10-paid-ad-video-02");
    assert.equal(paid.generated.mediaPresent, true);
    assert.equal(paid.generated.mediaType, "video");
    assert.equal(paid.generated.videoUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4");
    assert.equal(
      paid.generated.storyboardUrl,
      "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02-storyboard.svg"
    );
    assert.equal(paid.postiz.publishAllowed, false);
    assert.equal(JSON.stringify(queue.uiSummary).includes("C:\\"), false);
    assert.equal(JSON.stringify(queue.uiSummary).includes("localPath"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects queues when a packet allows publishing", async () => {
  const packets = productionPackets();
  packets.assets[1].postiz.publishAllowed = true;

  await assert.rejects(
    () =>
      buildProductionQueue({
        productionPackets: packets,
        draftBundle: draftBundle("")
      }),
    /review-first/i
  );
});

test("writes production queue JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-queue-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    const packetsPath = path.join(tempDir, "production-packets.json");
    const draftPath = path.join(tempDir, "draft-bundle.json");
    const outDir = path.join(tempDir, "queue");
    await writeFile(mediaPath, "fake video");
    await writeFile(packetsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);
    await writeFile(draftPath, `${JSON.stringify(draftBundle(mediaPath), null, 2)}\n`);

    const result = await buildProductionQueueFromFiles({
      productionPacketsPath: packetsPath,
      draftBundlePath: draftPath,
      outDir,
      generatedAt: "2026-06-10T19:00:00.000Z"
    });

    assert.equal(result.status, "needs_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "production-queue.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "production-queue.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "production-queue.md"), "utf8");
    assert.equal(saved.summary.totalAssets, 3);
    assert.equal(ui.items.length, 3);
    assert.equal(ui.items[0].state, "generated_needs_review");
    assert.match(markdown, /generated_needs_review/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("reads a static normal-post review asset from files when provided", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-queue-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    const packetsPath = path.join(tempDir, "production-packets.json");
    const draftPath = path.join(tempDir, "draft-bundle.json");
    const staticPostPath = path.join(tempDir, "normal-post-review.json");
    const outDir = path.join(tempDir, "queue");
    await writeFile(mediaPath, "fake video");
    await writeFile(packetsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);
    await writeFile(draftPath, `${JSON.stringify(draftBundle(mediaPath), null, 2)}\n`);
    await writeFile(staticPostPath, `${JSON.stringify(staticPostReviewAsset(), null, 2)}\n`);

    const result = await buildProductionQueueFromFiles({
      productionPacketsPath: packetsPath,
      draftBundlePath: draftPath,
      staticPostReviewAssetPath: staticPostPath,
      outDir,
      generatedAt: "2026-06-10T23:30:00.000Z"
    });

    const ui = JSON.parse(await readFile(path.join(outDir, "production-queue.ui.json"), "utf8"));
    assert.equal(result.status, "needs_review");
    assert.equal(ui.summary.generatedAssets, 2);
    assert.equal(ui.items.find((item) => item.contentType === "normal_post").mediaPresent, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("reads paid-ad and static post review assets from files when provided", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-queue-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    const packetsPath = path.join(tempDir, "production-packets.json");
    const draftPath = path.join(tempDir, "draft-bundle.json");
    const staticPostPath = path.join(tempDir, "normal-post-review.json");
    const paidAdPath = path.join(tempDir, "paid-ad-video-review.json");
    const outDir = path.join(tempDir, "queue");
    await writeFile(mediaPath, "fake video");
    await writeFile(packetsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);
    await writeFile(draftPath, `${JSON.stringify(draftBundle(mediaPath), null, 2)}\n`);
    await writeFile(staticPostPath, `${JSON.stringify(staticPostReviewAsset(), null, 2)}\n`);
    await writeFile(paidAdPath, `${JSON.stringify(paidAdVideoReviewAsset(), null, 2)}\n`);

    const result = await buildProductionQueueFromFiles({
      productionPacketsPath: packetsPath,
      draftBundlePath: draftPath,
      staticPostReviewAssetPath: staticPostPath,
      paidAdVideoReviewAssetPath: paidAdPath,
      outDir,
      generatedAt: "2026-06-11T00:10:00.000Z"
    });

    const ui = JSON.parse(await readFile(path.join(outDir, "production-queue.ui.json"), "utf8"));
    assert.equal(result.status, "needs_review");
    assert.equal(ui.summary.generatedAssets, 3);
    assert.equal(ui.summary.packetReady, 0);
    assert.equal(ui.items.find((item) => item.contentType === "paid_ad_video").mediaPresent, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
