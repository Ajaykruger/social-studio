import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function loadJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function assertReviewFirstHandoff(handoff) {
  const review = handoff?.review || {};
  if (review.notLiveConfirmed !== true) {
    throw new Error("handoff must confirm the content is not live");
  }

  if (["draft_upload_ready", "handed_to_postiz"].includes(handoff.status)) {
    const approvedBy = String(review.approvedBy || "").trim();
    const approvedAt = String(review.approvedAt || "").trim();
    if (!approvedBy || approvedBy === "pending-human-review" || !approvedAt) {
      throw new Error(`${handoff.status} cannot be draft_upload_ready without human approval`);
    }
  }

  return true;
}

function makeCaption(brief, product) {
  const firstBenefit = product.approvedBenefits?.[0] || "salon-ready base";
  const sentence = `${firstBenefit} for cleaner salon work. ${brief.cta}.`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}

function makeHashtags(product) {
  const base = ["#CrystalClawz", "#NailTechSA"];
  if (/rubber/i.test(product.category)) {
    base.push("#RubberBaseGel", "#FrenchRubberBase");
  }
  base.push("#SalonReady");
  return base;
}

export function buildDraftBundle({
  brief,
  product,
  requestTemplate,
  mediaPath = "",
  thumbnailPath = ""
}) {
  if (brief.status !== "brief") {
    throw new Error("draft bundle can only start from a brief status");
  }

  const moneyprinterRequest = {
    ...clone(requestTemplate),
    video_subject: `${brief.product.name} for ${brief.audience}`,
    video_script_prompt: [
      `Create a short, practical, salon-focused script for ${brief.product.name}.`,
      `Audience: ${brief.audience}.`,
      `Pain point: ${brief.painPoint}.`,
      `CTA: ${brief.cta}.`,
      `Approved benefits: ${product.approvedBenefits.join("; ")}.`,
      `Blocked claims: ${product.blockedClaims.join("; ")}.`,
      "Do not invent testimonials, medical claims, lab results, or guaranteed outcomes."
    ].join(" ")
  };

  const assetId = `${brief.campaignId}-draft-001`;
  const reviewStatus = {
    campaignId: brief.campaignId,
    assetId,
    status: "needs_review",
    reviewer: brief.reviewer,
    checks: {
      brandFit: false,
      claimSafe: false,
      productVisible: false,
      captionReady: false,
      ctaReady: false,
      platformReady: false,
      notLive: true
    },
    notes: "Draft bundle prepared. Human reviewer must approve for Postiz draft upload only.",
    approval: {
      approvedBy: "",
      approvedAt: "",
      approvalEvidence: ""
    }
  };

  const postizHandoff = {
    campaignId: brief.campaignId,
    assetId,
    handoffMode: "manual_upload",
    platforms: brief.platforms,
    media: {
      localPath: mediaPath,
      thumbnailPath,
      mediaType: "video",
      aspectRatio: "9:16"
    },
    caption: makeCaption(brief, product),
    hashtags: makeHashtags(product),
    scheduledFor: "",
    status: "needs_review",
    review: {
      approvedBy: "pending-human-review",
      approvedAt: "",
      notLiveConfirmed: true,
      notes: "Preview package only. Do not upload or schedule until review status is approved."
    }
  };

  assertReviewFirstHandoff(postizHandoff);

  return {
    campaignId: brief.campaignId,
    assetId,
    generatedAt: new Date().toISOString(),
    moneyprinterRequest,
    reviewStatus,
    postizHandoff
  };
}

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const briefPath = readArg(
    "brief",
    path.join(studioRoot, "examples", "rubber-base-campaign-brief.example.json")
  );
  const productPath = readArg(
    "product",
    path.join(studioRoot, "examples", "rubber-base-product-input.example.json")
  );
  const requestPath = readArg(
    "request",
    path.join(studioRoot, "connectors", "moneyprinter", "request.example.json")
  );
  const mediaPath = readArg("media", "");
  const thumbnailPath = readArg("thumbnail", "");
  const outDir = readArg(
    "out-dir",
    path.join(studioRoot, "generated", "cc-rubber-base-demo-2026-06-10")
  );

  const bundle = buildDraftBundle({
    brief: await loadJsonFile(briefPath),
    product: await loadJsonFile(productPath),
    requestTemplate: await loadJsonFile(requestPath),
    mediaPath,
    thumbnailPath
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "draft-bundle.json"),
    `${JSON.stringify(bundle, null, 2)}\n`
  );
  await writeFile(
    path.join(outDir, "moneyprinter-request.json"),
    `${JSON.stringify(bundle.moneyprinterRequest, null, 2)}\n`
  );
  await writeFile(
    path.join(outDir, "review-status.json"),
    `${JSON.stringify(bundle.reviewStatus, null, 2)}\n`
  );
  await writeFile(
    path.join(outDir, "postiz-handoff.preview.json"),
    `${JSON.stringify(bundle.postizHandoff, null, 2)}\n`
  );

  console.log(`draft_bundle=${path.join(outDir, "draft-bundle.json")}`);
  console.log(`status=${bundle.reviewStatus.status}`);
  console.log(`postiz_status=${bundle.postizHandoff.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
