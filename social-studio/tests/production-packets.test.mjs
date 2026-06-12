import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildProductionPackets,
  buildProductionPacketsFromFiles
} from "../tools/build-production-packets.mjs";

function contentPlan() {
  return {
    packageType: "social_studio_content_plan",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    campaignName: "French Rubber Base Draft Demo",
    status: "needs_review",
    product: {
      name: "French Rubber Base",
      category: "Rubber Base Gel",
      url: "https://crystalclawz.co.za/collections/french-rubber-base"
    },
    audience: "South African nail technicians",
    cta: "Shop Crystal Clawz French Rubber Base",
    safety: {
      noLivePosting: true,
      humanReviewRequired: true,
      postizDraftOnlyAfterApproval: true,
      secretsRequired: false
    },
    assets: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        contentType: "ugc_video",
        label: "UGC video",
        platforms: ["instagram", "facebook", "tiktok"],
        generator: { primary: "MoneyPrinterTurbo", moneyPrinterTurboAllowed: true },
        output: { kind: "vertical_video", aspectRatios: ["9:16"], postizFormat: "reel_or_short" },
        angle: "UGC video: show French Rubber Base helping nail technicians with uneven base work.",
        claims: {
          approvedBenefits: ["smooth base", "cleaner colour application"],
          blockedClaims: ["medical or health claims", "guaranteed perfect results"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        review: { required: true, status: "needs_review", reviewer: "pending-human-review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        contentType: "paid_ad_video",
        label: "Paid ad video",
        platforms: ["instagram", "facebook", "tiktok"],
        generator: { primary: "MoneyPrinterTurbo", moneyPrinterTurboAllowed: true },
        output: { kind: "vertical_video", aspectRatios: ["9:16", "4:5"], postizFormat: "ad_draft_video" },
        angle: "Paid ad video: open with uneven base problem and show French Rubber Base.",
        claims: {
          approvedBenefits: ["smooth base", "salon-ready base"],
          blockedClaims: ["invented testimonials", "unverified lab results"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        review: { required: true, status: "needs_review", reviewer: "pending-human-review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        contentType: "normal_post",
        label: "Normal post",
        platforms: ["instagram", "facebook", "tiktok"],
        generator: { primary: "Manual or Canva-style post builder", moneyPrinterTurboAllowed: false },
        output: { kind: "image_or_caption_post", aspectRatios: ["1:1", "4:5"], postizFormat: "feed_post_draft" },
        angle: "Normal post: explain why a smooth base helps cleaner colour application.",
        claims: {
          approvedBenefits: ["smooth base", "cleaner colour application"],
          blockedClaims: ["guaranteed perfect results"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        review: { required: true, status: "needs_review", reviewer: "pending-human-review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
  };
}

function requestTemplate() {
  return {
    video_subject: "Crystal Clawz French Rubber Base",
    video_script_prompt: "Create a short, practical Crystal Clawz video.",
    video_aspect: "9:16",
    video_source: "local",
    video_count: 1,
    video_clip_duration: 5,
    voice_name: "",
    subtitle_enabled: true
  };
}

test("builds review-first production packets for each planned content asset", () => {
  const packets = buildProductionPackets({
    contentPlan: contentPlan(),
    requestTemplate: requestTemplate(),
    generatedAt: "2026-06-10T18:00:00.000Z"
  });

  assert.equal(packets.packageType, "social_studio_production_packets");
  assert.equal(packets.status, "needs_review");
  assert.equal(packets.safety.noLivePosting, true);
  assert.equal(packets.safety.networkCallsAllowed, false);
  assert.equal(packets.safety.postizBlockedUntilApproval, true);
  assert.deepEqual(
    packets.assets.map((asset) => asset.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );

  const videoPackets = packets.assets.filter((asset) => asset.packetType === "moneyprinter_video_request");
  assert.equal(videoPackets.length, 2);
  assert.equal(videoPackets.every((asset) => asset.moneyprinterRequest.video_aspect === "9:16"), true);
  assert.equal(videoPackets.every((asset) => asset.execution.networkCallsAllowed === false), true);
  assert.equal(videoPackets.every((asset) => asset.postiz.publishAllowed === false), true);
  assert.match(videoPackets[0].moneyprinterRequest.video_script_prompt, /UGC video/i);
  assert.match(videoPackets[1].moneyprinterRequest.video_script_prompt, /Paid ad video/i);
  assert.doesNotMatch(JSON.stringify(videoPackets), /cross.?post/i);

  const postPacket = packets.assets.find((asset) => asset.contentType === "normal_post");
  assert.equal(postPacket.packetType, "static_post_copy_brief");
  assert.match(postPacket.staticPost.captionDraft, /French Rubber Base/);
  assert.match(postPacket.staticPost.designBrief, /Normal post/);
  assert.equal(postPacket.postiz.publishAllowed, false);

  const uiVideo = packets.uiSummary.assets.find((asset) => asset.contentType === "ugc_video");
  assert.match(uiVideo.details.promptSummary, /UGC video/i);
  assert.deepEqual(uiVideo.details.platforms, ["instagram", "facebook", "tiktok"]);
  assert.deepEqual(uiVideo.details.formats, ["9:16"]);
  assert.equal(uiVideo.details.postizFormat, "reel_or_short");
  const uiPost = packets.uiSummary.assets.find((asset) => asset.contentType === "normal_post");
  assert.match(uiPost.details.captionDraft, /French Rubber Base/i);
  assert.match(uiPost.details.designBrief, /Normal post/i);
  assert.deepEqual(uiPost.details.formats, ["1:1", "4:5"]);
  assert.equal(uiPost.details.postizFormat, "feed_post_draft");
  assert.deepEqual(uiPost.details.reviewFocus, []);
});

test("rejects content plans whose assets are no longer review-first", () => {
  const unsafe = contentPlan();
  unsafe.assets[0].postiz.publishAllowed = true;

  assert.throws(
    () =>
      buildProductionPackets({
        contentPlan: unsafe,
        requestTemplate: requestTemplate()
      }),
    /review-first/i
  );
});

test("writes production packet index and per-asset files from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-production-packets-"));
  try {
    const contentPlanPath = path.join(tempDir, "content-plan.json");
    const requestTemplatePath = path.join(tempDir, "request-template.json");
    const outDir = path.join(tempDir, "production-packets");
    await writeFile(contentPlanPath, `${JSON.stringify(contentPlan(), null, 2)}\n`);
    await writeFile(requestTemplatePath, `${JSON.stringify(requestTemplate(), null, 2)}\n`);

    const result = await buildProductionPacketsFromFiles({
      contentPlanPath,
      requestTemplatePath,
      outDir,
      generatedAt: "2026-06-10T18:00:00.000Z"
    });

    assert.equal(result.status, "needs_review");
    assert.equal(result.assetCount, 3);
    const index = JSON.parse(await readFile(path.join(outDir, "production-packets.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "production-packets.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "production-packets.md"), "utf8");
    const ugcRequest = JSON.parse(
      await readFile(path.join(outDir, "moneyprinter", "cc-rubber-base-demo-2026-06-10-ugc-video-01.request.json"), "utf8")
    );
    const paidRequest = JSON.parse(
      await readFile(path.join(outDir, "moneyprinter", "cc-rubber-base-demo-2026-06-10-paid-ad-video-02.request.json"), "utf8")
    );
    const normalPost = JSON.parse(
      await readFile(path.join(outDir, "static-posts", "cc-rubber-base-demo-2026-06-10-normal-post-03.copy.json"), "utf8")
    );

    assert.equal(index.assets.length, 3);
    assert.equal(ui.assets.length, 3);
    assert.match(ui.assets[0].details.promptSummary, /UGC video/i);
    assert.match(ui.assets[2].details.captionDraft, /Shop Crystal Clawz French Rubber Base/i);
    assert.deepEqual(ui.assets[2].details.formats, ["1:1", "4:5"]);
    assert.match(markdown, /Postiz blocked until approval/i);
    assert.match(markdown, /Prompt summary/i);
    assert.match(markdown, /Caption draft/i);
    assert.match(markdown, /Suggested formats/i);
    assert.match(ugcRequest.video_script_prompt, /UGC video/i);
    assert.match(paidRequest.video_script_prompt, /Paid ad video/i);
    assert.match(normalPost.captionDraft, /Shop Crystal Clawz French Rubber Base/);
    assert.equal(JSON.stringify(ui).includes("C:\\"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
