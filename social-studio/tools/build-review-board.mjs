import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function assertReviewFirstQueue(productionQueue) {
  if (productionQueue?.packageType !== "social_studio_production_queue") {
    throw new Error("review board requires a production queue");
  }
  if (
    productionQueue?.safety?.noLivePosting !== true ||
    productionQueue?.safety?.postizBlockedUntilApproval !== true ||
    productionQueue?.summary?.publishAllowed !== 0
  ) {
    throw new Error("review board requires a review-first queue");
  }
  const items = Array.isArray(productionQueue.items) ? productionQueue.items : [];
  for (const item of items) {
    if (item?.postiz?.publishAllowed !== false || item?.postiz?.status !== "blocked_until_approved") {
      throw new Error("review board requires every queue item to remain review-first");
    }
  }
}

function assertSafeDecisionCommands(decisionCommands) {
  if (decisionCommands?.commandOnly !== true || decisionCommands?.liveActionsEnabled !== false) {
    throw new Error("review board requires copy-only decision commands");
  }
}

function decisionList(decisionCommands) {
  return (decisionCommands?.commands || []).map((command) => ({
    decision: command.decision,
    label: command.label,
    command: command.command
  }));
}

function mediaForItem(item, reviewPacket) {
  if (item.generated?.currentDraftAssetId && reviewPacket?.review?.decisionRequired === true) {
    return {
      videoUrl: reviewPacket.assets?.videoUrl || "",
      contactSheetUrl: reviewPacket.assets?.contactSheetUrl || "",
      imageUrl: ""
    };
  }
  if (item.generated?.reviewAssetId && item.generated?.videoUrl) {
    return {
      videoUrl: item.generated.videoUrl,
      contactSheetUrl: "",
      imageUrl: item.generated.storyboardUrl || ""
    };
  }
  if (item.generated?.reviewAssetId && item.generated?.imageUrl) {
    return {
      videoUrl: "",
      contactSheetUrl: "",
      imageUrl: item.generated.imageUrl
    };
  }
  return {
    videoUrl: "",
    contactSheetUrl: "",
    imageUrl: ""
  };
}

function makeBoardItem(item, reviewPacket, decisionCommands) {
  const generatedForReview = item.state === "generated_needs_review" && item.generated?.mediaPresent === true;
  const useVideoReviewPacket = Boolean(item.generated?.currentDraftAssetId);
  return {
    assetId: item.assetId,
    label: item.label,
    contentType: item.contentType,
    state: item.state,
    reviewAction: generatedForReview ? "review_decision_required" : "produce_before_review",
    media: mediaForItem(item, reviewPacket),
    review: {
      status: item.review?.status || "needs_review",
      reviewer: item.review?.reviewer || "pending-human-review"
    },
    postiz: {
      status: "blocked_until_approved",
      publishAllowed: false
    },
    decisions: generatedForReview ? decisionList(decisionCommands) : [],
    nextAction: generatedForReview
      ? useVideoReviewPacket
        ? reviewPacket?.review?.nextAction || item.nextAction
        : item.nextAction
      : item.nextAction
  };
}

function makeSummary(items) {
  return {
    totalAssets: items.length,
    decisionRequired: items.filter((item) => item.reviewAction === "review_decision_required").length,
    produceBeforeReview: items.filter((item) => item.reviewAction === "produce_before_review").length,
    publishAllowed: items.filter((item) => item.postiz.publishAllowed).length
  };
}

function makeUiSummary(board) {
  return {
    campaignId: board.campaignId,
    status: board.status,
    noLivePosting: board.safety.noLivePosting,
    liveActionsEnabled: board.safety.liveActionsEnabled,
    summary: board.summary,
    items: board.items.map((item) => ({
      assetId: item.assetId,
      label: item.label,
      contentType: item.contentType,
      state: item.state,
      reviewAction: item.reviewAction,
      reviewStatus: item.review.status,
      postizStatus: item.postiz.status,
      publishAllowed: item.postiz.publishAllowed,
      decisionCount: item.decisions.length,
      videoUrl: item.media.videoUrl,
      contactSheetUrl: item.media.contactSheetUrl,
      imageUrl: item.media.imageUrl,
      nextAction: item.nextAction
    }))
  };
}

function makeMarkdown(board) {
  const lines = [
    "# Crystal Clawz Review Board",
    "",
    `Generated: ${board.generatedAt}`,
    `Campaign: ${board.campaignId}`,
    `Status: ${board.status}`,
    "",
    "## Summary",
    "",
    `- Decision required: ${board.summary.decisionRequired}`,
    `- Produce before review: ${board.summary.produceBeforeReview}`,
    `- Publish allowed: ${board.summary.publishAllowed}`,
    "",
    "## Items",
    ""
  ];

  for (const item of board.items) {
    lines.push(
      `### ${item.label}`,
      "",
      `- State: ${item.state}`,
      `- Review action: ${item.reviewAction}`,
      `- Review status: ${item.review.status}`,
      `- Postiz: ${item.postiz.status}`,
      `- Decisions available: ${item.decisions.length}`,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

export function buildReviewBoard({
  productionQueue,
  reviewPacket,
  decisionCommands,
  generatedAt = new Date().toISOString()
}) {
  assertReviewFirstQueue(productionQueue);
  assertSafeDecisionCommands(decisionCommands);
  const items = productionQueue.items.map((item) => makeBoardItem(item, reviewPacket, decisionCommands));
  const board = {
    packageType: "social_studio_review_board",
    generatedAt,
    campaignId: productionQueue.campaignId,
    status: "needs_review",
    safety: {
      noLivePosting: true,
      liveActionsEnabled: false,
      postizBlockedUntilApproval: true,
      scheduleAllowed: false,
      publishAllowed: false
    },
    summary: makeSummary(items),
    items
  };
  board.uiSummary = makeUiSummary(board);
  board.markdown = makeMarkdown(board);
  return board;
}

export async function buildReviewBoardFromFiles({
  productionQueuePath,
  reviewPacketPath,
  decisionCommandsPath,
  outDir,
  generatedAt
}) {
  const board = buildReviewBoard({
    productionQueue: JSON.parse(await readFile(productionQueuePath, "utf8")),
    reviewPacket: JSON.parse(await readFile(reviewPacketPath, "utf8")),
    decisionCommands: JSON.parse(await readFile(decisionCommandsPath, "utf8")),
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "review-board.json"), `${JSON.stringify(board, null, 2)}\n`);
  await writeFile(path.join(outDir, "review-board.ui.json"), `${JSON.stringify(board.uiSummary, null, 2)}\n`);
  await writeFile(path.join(outDir, "review-board.md"), board.markdown);
  return {
    status: board.status,
    jsonPath: path.join(outDir, "review-board.json"),
    uiPath: path.join(outDir, "review-board.ui.json"),
    markdownPath: path.join(outDir, "review-board.md")
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildReviewBoardFromFiles({
    productionQueuePath: readArg("production-queue", path.join(generatedDir, "production-queue", "production-queue.json")),
    reviewPacketPath: readArg("review-packet", path.join(generatedDir, "review-packet", "review-packet.json")),
    decisionCommandsPath: readArg("decision-commands", path.join(generatedDir, "review-decision-commands", "review-decision-commands.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "review-board"))
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
