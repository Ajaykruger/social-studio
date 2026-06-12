import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildPaidAdVideoReviewAsset,
  buildPaidAdVideoReviewAssetFromFiles
} from "../tools/build-paid-ad-video-review-asset.mjs";

function productionPackets() {
  return {
    packageType: "social_studio_production_packets",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    campaignName: "French Rubber Base Draft Demo",
    status: "needs_review",
    safety: {
      noLivePosting: true,
      networkCallsAllowed: false,
      postizBlockedUntilApproval: true,
      publishAllowed: false
    },
    assets: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        contentType: "paid_ad_video",
        label: "Paid ad video",
        packetType: "moneyprinter_video_request",
        generator: "MoneyPrinterTurbo",
        execution: {
          mode: "local_manual_submit_after_review",
          apiBasePolicy: "localhost_only",
          networkCallsAllowed: false,
          submitted: false
        },
        moneyprinterRequest: {
          video_subject: "French Rubber Base - Paid ad video",
          video_script_prompt:
            "Paid ad video: show French Rubber Base helping nail technicians using the approved benefit smooth base. CTA: Shop Crystal Clawz French Rubber Base.",
          video_aspect: "9:16",
          video_source: "local"
        },
        review: {
          required: true,
          status: "needs_review",
          reviewer: "pending-human-review"
        },
        postiz: {
          status: "blocked_until_approved",
          publishAllowed: false
        }
      }
    ]
  };
}

async function fakeVideoRunner({ videoPath }) {
  await writeFile(videoPath, "fake paid ad video");
}

test("builds a local paid-ad video review asset without network or publish actions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-paid-ad-"));
  try {
    const publicOutDir = path.join(tempDir, "public");
    const asset = await buildPaidAdVideoReviewAsset({
      productionPackets: productionPackets(),
      publicOutDir,
      publicUrlBase: "/social-studio/cc-rubber-base-demo-2026-06-10/review",
      generatedAt: "2026-06-11T00:00:00.000Z",
      runVideoBuilder: fakeVideoRunner
    });

    assert.equal(asset.packageType, "social_studio_paid_ad_video_review_asset");
    assert.equal(asset.status, "needs_review");
    assert.equal(asset.contentType, "paid_ad_video");
    assert.equal(asset.networkCallsAllowed, false);
    assert.equal(asset.publishAllowed, false);
    assert.equal(asset.postizStatus, "blocked_until_approved");
    assert.equal(asset.media.mediaType, "video");
    assert.equal(asset.media.videoUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4");
    assert.equal(
      asset.media.storyboardUrl,
      "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02-storyboard.svg"
    );
    assert.match(asset.nextAction, /Review the paid ad video draft/i);
    assert.doesNotMatch(JSON.stringify(asset.uiSummary), /C:\\|localPath|TODO|replace-with|placeholder/i);

    const videoInfo = await stat(path.join(publicOutDir, "paid-ad-video-02.mp4"));
    assert.ok(videoInfo.size > 0);
    const storyboard = await readFile(path.join(publicOutDir, "paid-ad-video-02-storyboard.svg"), "utf8");
    assert.match(storyboard, /French Rubber Base/);
    assert.match(storyboard, /Paid ad draft/);
    assert.match(storyboard, /smooth base/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects paid-ad video review assets if the packet allows publishing", async () => {
  const packets = productionPackets();
  packets.assets[0].postiz.publishAllowed = true;

  await assert.rejects(
    () =>
      buildPaidAdVideoReviewAsset({
        productionPackets: packets,
        publicOutDir: "unused",
        runVideoBuilder: fakeVideoRunner
      }),
    /review-first/i
  );
});

test("writes paid-ad review asset JSON, UI JSON, Markdown, MP4, and storyboard from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-paid-ad-"));
  try {
    const packetsPath = path.join(tempDir, "production-packets.json");
    const outDir = path.join(tempDir, "paid-ad-video-review");
    const publicOutDir = path.join(tempDir, "public");
    await writeFile(packetsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);

    const result = await buildPaidAdVideoReviewAssetFromFiles({
      productionPacketsPath: packetsPath,
      outDir,
      publicOutDir,
      publicUrlBase: "/social-studio/cc-rubber-base-demo-2026-06-10/review",
      generatedAt: "2026-06-11T00:00:00.000Z",
      runVideoBuilder: fakeVideoRunner
    });

    assert.equal(result.status, "needs_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "paid-ad-video-review.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "paid-ad-video-review.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "paid-ad-video-review.md"), "utf8");
    assert.equal(saved.contentType, "paid_ad_video");
    assert.equal(ui.media.videoUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4");
    assert.match(markdown, /Paid Ad Video Review Asset/);
    await stat(path.join(publicOutDir, "paid-ad-video-02.mp4"));
    await stat(path.join(publicOutDir, "paid-ad-video-02-storyboard.svg"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
