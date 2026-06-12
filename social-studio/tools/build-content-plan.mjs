import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

const CONTENT_FAMILIES = {
  ugc_video: {
    label: "UGC video",
    primaryGenerator: "MoneyPrinterTurbo",
    output: "vertical_video",
    aspectRatios: ["9:16"],
    reviewFocus: [
      "creator-style hook feels natural",
      "product is visible early",
      "claims stay inside approved benefits",
      "caption and CTA match the product page"
    ],
    postizFormat: "reel_or_short"
  },
  paid_ad_video: {
    label: "Paid ad video",
    primaryGenerator: "MoneyPrinterTurbo",
    output: "vertical_video",
    aspectRatios: ["9:16", "4:5"],
    reviewFocus: [
      "first three seconds show the problem or product clearly",
      "benefit claim is source-backed",
      "offer and CTA are explicit",
      "visual pacing works for a paid placement"
    ],
    postizFormat: "ad_draft_video"
  },
  normal_post: {
    label: "Normal post",
    primaryGenerator: "Manual or Canva-style post builder",
    output: "image_or_caption_post",
    aspectRatios: ["1:1", "4:5"],
    reviewFocus: [
      "single clear product point",
      "caption is useful without overclaiming",
      "image or carousel frame has readable product context",
      "CTA is clear"
    ],
    postizFormat: "feed_post_draft"
  },
  product_demo: {
    label: "Product demo",
    primaryGenerator: "MoneyPrinterTurbo",
    output: "demo_video",
    aspectRatios: ["9:16"],
    reviewFocus: [
      "steps are practical and safe",
      "product handling is accurate",
      "before/after framing does not imply guaranteed results",
      "CTA points to the correct product"
    ],
    postizFormat: "reel_or_short"
  },
  educational_post: {
    label: "Educational post",
    primaryGenerator: "Manual or Canva-style post builder",
    output: "carousel_or_static_post",
    aspectRatios: ["1:1", "4:5"],
    reviewFocus: [
      "tip is useful for nail technicians",
      "claim source is visible in the brief",
      "blocked claims are avoided",
      "CTA does not crowd the teaching point"
    ],
    postizFormat: "feed_post_draft"
  }
};

const DEFAULT_CONTENT_TYPES = ["ugc_video", "paid_ad_video", "normal_post"];

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function contentTypesForBrief(brief, requestedTypes = []) {
  const requested = requestedTypes.length ? requestedTypes : DEFAULT_CONTENT_TYPES;
  return uniq([brief.contentType, ...requested]).filter((type) => {
    if (!CONTENT_FAMILIES[type]) {
      throw new Error(`unsupported content type: ${type}`);
    }
    return true;
  });
}

function makeAssetId(campaignId, contentType, index) {
  return `${campaignId}-${contentType.replace(/_/g, "-")}-${String(index + 1).padStart(2, "0")}`;
}

function makeAngle({ brief, product, family }) {
  const benefit = product.approvedBenefits?.[0] || brief.claimSource?.approvedBenefits?.[0] || "salon-ready result";
  return `${family.label}: show ${brief.product.name} helping ${brief.audience} with ${brief.painPoint.toLowerCase()} using the approved benefit "${benefit}".`;
}

function makeMarkdown(plan) {
  const lines = [
    "# Crystal Clawz Content Plan",
    "",
    `Generated: ${plan.generatedAt}`,
    `Campaign: ${plan.campaignId}`,
    `Status: ${plan.status}`,
    "",
    "## Safety",
    "",
    `- Nothing has been posted live: ${plan.safety.noLivePosting ? "yes" : "no"}`,
    `- Postiz draft only after approval: ${plan.safety.postizDraftOnlyAfterApproval ? "yes" : "no"}`,
    "",
    "## Planned Assets",
    ""
  ];

  for (const asset of plan.assets) {
    lines.push(
      `### ${asset.label}`,
      "",
      `- Asset id: ${asset.assetId}`,
      `- Generator: ${asset.generator.primary}`,
      `- Output: ${asset.output.kind}`,
      `- Platforms: ${asset.platforms.join(", ")}`,
      `- Postiz: blocked until human approval`,
      `- Angle: ${asset.angle}`,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

function makeUiSummary(plan) {
  return {
    campaignId: plan.campaignId,
    status: plan.status,
    noLivePosting: plan.safety.noLivePosting,
    postizDraftOnlyAfterApproval: plan.safety.postizDraftOnlyAfterApproval,
    assets: plan.assets.map((asset) => ({
      assetId: asset.assetId,
      label: asset.label,
      contentType: asset.contentType,
      generator: asset.generator.primary,
      output: asset.output.kind,
      platforms: asset.platforms,
      angle: asset.angle,
      reviewRequired: asset.review.required,
      postizStatus: asset.postiz.status,
      publishAllowed: asset.postiz.publishAllowed
    }))
  };
}

export function buildContentPlan({
  brief,
  product,
  contentTypes = [],
  generatedAt = new Date().toISOString()
}) {
  if (brief?.status !== "brief") {
    throw new Error("content plan requires a brief status");
  }

  const resolvedTypes = contentTypesForBrief(brief, contentTypes);
  const assets = resolvedTypes.map((contentType, index) => {
    const family = CONTENT_FAMILIES[contentType];
    return {
      assetId: makeAssetId(brief.campaignId, contentType, index),
      contentType,
      label: family.label,
      stage: "planned",
      platforms: brief.platforms,
      generator: {
        primary: family.primaryGenerator,
        moneyPrinterTurboAllowed: family.primaryGenerator === "MoneyPrinterTurbo",
        notes:
          family.primaryGenerator === "MoneyPrinterTurbo"
            ? "Use local MoneyPrinterTurbo only, then route the MP4 through human review."
            : "Build manually or with a design tool, then route the asset through human review."
      },
      output: {
        kind: family.output,
        aspectRatios: family.aspectRatios,
        postizFormat: family.postizFormat
      },
      angle: makeAngle({ brief, product, family }),
      claims: {
        approvedBenefits: product.approvedBenefits || brief.claimSource?.approvedBenefits || [],
        blockedClaims: product.blockedClaims || brief.claimSource?.blockedClaims || [],
        sourceRef: product.sourceUrl || brief.claimSource?.sourceRef || ""
      },
      review: {
        required: true,
        status: "needs_review",
        reviewer: brief.reviewer,
        focus: family.reviewFocus
      },
      postiz: {
        status: "blocked_until_approved",
        handoffMode: "manual_upload_or_dry_run_after_approval",
        draftCreationAllowed: false,
        scheduleAllowed: false,
        publishAllowed: false
      }
    };
  });

  const plan = {
    packageType: "social_studio_content_plan",
    generatedAt,
    campaignId: brief.campaignId,
    campaignName: brief.campaignName,
    status: "needs_review",
    product: {
      name: brief.product.name,
      category: brief.product.category,
      url: brief.product.url
    },
    audience: brief.audience,
    cta: brief.cta,
    safety: {
      noLivePosting: true,
      humanReviewRequired: true,
      postizDraftOnlyAfterApproval: true,
      secretsRequired: false
    },
    assets
  };
  plan.uiSummary = makeUiSummary(plan);
  plan.markdown = makeMarkdown(plan);
  return plan;
}

export async function buildContentPlanFromFiles({
  briefPath,
  productPath,
  outDir,
  contentTypes = [],
  generatedAt
}) {
  const plan = buildContentPlan({
    brief: JSON.parse(await readFile(briefPath, "utf8")),
    product: JSON.parse(await readFile(productPath, "utf8")),
    contentTypes,
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "content-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(path.join(outDir, "content-plan.ui.json"), `${JSON.stringify(plan.uiSummary, null, 2)}\n`);
  await writeFile(path.join(outDir, "content-plan.md"), plan.markdown);
  return {
    status: plan.status,
    assetCount: plan.assets.length,
    jsonPath: path.join(outDir, "content-plan.json"),
    uiPath: path.join(outDir, "content-plan.ui.json"),
    markdownPath: path.join(outDir, "content-plan.md")
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const contentTypesArg = readArg("content-types", "");
  const result = await buildContentPlanFromFiles({
    briefPath: readArg("brief", path.join(studioRoot, "examples", "rubber-base-campaign-brief.example.json")),
    productPath: readArg("product", path.join(studioRoot, "examples", "rubber-base-product-input.example.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "content-plan")),
    contentTypes: contentTypesArg ? contentTypesArg.split(",").map((item) => item.trim()).filter(Boolean) : []
  });

  console.log(`status=${result.status}`);
  console.log(`asset_count=${result.assetCount}`);
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
