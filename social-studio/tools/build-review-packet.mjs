import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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

async function assertFile(filePath, label = "review media file") {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size <= 0) {
      throw new Error(`${label} is empty`);
    }
    return info;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${label} is missing: ${filePath}`);
    }
    throw error;
  }
}

function requireReviewSafety(bundle) {
  const handoff = bundle?.postizHandoff || {};
  const review = handoff.review || {};
  if (review.notLiveConfirmed !== true) {
    throw new Error("review packet requires notLiveConfirmed true");
  }
  if (handoff.scheduledFor) {
    throw new Error("review packet cannot be built for scheduled content");
  }
  if (bundle?.moneyprinterTask?.crossPostResults !== null && bundle?.moneyprinterTask?.crossPostResults !== undefined) {
    throw new Error("review packet cannot include content with cross-post results");
  }
  if (!handoff.media?.localPath) {
    throw new Error("review packet requires a local media path");
  }
  return handoff;
}

function statusLabel(status) {
  const labels = {
    needs_review: "Needs review",
    approved: "Approved",
    needs_revision: "Needs revision",
    rejected: "Rejected"
  };
  return labels[status] || status || "Needs review";
}

function cleanPublicUrlBase(value, campaignId) {
  const base = String(value || `/social-studio/${campaignId}/review`).trim();
  return base.replace(/\/+$/g, "");
}

function makeMarkdown(packet) {
  const lines = [
    "# Crystal Clawz Review Packet",
    "",
    `Campaign: ${packet.campaignId}`,
    `Asset: ${packet.assetId}`,
    `Status: ${packet.status}`,
    "",
    "## Safety",
    "",
    `- Nothing has been posted live: ${packet.safety.notLiveConfirmed ? "yes" : "no"}`,
    `- Schedule or publish ready: ${packet.safety.scheduleOrPublishReady ? "yes" : "no"}`,
    "",
    "## Review Media",
    "",
    `- Video: ${packet.assets.videoUrl}`,
    `- Contact sheet: ${packet.assets.contactSheetUrl}`
  ];

  if (packet.visualReviewSummary) {
    lines.push("", "## Visual Review Notes", "", packet.visualReviewSummary);
  }

  lines.push(
    "",
    "## Decision needed",
    "",
    packet.review.nextAction,
    "",
    "## Caption",
    "",
    packet.caption,
    "",
    packet.hashtags.join(" ")
  );

  return `${lines.join("\n")}\n`;
}

function makeUiSummary(packet) {
  return {
    campaignId: packet.campaignId,
    assetId: packet.assetId,
    status: packet.status,
    statusLabel: statusLabel(packet.status),
    decisionRequired: packet.review.decisionRequired,
    notLiveConfirmed: packet.safety.notLiveConfirmed,
    scheduleOrPublishReady: packet.safety.scheduleOrPublishReady,
    videoUrl: packet.assets.videoUrl,
    contactSheetUrl: packet.assets.contactSheetUrl,
    thumbnailUrl: packet.assets.thumbnailUrl,
    caption: packet.caption,
    hashtags: packet.hashtags,
    visualReviewSummary: packet.visualReviewSummary,
    nextAction: packet.review.nextAction
  };
}

async function readVisualReviewSummary(visualReviewPath = "") {
  if (!visualReviewPath) return "";
  try {
    const text = await readFile(visualReviewPath, "utf8");
    return text
      .replace(/^#.*$/gm, "")
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/`?[A-Za-z]:\\[^`\r\n]+`?/g, "[local file]")
          .replace(/^-+\s*/, "")
          .trim()
      )
      .filter(
        (line) =>
          Boolean(line) &&
          line !== "[local file]" &&
          !line.includes("[local file]") &&
          !/^(date|reviewed file|contact sheet):/i.test(line)
      )
      .slice(0, 6)
      .join(" ");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

export async function buildReviewPacket({
  bundle,
  contactSheetPath,
  visualReviewPath = "",
  outDir = "",
  publicOutDir,
  publicUrlBase = "",
  generatedAt = new Date().toISOString()
}) {
  const handoff = requireReviewSafety(bundle);
  const campaignId = bundle.campaignId;
  const assetId = bundle.assetId;
  const mediaPath = handoff.media.localPath;
  const thumbnailPath = handoff.media.thumbnailPath || "";
  const safePublicBase = cleanPublicUrlBase(publicUrlBase, campaignId);
  const resolvedOutDir = outDir || path.join(studioRoot, "generated", campaignId, "review-packet");
  const resolvedPublicOutDir =
    publicOutDir || path.join(projectRoot, "public", "social-studio", campaignId, "review");

  await assertFile(mediaPath);
  await assertFile(contactSheetPath);
  if (thumbnailPath) {
    await assertFile(thumbnailPath, "review thumbnail file");
  }

  await mkdir(resolvedOutDir, { recursive: true });
  await mkdir(resolvedPublicOutDir, { recursive: true });

  const videoName = path.basename(mediaPath) || "final-1.mp4";
  const thumbnailName = thumbnailPath ? path.basename(thumbnailPath) : "";
  const publicVideoPath = path.join(resolvedPublicOutDir, videoName);
  const publicContactSheetPath = path.join(resolvedPublicOutDir, "contact-sheet.jpg");
  const publicThumbnailPath = thumbnailName ? path.join(resolvedPublicOutDir, thumbnailName) : "";

  await copyFile(mediaPath, publicVideoPath);
  await copyFile(contactSheetPath, publicContactSheetPath);
  if (thumbnailPath && publicThumbnailPath) {
    await copyFile(thumbnailPath, publicThumbnailPath);
  }

  const status = bundle.reviewStatus?.status || handoff.status || "needs_review";
  const visualReviewSummary = await readVisualReviewSummary(visualReviewPath);
  const packet = {
    packageType: "social_studio_review_packet",
    generatedAt,
    campaignId,
    assetId,
    status,
    review: {
      decisionRequired: status === "needs_review",
      approvedBy: handoff.review?.approvedBy || "",
      approvedAt: handoff.review?.approvedAt || "",
      nextAction:
        status === "needs_review"
          ? "Review the MP4 and contact sheet, then record approve, needs_revision, or reject."
          : "Review decision has already been recorded."
    },
    safety: {
      notLiveConfirmed: handoff.review?.notLiveConfirmed === true,
      scheduleOrPublishReady: false,
      crossPostResults: bundle.moneyprinterTask?.crossPostResults ?? null
    },
    assets: {
      videoUrl: `${safePublicBase}/${videoName}`,
      contactSheetUrl: `${safePublicBase}/contact-sheet.jpg`,
      thumbnailUrl: thumbnailName ? `${safePublicBase}/${thumbnailName}` : ""
    },
    caption: handoff.caption || "",
    hashtags: Array.isArray(handoff.hashtags) ? handoff.hashtags : [],
    visualReviewSummary
  };

  const uiSummary = makeUiSummary(packet);
  const markdown = makeMarkdown(packet);

  await writeFile(path.join(resolvedOutDir, "review-packet.json"), `${JSON.stringify(packet, null, 2)}\n`);
  await writeFile(path.join(resolvedOutDir, "review-packet.ui.json"), `${JSON.stringify(uiSummary, null, 2)}\n`);
  await writeFile(path.join(resolvedOutDir, "review-packet.md"), markdown);

  return {
    packet,
    uiSummary,
    packetPath: path.join(resolvedOutDir, "review-packet.json"),
    uiPath: path.join(resolvedOutDir, "review-packet.ui.json"),
    markdownPath: path.join(resolvedOutDir, "review-packet.md"),
    publicOutDir: resolvedPublicOutDir
  };
}

export async function buildReviewPacketFromFiles({
  bundlePath,
  contactSheetPath,
  visualReviewPath = "",
  outDir = "",
  publicOutDir = "",
  publicUrlBase = "",
  generatedAt
}) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  return buildReviewPacket({
    bundle,
    contactSheetPath,
    visualReviewPath,
    outDir,
    publicOutDir,
    publicUrlBase,
    generatedAt
  });
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildReviewPacketFromFiles({
    bundlePath: readArg("bundle", path.join(generatedDir, "draft-bundle.json")),
    contactSheetPath: readArg("contact-sheet", path.join(generatedDir, "visual-review", "contact_sheet.jpg")),
    visualReviewPath: readArg("visual-review", path.join(generatedDir, "visual-review", "visual-review.md")),
    outDir: readArg("out-dir", path.join(generatedDir, "review-packet")),
    publicOutDir: readArg("public-out-dir", path.join(projectRoot, "public", "social-studio", campaignId, "review")),
    publicUrlBase: readArg("public-url-base", `/social-studio/${campaignId}/review`)
  });

  console.log(`packet=${result.packetPath}`);
  console.log(`ui=${result.uiPath}`);
  console.log(`markdown=${result.markdownPath}`);
  console.log(`status=${result.packet.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
