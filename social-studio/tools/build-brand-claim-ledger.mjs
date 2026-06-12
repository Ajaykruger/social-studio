import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

const REVIEW_CHECKS = {
  brandFit: false,
  claimSafe: false,
  productVisible: false,
  captionReady: false,
  ctaReady: false,
  platformReady: false,
  notLive: true
};

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function assertReviewFirstContentPlan(contentPlan) {
  if (contentPlan?.packageType !== "social_studio_content_plan") {
    throw new Error("brand claim ledger requires a content plan");
  }
  if (
    contentPlan?.safety?.noLivePosting !== true ||
    contentPlan?.safety?.postizDraftOnlyAfterApproval !== true
  ) {
    throw new Error("brand claim ledger requires review-first content plan safety");
  }
  const assets = Array.isArray(contentPlan.assets) ? contentPlan.assets : [];
  if (!assets.length) {
    throw new Error("brand claim ledger requires planned assets");
  }
  for (const asset of assets) {
    if (
      asset?.review?.required !== true ||
      asset?.review?.status !== "needs_review" ||
      asset?.postiz?.status !== "blocked_until_approved" ||
      asset?.postiz?.publishAllowed !== false
    ) {
      throw new Error("brand claim ledger requires every asset to remain review-first");
    }
  }
}

function extractBrandRules(brandContextText) {
  return String(brandContextText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-#\s]+/, "").trim())
    .filter((line) =>
      /South African|friendly|professional|practical|product-page|human-approved|Do not invent|draft-only|human reviewer/i.test(
        line
      )
    )
    .slice(0, 10);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function makeLedgerAsset(asset, product) {
  const approvedBenefits = unique([
    ...(asset.claims?.approvedBenefits || []),
    ...(product.approvedBenefits || [])
  ]);
  const blockedClaims = unique([
    ...(asset.claims?.blockedClaims || []),
    ...(product.blockedClaims || [])
  ]);
  const sourceRef = asset.claims?.sourceRef || product.sourceUrl || "";

  return {
    assetId: asset.assetId,
    label: asset.label,
    contentType: asset.contentType,
    platforms: asset.platforms || [],
    angle: asset.angle || "",
    claimRules: {
      sourceRef,
      approvedBenefits,
      blockedClaims,
      approvalNote: product.approvalNote || "Use only product-page-supported claims or human-approved wording."
    },
    requiredVisuals: product.requiredVisuals || [],
    reviewChecks: { ...REVIEW_CHECKS },
    review: {
      required: true,
      status: "needs_review",
      reviewer: asset.review?.reviewer || "pending-human-review"
    },
    postiz: {
      status: "blocked_until_approved",
      publishAllowed: false
    }
  };
}

function makeSummary(assets) {
  return {
    totalAssets: assets.length,
    assetsNeedingHumanClaimCheck: assets.filter((asset) => asset.review.status === "needs_review").length,
    publishAllowed: assets.filter((asset) => asset.postiz.publishAllowed).length
  };
}

function makeUiSummary(ledger) {
  return {
    campaignId: ledger.campaignId,
    status: ledger.status,
    noLivePosting: ledger.safety.noLivePosting,
    postizBlockedUntilApproval: ledger.safety.postizBlockedUntilApproval,
    summary: ledger.summary,
    brandRules: ledger.brandRules,
    assets: ledger.assets.map((asset) => ({
      assetId: asset.assetId,
      label: asset.label,
      contentType: asset.contentType,
      sourceRef: asset.claimRules.sourceRef,
      approvedBenefitCount: asset.claimRules.approvedBenefits.length,
      blockedClaimCount: asset.claimRules.blockedClaims.length,
      requiredVisuals: asset.requiredVisuals,
      reviewStatus: asset.review.status,
      publishAllowed: asset.postiz.publishAllowed
    }))
  };
}

function makeMarkdown(ledger) {
  const lines = [
    "# Crystal Clawz Brand Claim Ledger",
    "",
    `Generated: ${ledger.generatedAt}`,
    `Campaign: ${ledger.campaignId}`,
    `Status: ${ledger.status}`,
    "",
    "## Brand Rules",
    ""
  ];

  for (const rule of ledger.brandRules) {
    lines.push(`- ${rule}`);
  }

  lines.push("", "## Assets", "");
  for (const asset of ledger.assets) {
    lines.push(
      `### ${asset.label}`,
      "",
      `- Source: ${asset.claimRules.sourceRef}`,
      `- Approved benefits: ${asset.claimRules.approvedBenefits.join("; ")}`,
      `- Blocked claims: ${asset.claimRules.blockedClaims.join("; ")}`,
      `- Required visuals: ${asset.requiredVisuals.join(", ")}`,
      `- Review: ${asset.review.status}`,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

export function buildBrandClaimLedger({
  contentPlan,
  product,
  brandContextText,
  generatedAt = new Date().toISOString()
}) {
  assertReviewFirstContentPlan(contentPlan);
  const assets = contentPlan.assets.map((asset) => makeLedgerAsset(asset, product));
  const ledger = {
    packageType: "social_studio_brand_claim_ledger",
    generatedAt,
    campaignId: contentPlan.campaignId,
    campaignName: contentPlan.campaignName,
    status: "needs_review",
    safety: {
      noLivePosting: true,
      postizBlockedUntilApproval: true,
      scheduleAllowed: false,
      publishAllowed: false
    },
    brandRules: extractBrandRules(brandContextText),
    summary: makeSummary(assets),
    assets
  };
  ledger.uiSummary = makeUiSummary(ledger);
  ledger.markdown = makeMarkdown(ledger);
  return ledger;
}

export async function buildBrandClaimLedgerFromFiles({
  contentPlanPath,
  productPath,
  brandContextPath,
  outDir,
  generatedAt
}) {
  const ledger = buildBrandClaimLedger({
    contentPlan: JSON.parse(await readFile(contentPlanPath, "utf8")),
    product: JSON.parse(await readFile(productPath, "utf8")),
    brandContextText: await readFile(brandContextPath, "utf8"),
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "brand-claim-ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(path.join(outDir, "brand-claim-ledger.ui.json"), `${JSON.stringify(ledger.uiSummary, null, 2)}\n`);
  await writeFile(path.join(outDir, "brand-claim-ledger.md"), ledger.markdown);
  return {
    status: ledger.status,
    jsonPath: path.join(outDir, "brand-claim-ledger.json"),
    uiPath: path.join(outDir, "brand-claim-ledger.ui.json"),
    markdownPath: path.join(outDir, "brand-claim-ledger.md")
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildBrandClaimLedgerFromFiles({
    contentPlanPath: readArg("content-plan", path.join(generatedDir, "content-plan", "content-plan.json")),
    productPath: readArg("product", path.join(studioRoot, "examples", "rubber-base-product-input.example.json")),
    brandContextPath: readArg("brand-context", path.join(studioRoot, "brand-brain", "brand-context-index.md")),
    outDir: readArg("out-dir", path.join(generatedDir, "brand-claim-ledger"))
  });

  console.log(`status=${result.status}`);
  console.log(`json=${result.jsonPath}`);
  console.log(`ui=${result.uiPath}`);
  console.log(`markdown=${result.markdownPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
