import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function exists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileSize(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile() ? info.size : 0;
  } catch {
    return 0;
  }
}

function assertReviewFirstPackets(productionPackets) {
  if (productionPackets?.packageType !== "social_studio_production_packets") {
    throw new Error("production queue requires production packets");
  }
  if (
    productionPackets?.safety?.noLivePosting !== true ||
    productionPackets?.safety?.networkCallsAllowed !== false ||
    productionPackets?.safety?.postizBlockedUntilApproval !== true
  ) {
    throw new Error("production queue requires review-first production packet safety");
  }
  const assets = Array.isArray(productionPackets.assets) ? productionPackets.assets : [];
  if (!assets.length) {
    throw new Error("production queue requires at least one packet");
  }
  for (const asset of assets) {
    if (
      asset?.execution?.networkCallsAllowed !== false ||
      asset?.review?.status !== "needs_review" ||
      asset?.postiz?.status !== "blocked_until_approved" ||
      asset?.postiz?.publishAllowed !== false
    ) {
      throw new Error("production queue requires every packet to remain review-first");
    }
  }
}

function canMapDraftToUgc(draftBundle) {
  const task = draftBundle?.moneyprinterTask;
  const taskIsCompleteOrAbsent =
    !task || (task.state === 1 && task.progress === 100 && task.crossPostResults == null);

  return (
    draftBundle?.reviewStatus?.status === "needs_review" &&
    draftBundle?.postizHandoff?.status === "needs_review" &&
    draftBundle?.postizHandoff?.review?.notLiveConfirmed === true &&
    !draftBundle?.postizHandoff?.scheduledFor &&
    taskIsCompleteOrAbsent
  );
}

function canMapStaticPostReviewAsset(staticPostReviewAsset, packet) {
  return (
    packet?.contentType === "normal_post" &&
    staticPostReviewAsset?.packageType === "social_studio_static_post_review_asset" &&
    staticPostReviewAsset?.assetId === packet.assetId &&
    staticPostReviewAsset?.contentType === "normal_post" &&
    staticPostReviewAsset?.status === "needs_review" &&
    staticPostReviewAsset?.networkCallsAllowed === false &&
    staticPostReviewAsset?.publishAllowed === false &&
    staticPostReviewAsset?.postizStatus === "blocked_until_approved" &&
    Boolean(staticPostReviewAsset?.media?.imageUrl)
  );
}

function canMapPaidAdVideoReviewAsset(paidAdVideoReviewAsset, packet) {
  return (
    packet?.contentType === "paid_ad_video" &&
    paidAdVideoReviewAsset?.packageType === "social_studio_paid_ad_video_review_asset" &&
    paidAdVideoReviewAsset?.assetId === packet.assetId &&
    paidAdVideoReviewAsset?.contentType === "paid_ad_video" &&
    paidAdVideoReviewAsset?.status === "needs_review" &&
    paidAdVideoReviewAsset?.networkCallsAllowed === false &&
    paidAdVideoReviewAsset?.publishAllowed === false &&
    paidAdVideoReviewAsset?.postizStatus === "blocked_until_approved" &&
    Boolean(paidAdVideoReviewAsset?.media?.videoUrl)
  );
}

function summarizeItems(items) {
  return {
    totalAssets: items.length,
    generatedAssets: items.filter((item) => item.state === "generated_needs_review").length,
    needsReview: items.filter((item) => item.review.status === "needs_review" && item.generated.mediaPresent).length,
    packetReady: items.filter((item) => item.state === "packet_ready").length,
    publishAllowed: items.filter((item) => item.postiz.publishAllowed).length
  };
}

function makeUiSummary(queue) {
  return {
    campaignId: queue.campaignId,
    status: queue.status,
    noLivePosting: queue.safety.noLivePosting,
    postizBlockedUntilApproval: queue.safety.postizBlockedUntilApproval,
    summary: queue.summary,
    items: queue.items.map((item) => ({
      assetId: item.assetId,
      label: item.label,
      contentType: item.contentType,
      packetType: item.packetType,
      generator: item.generator,
      state: item.state,
      mediaPresent: item.generated.mediaPresent,
      reviewAssetId: item.generated.reviewAssetId || "",
      mediaType: item.generated.mediaType || "",
      videoUrl: item.generated.videoUrl || "",
      imageUrl: item.generated.imageUrl || "",
      storyboardUrl: item.generated.storyboardUrl || "",
      reviewStatus: item.review.status,
      postizStatus: item.postiz.status,
      publishAllowed: item.postiz.publishAllowed,
      nextAction: item.nextAction
    }))
  };
}

function makeMarkdown(queue) {
  const lines = [
    "# Crystal Clawz Production Queue",
    "",
    `Generated: ${queue.generatedAt}`,
    `Campaign: ${queue.campaignId}`,
    `Status: ${queue.status}`,
    "",
    "## Summary",
    "",
    `- Total assets: ${queue.summary.totalAssets}`,
    `- Generated assets: ${queue.summary.generatedAssets}`,
    `- Packet ready: ${queue.summary.packetReady}`,
    `- Publish allowed: ${queue.summary.publishAllowed}`,
    "",
    "## Queue",
    ""
  ];

  for (const item of queue.items) {
    lines.push(
      `### ${item.label}`,
      "",
      `- State: ${item.state}`,
      `- Packet: ${item.packetType}`,
      `- Review: ${item.review.status}`,
      `- Postiz: ${item.postiz.status}`,
      `- Next: ${item.nextAction}`,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

async function makeQueueItem(packet, draftBundle, mapCurrentDraft, staticPostReviewAsset, paidAdVideoReviewAsset) {
  const mediaPath = draftBundle?.postizHandoff?.media?.localPath || "";
  const draftMapsToItem = mapCurrentDraft && packet.contentType === "ugc_video";
  const staticAssetMapsToItem = canMapStaticPostReviewAsset(staticPostReviewAsset, packet);
  const paidAdAssetMapsToItem = canMapPaidAdVideoReviewAsset(paidAdVideoReviewAsset, packet);
  const ugcMediaPresent = draftMapsToItem && (await fileSize(mediaPath)) > 0;
  const mediaPresent = ugcMediaPresent || staticAssetMapsToItem || paidAdAssetMapsToItem;
  const state = mediaPresent ? "generated_needs_review" : "packet_ready";
  const isStaticPostReviewAsset = staticAssetMapsToItem && !ugcMediaPresent;
  const isPaidAdReviewAsset = paidAdAssetMapsToItem && !ugcMediaPresent;

  return {
    assetId: packet.assetId,
    contentType: packet.contentType,
    label: packet.label,
    packetType: packet.packetType,
    generator: packet.generator,
    state,
    generated: {
      currentDraftAssetId: ugcMediaPresent ? draftBundle.assetId : "",
      reviewAssetId: isStaticPostReviewAsset
        ? staticPostReviewAsset.assetId
        : isPaidAdReviewAsset
          ? paidAdVideoReviewAsset.assetId
          : "",
      mediaPresent,
      mediaType: isStaticPostReviewAsset
        ? staticPostReviewAsset.media?.mediaType || "image"
        : isPaidAdReviewAsset
          ? paidAdVideoReviewAsset.media?.mediaType || "video"
          : ugcMediaPresent
            ? "video"
            : "",
      videoUrl: isPaidAdReviewAsset ? paidAdVideoReviewAsset.media?.videoUrl || "" : "",
      imageUrl: isStaticPostReviewAsset ? staticPostReviewAsset.media?.imageUrl || "" : "",
      storyboardUrl: isPaidAdReviewAsset ? paidAdVideoReviewAsset.media?.storyboardUrl || "" : "",
      taskId: ugcMediaPresent ? draftBundle.moneyprinterTask?.taskId || "" : ""
    },
    review: {
      required: true,
      status: ugcMediaPresent ? draftBundle.reviewStatus?.status || "needs_review" : packet.review?.status || "needs_review",
      reviewer: ugcMediaPresent ? draftBundle.reviewStatus?.reviewer || "pending-human-review" : "pending-human-review"
    },
    postiz: {
      status: "blocked_until_approved",
      draftCreationAllowed: false,
      scheduleAllowed: false,
      publishAllowed: false
    },
    nextAction: ugcMediaPresent
      ? "Review the generated MP4/contact sheet and record approve, needs_revision, or reject."
      : isStaticPostReviewAsset
        ? "Review the generated static post image and caption, then record approve, needs_revision, or reject."
        : isPaidAdReviewAsset
          ? "Review the generated paid ad video draft and storyboard, then record approve, needs_revision, or reject."
      : "Produce this packet, then route the output through human review."
  };
}

export async function buildProductionQueue({
  productionPackets,
  draftBundle,
  staticPostReviewAsset = null,
  paidAdVideoReviewAsset = null,
  generatedAt = new Date().toISOString()
}) {
  assertReviewFirstPackets(productionPackets);
  const mapCurrentDraft = canMapDraftToUgc(draftBundle);
  const items = [];
  for (const packet of productionPackets.assets) {
    items.push(await makeQueueItem(packet, draftBundle, mapCurrentDraft, staticPostReviewAsset, paidAdVideoReviewAsset));
  }
  const queue = {
    packageType: "social_studio_production_queue",
    generatedAt,
    campaignId: productionPackets.campaignId,
    status: "needs_review",
    safety: {
      noLivePosting: true,
      networkCallsAllowed: false,
      postizBlockedUntilApproval: true,
      scheduleAllowed: false,
      publishAllowed: false
    },
    summary: summarizeItems(items),
    items
  };
  queue.uiSummary = makeUiSummary(queue);
  queue.markdown = makeMarkdown(queue);
  return queue;
}

export async function buildProductionQueueFromFiles({
  productionPacketsPath,
  draftBundlePath,
  staticPostReviewAssetPath = "",
  paidAdVideoReviewAssetPath = "",
  outDir,
  generatedAt
}) {
  const queue = await buildProductionQueue({
    productionPackets: JSON.parse(await readFile(productionPacketsPath, "utf8")),
    draftBundle: (await exists(draftBundlePath)) ? JSON.parse(await readFile(draftBundlePath, "utf8")) : null,
    staticPostReviewAsset: (await exists(staticPostReviewAssetPath))
      ? JSON.parse(await readFile(staticPostReviewAssetPath, "utf8"))
      : null,
    paidAdVideoReviewAsset: (await exists(paidAdVideoReviewAssetPath))
      ? JSON.parse(await readFile(paidAdVideoReviewAssetPath, "utf8"))
      : null,
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "production-queue.json"), `${JSON.stringify(queue, null, 2)}\n`);
  await writeFile(path.join(outDir, "production-queue.ui.json"), `${JSON.stringify(queue.uiSummary, null, 2)}\n`);
  await writeFile(path.join(outDir, "production-queue.md"), queue.markdown);

  return {
    status: queue.status,
    jsonPath: path.join(outDir, "production-queue.json"),
    uiPath: path.join(outDir, "production-queue.ui.json"),
    markdownPath: path.join(outDir, "production-queue.md")
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildProductionQueueFromFiles({
    productionPacketsPath: readArg("production-packets", path.join(generatedDir, "production-packets", "production-packets.json")),
    draftBundlePath: readArg("draft-bundle", path.join(generatedDir, "draft-bundle.json")),
    staticPostReviewAssetPath: readArg(
      "static-post-review-asset",
      path.join(generatedDir, "normal-post-review", "normal-post-review.json")
    ),
    paidAdVideoReviewAssetPath: readArg(
      "paid-ad-video-review-asset",
      path.join(generatedDir, "paid-ad-video-review", "paid-ad-video-review.json")
    ),
    outDir: readArg("out-dir", path.join(generatedDir, "production-queue"))
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
