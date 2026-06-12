import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildStaticPostReviewAsset,
  buildStaticPostReviewAssetFromFiles
} from "../tools/build-static-post-review-asset.mjs";

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
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        contentType: "normal_post",
        label: "Normal post",
        packetType: "static_post_copy_brief",
        generator: "Manual or Canva-style post builder",
        execution: {
          mode: "manual_design_then_review",
          networkCallsAllowed: false
        },
        staticPost: {
          captionDraft: "French Rubber Base helps with smooth base. Shop Crystal Clawz French Rubber Base.",
          designBrief: "Normal post: show French Rubber Base helping nail technicians with uneven base work.",
          approvedBenefits: [
            "smooth base",
            "cleaner colour application",
            "salon-ready base"
          ],
          blockedClaims: [
            "guaranteed perfect results",
            "invented testimonials"
          ],
          cta: "Shop Crystal Clawz French Rubber Base"
        },
        review: {
          required: true,
          status: "needs_review"
        },
        postiz: {
          status: "blocked_until_approved",
          publishAllowed: false
        }
      }
    ]
  };
}

test("builds a local static normal-post review asset without network or publish actions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-static-post-"));
  try {
    const publicOutDir = path.join(tempDir, "public");
    const asset = await buildStaticPostReviewAsset({
      productionPackets: productionPackets(),
      publicOutDir,
      publicUrlBase: "/social-studio/cc-rubber-base-demo-2026-06-10/review",
      generatedAt: "2026-06-10T23:00:00.000Z"
    });

    assert.equal(asset.packageType, "social_studio_static_post_review_asset");
    assert.equal(asset.status, "needs_review");
    assert.equal(asset.contentType, "normal_post");
    assert.equal(asset.networkCallsAllowed, false);
    assert.equal(asset.publishAllowed, false);
    assert.equal(asset.media.mediaType, "image");
    assert.equal(asset.media.imageUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg");
    assert.match(asset.caption, /French Rubber Base/);
    assert.match(asset.nextAction, /Review the static post image/i);
    assert.doesNotMatch(JSON.stringify(asset.uiSummary), /C:\\|localPath|TODO|replace-with|placeholder/i);

    const imageInfo = await stat(path.join(publicOutDir, "normal-post-03.svg"));
    assert.ok(imageInfo.size > 0);
    const svg = await readFile(path.join(publicOutDir, "normal-post-03.svg"), "utf8");
    assert.match(svg, /Crystal Clawz/);
    assert.match(svg, /smooth base/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects static post review assets if the normal post packet allows publishing", async () => {
  const packets = productionPackets();
  packets.assets[0].postiz.publishAllowed = true;

  await assert.rejects(
    () =>
      buildStaticPostReviewAsset({
        productionPackets: packets,
        publicOutDir: "unused"
      }),
    /review-first/i
  );
});

test("writes static post review asset JSON, UI JSON, Markdown, and public SVG from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-static-post-"));
  try {
    const packetsPath = path.join(tempDir, "production-packets.json");
    const outDir = path.join(tempDir, "normal-post-review");
    const publicOutDir = path.join(tempDir, "public");
    await writeFile(packetsPath, `${JSON.stringify(productionPackets(), null, 2)}\n`);

    const result = await buildStaticPostReviewAssetFromFiles({
      productionPacketsPath: packetsPath,
      outDir,
      publicOutDir,
      publicUrlBase: "/social-studio/cc-rubber-base-demo-2026-06-10/review",
      generatedAt: "2026-06-10T23:00:00.000Z"
    });

    assert.equal(result.status, "needs_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "normal-post-review.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "normal-post-review.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "normal-post-review.md"), "utf8");
    assert.equal(saved.contentType, "normal_post");
    assert.equal(ui.media.imageUrl, "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg");
    assert.match(markdown, /Static Normal Post Review Asset/);
    await stat(path.join(publicOutDir, "normal-post-03.svg"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
