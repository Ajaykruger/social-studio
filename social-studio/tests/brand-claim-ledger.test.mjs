import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildBrandClaimLedger,
  buildBrandClaimLedgerFromFiles
} from "../tools/build-brand-claim-ledger.mjs";

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
      postizDraftOnlyAfterApproval: true
    },
    assets: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        contentType: "ugc_video",
        label: "UGC video",
        platforms: ["instagram", "facebook", "tiktok"],
        angle: "Show French Rubber Base helping nail technicians with uneven base work.",
        claims: {
          approvedBenefits: ["smooth base", "cleaner colour application"],
          blockedClaims: ["medical or health claims", "guaranteed perfect results"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        review: { required: true, status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        contentType: "paid_ad_video",
        label: "Paid ad video",
        platforms: ["instagram", "facebook", "tiktok"],
        angle: "Open with uneven base problem and show French Rubber Base.",
        claims: {
          approvedBenefits: ["smooth base", "salon-ready base"],
          blockedClaims: ["invented testimonials", "unverified lab results"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        review: { required: true, status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        contentType: "normal_post",
        label: "Normal post",
        platforms: ["instagram", "facebook", "tiktok"],
        angle: "Explain why a smooth base helps cleaner colour application.",
        claims: {
          approvedBenefits: ["smooth base", "cleaner colour application"],
          blockedClaims: ["works for every client"],
          sourceRef: "https://crystalclawz.co.za/collections/french-rubber-base"
        },
        review: { required: true, status: "needs_review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false }
      }
    ]
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
      "invented testimonials",
      "unverified lab results",
      "works for every client"
    ],
    requiredVisuals: ["product_closeup", "shade_or_swatch", "cta_end_frame"],
    approvalNote: "Use only product-page-supported claims or human-approved Crystal Clawz wording."
  };
}

const brandContext = [
  "# Crystal Clawz Brand Brain Index",
  "- Speak to South African nail technicians.",
  "- Keep the voice friendly, professional, practical, and clear.",
  "- Use product-page or human-approved claims only.",
  "- Do not invent reviews, awards, lab results, testimonials, before-and-after proof, or medical-style claims."
].join("\n");

test("builds a review-first brand and claim ledger for every planned asset", () => {
  const ledger = buildBrandClaimLedger({
    contentPlan: contentPlan(),
    product: product(),
    brandContextText: brandContext,
    generatedAt: "2026-06-10T21:00:00.000Z"
  });

  assert.equal(ledger.packageType, "social_studio_brand_claim_ledger");
  assert.equal(ledger.status, "needs_review");
  assert.equal(ledger.safety.noLivePosting, true);
  assert.equal(ledger.safety.postizBlockedUntilApproval, true);
  assert.equal(ledger.summary.totalAssets, 3);
  assert.equal(ledger.summary.assetsNeedingHumanClaimCheck, 3);
  assert.equal(ledger.summary.publishAllowed, 0);
  assert.deepEqual(
    ledger.assets.map((asset) => asset.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );

  for (const asset of ledger.assets) {
    assert.equal(asset.review.status, "needs_review");
    assert.equal(asset.postiz.publishAllowed, false);
    assert.deepEqual(asset.requiredVisuals, ["product_closeup", "shade_or_swatch", "cta_end_frame"]);
    assert.equal(asset.reviewChecks.notLive, true);
    assert.equal(asset.reviewChecks.brandFit, false);
    assert.equal(asset.reviewChecks.claimSafe, false);
    assert.equal(asset.claimRules.approvedBenefits.length > 0, true);
    assert.equal(asset.claimRules.blockedClaims.length > 0, true);
    assert.match(asset.claimRules.sourceRef, /crystalclawz/i);
  }

  assert.match(ledger.brandRules.join("\n"), /South African nail technicians/i);
  assert.equal(JSON.stringify(ledger.uiSummary).includes("C:\\"), false);
});

test("rejects ledgers when planned assets are no longer review-first", () => {
  const unsafePlan = contentPlan();
  unsafePlan.assets[0].postiz.publishAllowed = true;

  assert.throws(
    () =>
      buildBrandClaimLedger({
        contentPlan: unsafePlan,
        product: product(),
        brandContextText: brandContext
      }),
    /review-first/i
  );
});

test("writes brand claim ledger JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-brand-ledger-"));
  try {
    const contentPlanPath = path.join(tempDir, "content-plan.json");
    const productPath = path.join(tempDir, "product.json");
    const brandContextPath = path.join(tempDir, "brand-context.md");
    const outDir = path.join(tempDir, "brand-ledger");
    await writeFile(contentPlanPath, `${JSON.stringify(contentPlan(), null, 2)}\n`);
    await writeFile(productPath, `${JSON.stringify(product(), null, 2)}\n`);
    await writeFile(brandContextPath, `${brandContext}\n`);

    const result = await buildBrandClaimLedgerFromFiles({
      contentPlanPath,
      productPath,
      brandContextPath,
      outDir,
      generatedAt: "2026-06-10T21:00:00.000Z"
    });

    assert.equal(result.status, "needs_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "brand-claim-ledger.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "brand-claim-ledger.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "brand-claim-ledger.md"), "utf8");
    assert.equal(saved.assets.length, 3);
    assert.equal(ui.assets.length, 3);
    assert.match(markdown, /Blocked claims/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
