import { access, appendFile, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkspaceRoot = path.resolve(__dirname, "..");
const CAMPAIGN_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function httpError(message, statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function requireValidCampaignId(campaignId) {
  const clean = String(campaignId || "").trim();
  if (!CAMPAIGN_ID_PATTERN.test(clean)) {
    throw httpError("invalid campaign id", 400);
  }
  return clean;
}

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function resolveSourcePath(filePath, workspaceRoot) {
  const clean = String(filePath || "").trim();
  if (!clean) {
    throw httpError("rendered reel filePath is required", 400);
  }
  if (path.isAbsolute(clean)) {
    return path.resolve(clean);
  }
  return path.resolve(workspaceRoot, clean.replace(/[\\/]+/g, path.sep));
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function auditPathFor(sourcePath, workspaceRoot) {
  if (sourcePath === workspaceRoot || isWithin(workspaceRoot, sourcePath)) {
    return normalizeSlashes(path.relative(workspaceRoot, sourcePath));
  }
  return sourcePath;
}

async function assertRenderableMp4(sourcePath, workspaceRoot) {
  if (path.extname(sourcePath).toLowerCase() !== ".mp4") {
    throw httpError("rendered reel must be an mp4 file", 400);
  }

  const moneyPrinterStorageRoot = path.resolve(workspaceRoot, "MoneyPrinterTurbo", "storage");
  if (!isWithin(workspaceRoot, sourcePath) && !isWithin(moneyPrinterStorageRoot, sourcePath)) {
    throw httpError("rendered reel path is outside the allowed roots", 403);
  }

  try {
    const info = await stat(sourcePath);
    if (!info.isFile() || info.size <= 0) {
      throw httpError("rendered reel mp4 is empty", 400);
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw httpError(`rendered reel mp4 not found: ${sourcePath}`, 404);
    }
    throw error;
  }
}

function updateReviewBoard(reviewBoard, { reelUrl, reelWorkspacePath }) {
  const items = Array.isArray(reviewBoard?.items) ? reviewBoard.items : [];
  const reelItem = items.find((item) => item?.contentType === "ugc_video");
  if (!reelItem) {
    throw httpError("campaign review board does not have a ugc_video item", 422);
  }

  reelItem.label = reelItem.label || "Reel";
  reelItem.reviewAction = "review_decision_required";
  reelItem.media = {
    ...(reelItem.media || {}),
    localPath: reelWorkspacePath,
    videoUrl: reelUrl,
    imageUrl: "",
    contactSheetUrl: reelItem.media?.contactSheetUrl || ""
  };
  reelItem.postiz = {
    ...(reelItem.postiz || {}),
    publishAllowed: false
  };
  return reviewBoard;
}

function updateReviewPacket(reviewPacket, { campaignId, reelUrl }) {
  const assets = Array.isArray(reviewPacket.assets) ? reviewPacket.assets : [];
  let reelAsset = assets.find((asset) => asset?.contentType === "ugc_video");
  if (!reelAsset) {
    reelAsset = {
      assetId: `${campaignId}-ugc-video-01`,
      contentType: "ugc_video",
      contactSheetUrl: ""
    };
    assets.push(reelAsset);
  }
  reelAsset.label = "Reel";
  reelAsset.assetUrl = reelUrl;
  reelAsset.contactSheetUrl = reelAsset.contactSheetUrl || "";
  reviewPacket.assets = assets;
  reviewPacket.visualReviewSummary =
    "Rendered reel is attached. Review the reel and normal post before deciding. Approval remains manual Postiz draft upload only; no scheduling or publishing is enabled.";
  return reviewPacket;
}

function updateWorkflowStatus(workflowStatus) {
  const stages = Array.isArray(workflowStatus.stages) ? workflowStatus.stages : [];
  const reelStage = stages.find((stage) => stage?.name === "Reel render");
  if (reelStage) {
    reelStage.status = "ready";
    reelStage.label = "Rendered reel is attached and ready for human review.";
  }
  workflowStatus.stages = stages;
  workflowStatus.blocker = "Human review is required before Postiz draft creation.";
  workflowStatus.nextAction = "Review the attached reel and normal post, then record approve, needs_revision, or reject.";
  workflowStatus.postizDraftReady = false;
  workflowStatus.scheduleOrPublishReady = false;
  return workflowStatus;
}

export async function attachRenderedReel({
  workspaceRoot = defaultWorkspaceRoot,
  campaignId,
  filePath,
  attachedAt = new Date().toISOString(),
  authenticatedEmail = ""
}) {
  const cleanCampaignId = requireValidCampaignId(campaignId);
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const campaignDir = path.join(resolvedWorkspaceRoot, "social-studio", "generated", cleanCampaignId);
  const draftBundlePath = path.join(campaignDir, "draft-bundle.json");
  const approvedBundlePath = path.join(campaignDir, "approved-bundle.json");
  const reviewBoardPath = path.join(campaignDir, "review-board", "review-board.json");
  const reviewPacketPath = path.join(campaignDir, "review-packet", "review-packet.ui.json");
  const workflowStatusPath = path.join(campaignDir, "workflow-status.ui.json");

  if (!(await fileExists(draftBundlePath))) {
    throw httpError("campaign draft bundle not found", 404);
  }
  if (await fileExists(approvedBundlePath)) {
    throw httpError("campaign already has an approved bundle; rendered reels cannot be attached after approval", 409);
  }

  const sourcePath = resolveSourcePath(filePath, resolvedWorkspaceRoot);
  await assertRenderableMp4(sourcePath, resolvedWorkspaceRoot);

  const reviewBoard = await readJson(reviewBoardPath);
  const reviewPacket = await readJson(reviewPacketPath);
  const workflowStatus = await readJson(workflowStatusPath);

  const reelFileName = "reel-01.mp4";
  const reelUrl = `/social-studio/${cleanCampaignId}/review/${reelFileName}`;
  const reelWorkspacePath = `public/social-studio/${cleanCampaignId}/review/${reelFileName}`;
  const publicReelPath = path.join(resolvedWorkspaceRoot, reelWorkspacePath.replace(/\//g, path.sep));

  await mkdir(path.dirname(publicReelPath), { recursive: true });
  await copyFile(sourcePath, publicReelPath);

  await writeJson(reviewBoardPath, updateReviewBoard(reviewBoard, { reelUrl, reelWorkspacePath }));
  await writeJson(reviewPacketPath, updateReviewPacket(reviewPacket, { campaignId: cleanCampaignId, reelUrl }));
  await writeJson(workflowStatusPath, updateWorkflowStatus(workflowStatus));

  const auditRoot = path.join(resolvedWorkspaceRoot, "social-studio", "audit");
  await mkdir(auditRoot, { recursive: true });
  await appendFile(
    path.join(auditRoot, `${cleanCampaignId}.decisions.jsonl`),
    `${JSON.stringify({
      at: attachedAt,
      campaignId: cleanCampaignId,
      event: "reel_attached",
      sourcePath: auditPathFor(sourcePath, resolvedWorkspaceRoot),
      reelUrl,
      authenticatedEmail: String(authenticatedEmail || ""),
      allowsSchedulingOrPublishing: false
    })}\n`
  );

  return {
    ok: true,
    campaignId: cleanCampaignId,
    sourcePath,
    reelUrl,
    boundary: "Manual Postiz draft upload only. No scheduling. No publishing."
  };
}
