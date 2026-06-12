import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(studioRoot, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizePublicUrlBase(publicUrlBase) {
  return `/${String(publicUrlBase || "").replace(/^\/+|\/+$/g, "")}`;
}

function assetFilename({ campaignId, assetId }) {
  const withoutCampaign = String(assetId || "").startsWith(`${campaignId}-`)
    ? String(assetId).slice(`${campaignId}-`.length)
    : String(assetId || "normal-post");
  const safeBase = withoutCampaign.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safeBase || "normal-post"}.svg`;
}

function wrapWords(value, maxLineLength = 36) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLineLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function findNormalPostPacket(productionPackets, assetId = "") {
  const assets = Array.isArray(productionPackets?.assets) ? productionPackets.assets : [];
  if (assetId) {
    return assets.find((asset) => asset.assetId === assetId);
  }
  return assets.find((asset) => asset.contentType === "normal_post");
}

function assertReviewFirstStaticPacket({ productionPackets, packet }) {
  if (productionPackets?.packageType !== "social_studio_production_packets") {
    throw new Error("static post review asset requires production packets");
  }
  if (
    productionPackets?.safety?.noLivePosting !== true ||
    productionPackets?.safety?.networkCallsAllowed !== false ||
    productionPackets?.safety?.postizBlockedUntilApproval !== true ||
    productionPackets?.safety?.publishAllowed === true
  ) {
    throw new Error("static post review asset requires review-first production packet safety");
  }
  if (!packet) {
    throw new Error("static post review asset requires a normal_post packet");
  }
  if (packet.contentType !== "normal_post" || packet.packetType !== "static_post_copy_brief") {
    throw new Error("static post review asset requires a normal_post static copy packet");
  }
  if (
    packet?.execution?.networkCallsAllowed !== false ||
    packet?.review?.status !== "needs_review" ||
    packet?.postiz?.status !== "blocked_until_approved" ||
    packet?.postiz?.publishAllowed !== false
  ) {
    throw new Error("static post review asset requires review-first normal post packet safety");
  }
}

function makeSvg({ productName, benefit, cta, caption }) {
  const captionLines = wrapWords(caption, 42);
  const captionText = captionLines
    .map((line, index) => `<tspan x="96" dy="${index === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="${escapeXml(productName)} normal post draft">
  <rect width="1080" height="1080" fill="#f8fafc"/>
  <rect x="64" y="64" width="952" height="952" rx="28" fill="#ffffff" stroke="#0f766e" stroke-width="8"/>
  <rect x="96" y="96" width="888" height="156" rx="18" fill="#0f766e"/>
  <text x="138" y="176" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Crystal Clawz</text>
  <text x="138" y="220" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#ccfbf1">Draft for human review</text>
  <text x="96" y="374" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="800" fill="#0f172a">${escapeXml(productName)}</text>
  <rect x="96" y="432" width="540" height="104" rx="16" fill="#f0fdfa" stroke="#14b8a6" stroke-width="4"/>
  <text x="130" y="496" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="800" fill="#134e4a">${escapeXml(benefit)}</text>
  <text x="96" y="628" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#334155">${captionText}</text>
  <rect x="96" y="846" width="610" height="86" rx="16" fill="#ec4899"/>
  <text x="130" y="901" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="800" fill="#ffffff">${escapeXml(cta)}</text>
  <circle cx="866" cy="436" r="118" fill="#ccfbf1" stroke="#0f766e" stroke-width="6"/>
  <text x="866" y="422" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#134e4a">smooth base</text>
  <text x="866" y="462" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#475569">cleaner colour</text>
  <text x="96" y="988" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#64748b">Review before Postiz. Scheduling and publishing are off.</text>
</svg>
`;
}

function makeUiSummary(asset) {
  return {
    campaignId: asset.campaignId,
    assetId: asset.assetId,
    contentType: asset.contentType,
    label: asset.label,
    status: asset.status,
    networkCallsAllowed: asset.networkCallsAllowed,
    publishAllowed: asset.publishAllowed,
    postizStatus: asset.postizStatus,
    media: asset.media,
    caption: asset.caption,
    cta: asset.cta,
    nextAction: asset.nextAction
  };
}

function makeMarkdown(asset) {
  return [
    "# Static Normal Post Review Asset",
    "",
    `Generated: ${asset.generatedAt}`,
    `Campaign: ${asset.campaignId}`,
    `Asset: ${asset.assetId}`,
    `Status: ${asset.status}`,
    "",
    "## Media",
    "",
    `- Image: ${asset.media.imageUrl}`,
    `- Type: ${asset.media.mimeType}`,
    "",
    "## Caption",
    "",
    asset.caption,
    "",
    "## Safety",
    "",
    "- Network calls allowed: false",
    "- Publish allowed: false",
    "- Postiz status: blocked_until_approved",
    ""
  ].join("\n");
}

export async function buildStaticPostReviewAsset({
  productionPackets,
  assetId = "",
  publicOutDir = "",
  publicUrlBase = "",
  generatedAt = new Date().toISOString()
}) {
  const packet = findNormalPostPacket(productionPackets, assetId);
  assertReviewFirstStaticPacket({ productionPackets, packet });

  const campaignId = productionPackets.campaignId;
  const resolvedPublicOutDir = publicOutDir || path.join(projectRoot, "public", "social-studio", campaignId, "review");
  const resolvedPublicUrlBase = normalizePublicUrlBase(publicUrlBase || `/social-studio/${campaignId}/review`);
  const filename = assetFilename({ campaignId, assetId: packet.assetId });
  const caption = packet.staticPost?.captionDraft || "";
  const cta = packet.staticPost?.cta || "";
  const benefit = packet.staticPost?.approvedBenefits?.[0] || "smooth base";
  const productName = caption.split(" helps with ")[0] || "French Rubber Base";

  await mkdir(resolvedPublicOutDir, { recursive: true });
  await writeFile(
    path.join(resolvedPublicOutDir, filename),
    makeSvg({
      productName,
      benefit,
      cta,
      caption
    })
  );

  const asset = {
    packageType: "social_studio_static_post_review_asset",
    generatedAt,
    campaignId,
    assetId: packet.assetId,
    contentType: "normal_post",
    label: packet.label || "Normal post",
    status: "needs_review",
    networkCallsAllowed: false,
    publishAllowed: false,
    postizStatus: "blocked_until_approved",
    review: {
      required: true,
      status: "needs_review",
      reviewer: packet.review?.reviewer || "pending-human-review"
    },
    media: {
      mediaType: "image",
      mimeType: "image/svg+xml",
      imageUrl: `${resolvedPublicUrlBase}/${filename}`,
      altText: `${productName} normal post draft`
    },
    caption,
    cta,
    approvedBenefits: packet.staticPost?.approvedBenefits || [],
    blockedClaims: packet.staticPost?.blockedClaims || [],
    nextAction: "Review the static post image and caption, then record approve, needs_revision, or reject."
  };

  asset.uiSummary = makeUiSummary(asset);
  asset.markdown = makeMarkdown(asset);
  return asset;
}

export async function buildStaticPostReviewAssetFromFiles({
  productionPacketsPath,
  outDir,
  publicOutDir,
  publicUrlBase,
  assetId = "",
  generatedAt
}) {
  const asset = await buildStaticPostReviewAsset({
    productionPackets: JSON.parse(await readFile(productionPacketsPath, "utf8")),
    assetId,
    publicOutDir,
    publicUrlBase,
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "normal-post-review.json");
  const uiPath = path.join(outDir, "normal-post-review.ui.json");
  const markdownPath = path.join(outDir, "normal-post-review.md");
  await writeFile(jsonPath, `${JSON.stringify(asset, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(asset.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, asset.markdown);

  return {
    status: asset.status,
    jsonPath,
    uiPath,
    markdownPath
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildStaticPostReviewAssetFromFiles({
    productionPacketsPath: readArg(
      "production-packets",
      path.join(generatedDir, "production-packets", "production-packets.json")
    ),
    outDir: readArg("out-dir", path.join(generatedDir, "normal-post-review")),
    publicOutDir: readArg("public-out-dir", path.join(projectRoot, "public", "social-studio", campaignId, "review")),
    publicUrlBase: readArg("public-url-base", `/social-studio/${campaignId}/review`),
    assetId: readArg("asset-id", "")
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
