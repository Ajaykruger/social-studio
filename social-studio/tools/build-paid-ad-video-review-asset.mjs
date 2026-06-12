import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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

function assetSlug({ campaignId, assetId }) {
  const withoutCampaign = String(assetId || "").startsWith(`${campaignId}-`)
    ? String(assetId).slice(`${campaignId}-`.length)
    : String(assetId || "paid-ad-video");
  return withoutCampaign.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "paid-ad-video";
}

function safeDrawText(value, maxLength = 52) {
  return String(value || "")
    .replace(/[^A-Za-z0-9 #&.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'");
}

function findPaidAdPacket(productionPackets, assetId = "") {
  const assets = Array.isArray(productionPackets?.assets) ? productionPackets.assets : [];
  if (assetId) {
    return assets.find((asset) => asset.assetId === assetId);
  }
  return assets.find((asset) => asset.contentType === "paid_ad_video");
}

function assertReviewFirstPaidAdPacket({ productionPackets, packet }) {
  if (productionPackets?.packageType !== "social_studio_production_packets") {
    throw new Error("paid ad video review asset requires production packets");
  }
  if (
    productionPackets?.safety?.noLivePosting !== true ||
    productionPackets?.safety?.networkCallsAllowed !== false ||
    productionPackets?.safety?.postizBlockedUntilApproval !== true ||
    productionPackets?.safety?.publishAllowed === true
  ) {
    throw new Error("paid ad video review asset requires review-first production packet safety");
  }
  if (!packet) {
    throw new Error("paid ad video review asset requires a paid_ad_video packet");
  }
  if (packet.contentType !== "paid_ad_video" || packet.packetType !== "moneyprinter_video_request") {
    throw new Error("paid ad video review asset requires a paid_ad_video MoneyPrinter packet");
  }
  if (
    packet?.execution?.networkCallsAllowed !== false ||
    packet?.execution?.apiBasePolicy !== "localhost_only" ||
    packet?.review?.status !== "needs_review" ||
    packet?.postiz?.status !== "blocked_until_approved" ||
    packet?.postiz?.publishAllowed !== false
  ) {
    throw new Error("paid ad video review asset requires review-first paid ad packet safety");
  }
}

function productNameFromPacket(packet) {
  return String(packet?.moneyprinterRequest?.video_subject || "").split(" - ")[0] || "French Rubber Base";
}

function approvedBenefitFromPrompt(packet) {
  const prompt = String(packet?.moneyprinterRequest?.video_script_prompt || "");
  if (/smooth base/i.test(prompt)) return "smooth base";
  return "salon-ready base";
}

function makeStoryboardSvg({ productName, benefit, cta }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280" role="img" aria-label="${escapeXml(productName)} paid ad draft storyboard">
  <rect width="720" height="1280" fill="#0f172a"/>
  <rect x="40" y="54" width="640" height="1172" rx="28" fill="#ffffff"/>
  <rect x="72" y="88" width="576" height="186" rx="22" fill="#0f766e"/>
  <text x="108" y="168" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#ffffff">Crystal Clawz</text>
  <text x="108" y="224" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#ccfbf1">Paid ad draft</text>
  <text x="72" y="388" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#0f172a">${escapeXml(productName)}</text>
  <text x="72" y="468" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="800" fill="#134e4a">Hook: uneven base slows down sets</text>
  <rect x="72" y="528" width="576" height="150" rx="20" fill="#f0fdfa" stroke="#14b8a6" stroke-width="4"/>
  <text x="108" y="604" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="#134e4a">${escapeXml(benefit)}</text>
  <text x="108" y="650" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#475569">cleaner colour application</text>
  <rect x="72" y="764" width="576" height="128" rx="20" fill="#ec4899"/>
  <text x="108" y="844" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#ffffff">${escapeXml(cta)}</text>
  <text x="72" y="1038" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700" fill="#334155">Review before Postiz. No scheduling or publishing.</text>
</svg>
`;
}

function makeVideoFilter({ productName, benefit, cta }) {
  const font = "C\\\\:/Windows/Fonts/arial.ttf";
  const lines = [
    { text: "Crystal Clawz", size: 48, color: "white", x: 56, y: 120 },
    { text: "Paid ad draft", size: 34, color: "0xccfbf1", x: 56, y: 184 },
    { text: productName, size: 58, color: "white", x: 56, y: 360 },
    { text: "Hook uneven base slows down sets", size: 34, color: "0xfdf2f8", x: 56, y: 470 },
    { text: benefit, size: 44, color: "0x99f6e4", x: 56, y: 610 },
    { text: "Cleaner colour application", size: 34, color: "white", x: 56, y: 684 },
    { text: cta, size: 32, color: "0xfce7f3", x: 56, y: 926 },
    { text: "Draft for human review", size: 24, color: "0xcbd5e1", x: 56, y: 1128 }
  ];
  return lines
    .map(
      (line) =>
        `drawtext=fontfile=${font}:text='${safeDrawText(line.text)}':fontcolor=${line.color}:fontsize=${line.size}:x=${line.x}:y=${line.y}`
    )
    .join(",");
}

export async function runFfmpegVideoBuilder({ videoPath, productName, benefit, cta, durationSeconds = 5 }) {
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x0f172a:s=720x1280:d=${durationSeconds}`,
    "-vf",
    makeVideoFilter({ productName, benefit, cta }),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    videoPath
  ];

  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg paid ad video build failed: ${stderr.trim()}`));
      }
    });
  });
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
    nextAction: asset.nextAction
  };
}

function makeMarkdown(asset) {
  return [
    "# Paid Ad Video Review Asset",
    "",
    `Generated: ${asset.generatedAt}`,
    `Campaign: ${asset.campaignId}`,
    `Asset: ${asset.assetId}`,
    `Status: ${asset.status}`,
    "",
    "## Media",
    "",
    `- Video: ${asset.media.videoUrl}`,
    `- Storyboard: ${asset.media.storyboardUrl}`,
    "",
    "## Safety",
    "",
    "- Network calls allowed: false",
    "- Publish allowed: false",
    "- Postiz status: blocked_until_approved",
    ""
  ].join("\n");
}

export async function buildPaidAdVideoReviewAsset({
  productionPackets,
  assetId = "",
  publicOutDir = "",
  publicUrlBase = "",
  generatedAt = new Date().toISOString(),
  runVideoBuilder = runFfmpegVideoBuilder
}) {
  const packet = findPaidAdPacket(productionPackets, assetId);
  assertReviewFirstPaidAdPacket({ productionPackets, packet });

  const campaignId = productionPackets.campaignId;
  const slug = assetSlug({ campaignId, assetId: packet.assetId });
  const videoFilename = `${slug}.mp4`;
  const storyboardFilename = `${slug}-storyboard.svg`;
  const resolvedPublicOutDir = publicOutDir || path.join(projectRoot, "public", "social-studio", campaignId, "review");
  const resolvedPublicUrlBase = normalizePublicUrlBase(publicUrlBase || `/social-studio/${campaignId}/review`);
  const productName = productNameFromPacket(packet);
  const benefit = approvedBenefitFromPrompt(packet);
  const cta = "Shop Crystal Clawz French Rubber Base";
  const videoPath = path.join(resolvedPublicOutDir, videoFilename);

  await mkdir(resolvedPublicOutDir, { recursive: true });
  await writeFile(path.join(resolvedPublicOutDir, storyboardFilename), makeStoryboardSvg({ productName, benefit, cta }));
  await runVideoBuilder({
    videoPath,
    productName,
    benefit,
    cta,
    durationSeconds: 5
  });
  const videoInfo = await stat(videoPath);
  if (!videoInfo.isFile() || videoInfo.size <= 0) {
    throw new Error("paid ad video review asset requires a generated local MP4");
  }

  const asset = {
    packageType: "social_studio_paid_ad_video_review_asset",
    generatedAt,
    campaignId,
    assetId: packet.assetId,
    contentType: "paid_ad_video",
    label: packet.label || "Paid ad video",
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
      mediaType: "video",
      mimeType: "video/mp4",
      videoUrl: `${resolvedPublicUrlBase}/${videoFilename}`,
      storyboardUrl: `${resolvedPublicUrlBase}/${storyboardFilename}`,
      aspectRatio: packet.moneyprinterRequest?.video_aspect || "9:16"
    },
    moneyprinterRequest: {
      subject: packet.moneyprinterRequest?.video_subject || "",
      source: packet.moneyprinterRequest?.video_source || "local"
    },
    nextAction: "Review the paid ad video draft and storyboard, then record approve, needs_revision, or reject."
  };

  asset.uiSummary = makeUiSummary(asset);
  asset.markdown = makeMarkdown(asset);
  return asset;
}

export async function buildPaidAdVideoReviewAssetFromFiles({
  productionPacketsPath,
  outDir,
  publicOutDir,
  publicUrlBase,
  assetId = "",
  generatedAt,
  runVideoBuilder
}) {
  const asset = await buildPaidAdVideoReviewAsset({
    productionPackets: JSON.parse(await readFile(productionPacketsPath, "utf8")),
    assetId,
    publicOutDir,
    publicUrlBase,
    generatedAt,
    runVideoBuilder
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "paid-ad-video-review.json");
  const uiPath = path.join(outDir, "paid-ad-video-review.ui.json");
  const markdownPath = path.join(outDir, "paid-ad-video-review.md");
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
  const result = await buildPaidAdVideoReviewAssetFromFiles({
    productionPacketsPath: readArg(
      "production-packets",
      path.join(generatedDir, "production-packets", "production-packets.json")
    ),
    outDir: readArg("out-dir", path.join(generatedDir, "paid-ad-video-review")),
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
