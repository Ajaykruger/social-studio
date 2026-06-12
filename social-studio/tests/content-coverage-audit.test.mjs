import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildContentCoverageAudit,
  buildContentCoverageAuditFromFiles
} from "../tools/build-content-coverage-audit.mjs";

const REQUIRED_TYPES = ["ugc_video", "paid_ad_video", "normal_post"];

function contentPlan() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    noLivePosting: true,
    postizDraftOnlyAfterApproval: true,
    assets: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        label: "UGC video",
        contentType: "ugc_video",
        generator: "MoneyPrinterTurbo",
        output: "vertical_video",
        publishAllowed: false
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        label: "Paid ad video",
        contentType: "paid_ad_video",
        generator: "MoneyPrinterTurbo",
        output: "vertical_video",
        publishAllowed: false
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        label: "Normal post",
        contentType: "normal_post",
        generator: "Manual or Canva-style post builder",
        output: "image_or_caption_post",
        publishAllowed: false
      }
    ]
  };
}

function productionQueue() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    noLivePosting: true,
    postizBlockedUntilApproval: true,
    summary: {
      totalAssets: 3,
      generatedAssets: 1,
      needsReview: 1,
      packetReady: 2,
      publishAllowed: 0
    },
    items: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        label: "UGC video",
        contentType: "ugc_video",
        packetType: "moneyprinter_video_request",
        generator: "MoneyPrinterTurbo",
        state: "generated_needs_review",
        mediaPresent: true,
        postizStatus: "blocked_until_approved",
        publishAllowed: false,
        nextAction: "Review the generated MP4/contact sheet and record approve, needs_revision, or reject."
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        label: "Paid ad video",
        contentType: "paid_ad_video",
        packetType: "moneyprinter_video_request",
        generator: "MoneyPrinterTurbo",
        state: "packet_ready",
        mediaPresent: false,
        postizStatus: "blocked_until_approved",
        publishAllowed: false,
        nextAction: "Produce this packet, then route the output through human review."
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        label: "Normal post",
        contentType: "normal_post",
        packetType: "static_post_copy_brief",
        generator: "Manual or Canva-style post builder",
        state: "packet_ready",
        mediaPresent: false,
        postizStatus: "blocked_until_approved",
        publishAllowed: false,
        nextAction: "Produce this packet, then route the output through human review."
      }
    ]
  };
}

test("audits requested UGC, paid ad, and normal post coverage without treating packets as generated media", () => {
  const audit = buildContentCoverageAudit({
    contentPlan: contentPlan(),
    productionQueue: productionQueue(),
    requiredContentTypes: REQUIRED_TYPES,
    generatedAt: "2026-06-10T22:00:00.000Z"
  });

  assert.equal(audit.packageType, "social_studio_content_coverage_audit");
  assert.equal(audit.status, "partial_production_coverage");
  assert.equal(audit.noLivePosting, true);
  assert.equal(audit.networkCallsAllowed, false);
  assert.equal(audit.publishAllowed, 0);
  assert.equal(audit.summary.requiredContentTypes, 3);
  assert.equal(audit.summary.plannedContentTypes, 3);
  assert.equal(audit.summary.packetReadyContentTypes, 3);
  assert.equal(audit.summary.generatedContentTypes, 1);
  assert.equal(audit.summary.pendingProductionContentTypes, 2);
  assert.equal(audit.summary.missingContentTypes, 0);
  assert.match(audit.nextAction, /Review the generated UGC video/i);

  const ugc = audit.items.find((item) => item.contentType === "ugc_video");
  const paid = audit.items.find((item) => item.contentType === "paid_ad_video");
  const post = audit.items.find((item) => item.contentType === "normal_post");
  assert.equal(ugc.status, "generated_needs_review");
  assert.equal(paid.status, "pending_production");
  assert.equal(post.status, "pending_production");
  assert.doesNotMatch(JSON.stringify(audit.uiSummary), /C:\\|localPath|TODO|replace-with|placeholder/i);
});

test("counts generated UGC and normal post review assets while leaving paid ad pending", () => {
  const queue = productionQueue();
  queue.summary.generatedAssets = 2;
  queue.summary.needsReview = 2;
  queue.summary.packetReady = 1;
  queue.items[2] = {
    ...queue.items[2],
    state: "generated_needs_review",
    mediaPresent: true,
    reviewAssetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
    nextAction: "Review the generated static post image and caption, then record a decision."
  };

  const audit = buildContentCoverageAudit({
    contentPlan: contentPlan(),
    productionQueue: queue,
    requiredContentTypes: REQUIRED_TYPES,
    generatedAt: "2026-06-10T23:30:00.000Z"
  });

  assert.equal(audit.status, "partial_production_coverage");
  assert.equal(audit.summary.generatedContentTypes, 2);
  assert.equal(audit.summary.pendingProductionContentTypes, 1);
  assert.equal(audit.items.find((item) => item.contentType === "normal_post").status, "generated_needs_review");
  assert.equal(audit.items.find((item) => item.contentType === "paid_ad_video").status, "pending_production");
  assert.match(audit.nextAction, /pending paid ad video/i);
  assert.doesNotMatch(audit.nextAction, /pending paid ad video and normal post/i);
});

test("marks coverage complete only when all required content types have generated review assets", () => {
  const queue = productionQueue();
  queue.summary.generatedAssets = 3;
  queue.summary.packetReady = 0;
  queue.items = queue.items.map((item) => ({
    ...item,
    state: "generated_needs_review",
    mediaPresent: true,
    nextAction: "Review the generated asset and record a decision."
  }));

  const audit = buildContentCoverageAudit({
    contentPlan: contentPlan(),
    productionQueue: queue,
    requiredContentTypes: REQUIRED_TYPES
  });

  assert.equal(audit.status, "generated_review_coverage_ready");
  assert.equal(audit.summary.generatedContentTypes, 3);
  assert.equal(audit.summary.pendingProductionContentTypes, 0);
  assert.match(audit.nextAction, /Review all generated assets/i);
});

test("rejects content coverage if any queued asset allows publishing", () => {
  const queue = productionQueue();
  queue.summary.publishAllowed = 1;
  queue.items[1].publishAllowed = true;

  assert.throws(
    () =>
      buildContentCoverageAudit({
        contentPlan: contentPlan(),
        productionQueue: queue,
        requiredContentTypes: REQUIRED_TYPES
      }),
    /publish-enabled/i
  );
});

test("writes coverage audit JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-content-coverage-"));
  try {
    const planPath = path.join(tempDir, "content-plan.ui.json");
    const queuePath = path.join(tempDir, "production-queue.ui.json");
    const outDir = path.join(tempDir, "content-coverage-audit");
    await writeFile(planPath, `${JSON.stringify(contentPlan(), null, 2)}\n`);
    await writeFile(queuePath, `${JSON.stringify(productionQueue(), null, 2)}\n`);

    const result = await buildContentCoverageAuditFromFiles({
      contentPlanPath: planPath,
      productionQueuePath: queuePath,
      outDir,
      generatedAt: "2026-06-10T22:00:00.000Z"
    });

    assert.equal(result.status, "partial_production_coverage");
    const saved = JSON.parse(await readFile(path.join(outDir, "content-coverage-audit.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "content-coverage-audit.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "content-coverage-audit.md"), "utf8");
    assert.equal(saved.summary.generatedContentTypes, 1);
    assert.equal(ui.items.length, 3);
    assert.match(markdown, /Content Coverage Audit/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
