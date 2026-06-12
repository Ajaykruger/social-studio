import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildContentPlan,
  buildContentPlanFromFiles
} from "../tools/build-content-plan.mjs";

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
    approvedBenefits: [
      "smooth base",
      "cleaner colour application",
      "salon-ready base"
    ],
    blockedClaims: [
      "medical or health claims",
      "guaranteed perfect results",
      "invented testimonials"
    ],
    requiredVisuals: ["product_closeup", "shade_or_swatch", "cta_end_frame"],
    mediaFolder: "",
    approvalNote: "Use only product-page-supported claims or human-approved Crystal Clawz wording.",
    lastReviewedAt: "",
    reviewedBy: ""
  };
}

test("builds a review-first content plan for UGC video, paid ad video, and normal posts", () => {
  const plan = buildContentPlan({
    brief: brief(),
    product: product(),
    generatedAt: "2026-06-10T17:00:00.000Z"
  });

  assert.equal(plan.packageType, "social_studio_content_plan");
  assert.equal(plan.status, "needs_review");
  assert.equal(plan.safety.noLivePosting, true);
  assert.equal(plan.safety.postizDraftOnlyAfterApproval, true);
  assert.deepEqual(
    plan.assets.map((asset) => asset.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );
  assert.equal(plan.assets.every((asset) => asset.review.status === "needs_review"), true);
  assert.equal(plan.assets.every((asset) => asset.postiz.status === "blocked_until_approved"), true);
  assert.equal(plan.assets.every((asset) => asset.postiz.publishAllowed === false), true);
  assert.equal(plan.assets[0].generator.primary, "MoneyPrinterTurbo");
  assert.equal(plan.assets[1].generator.primary, "MoneyPrinterTurbo");
  assert.equal(plan.assets[2].generator.primary, "Manual or Canva-style post builder");
  assert.equal(JSON.stringify(plan).includes("scheduled_ready"), false);
  assert.match(plan.markdown, /UGC video/);
  assert.match(plan.markdown, /Paid ad video/);
  assert.match(plan.markdown, /Normal post/);
});

test("includes the requested brief type first when it is part of the supported content family", () => {
  const paidBrief = brief();
  paidBrief.contentType = "paid_ad_video";

  const plan = buildContentPlan({
    brief: paidBrief,
    product: product(),
    generatedAt: "2026-06-10T17:00:00.000Z"
  });

  assert.deepEqual(
    plan.assets.map((asset) => asset.contentType),
    ["paid_ad_video", "ugc_video", "normal_post"]
  );
});

test("rejects content plans from non-brief statuses", () => {
  const approvedBrief = brief();
  approvedBrief.status = "approved";

  assert.throws(
    () => buildContentPlan({ brief: approvedBrief, product: product() }),
    /brief status/i
  );
});

test("writes JSON, UI JSON, and Markdown content plan from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-content-plan-"));
  try {
    const briefPath = path.join(tempDir, "brief.json");
    const productPath = path.join(tempDir, "product.json");
    const outDir = path.join(tempDir, "content-plan");
    await writeFile(briefPath, `${JSON.stringify(brief(), null, 2)}\n`);
    await writeFile(productPath, `${JSON.stringify(product(), null, 2)}\n`);

    const result = await buildContentPlanFromFiles({
      briefPath,
      productPath,
      outDir,
      generatedAt: "2026-06-10T17:00:00.000Z"
    });

    assert.equal(result.status, "needs_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "content-plan.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "content-plan.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "content-plan.md"), "utf8");
    assert.equal(saved.assets.length, 3);
    assert.equal(ui.assets.length, 3);
    assert.equal(ui.assets[0].reviewRequired, true);
    assert.match(markdown, /blocked until human approval/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
