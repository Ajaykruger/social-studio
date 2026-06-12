import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildManualPostizPackage } from "../handoff/postiz/build-manual-package.mjs";
import { buildWorkflowStatusFromFiles } from "./build-workflow-status.mjs";
import {
  applyReviewDecision,
  approvalEvidenceRequirementsFor
} from "./record-review-decision.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");
const defaultWorkspaceRoot = path.resolve(studioRoot, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function bundleNameForDecision(decision) {
  if (decision === "approve") return "approved-bundle.json";
  if (decision === "reject") return "rejected-bundle.json";
  return "revision-bundle.json";
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJsonIfExists(filePath) {
  if (!filePath) return null;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function localPathFromPublicUrl(publicUrl, workspaceRoot) {
  const clean = String(publicUrl || "").trim();
  if (!clean.startsWith("/")) return "";
  return path.join(workspaceRoot, "public", clean.slice(1).replace(/\//g, path.sep));
}

function assetFileUrl(media = {}) {
  return String(media.videoUrl || media.imageUrl || "").trim();
}

function mediaTypeFor(media = {}) {
  return media.videoUrl ? "video" : "image";
}

function supportingAssetsFor(media = {}, primaryUrl = "", workspaceRoot) {
  return [
    ["contact_sheet", media.contactSheetUrl],
    ["storyboard", media.imageUrl && media.imageUrl !== primaryUrl ? media.imageUrl : ""]
  ]
    .filter(([, url]) => String(url || "").trim())
    .map(([type, url]) => ({
      type,
      assetUrl: url,
      localPath: localPathFromPublicUrl(url, workspaceRoot)
    }));
}

function reviewAssetsFromReviewBoard(reviewBoard, workspaceRoot) {
  const items = Array.isArray(reviewBoard?.items) ? reviewBoard.items : [];
  return items
    .filter((item) => item?.reviewAction === "review_decision_required")
    .filter((item) => item?.postiz?.publishAllowed !== true)
    .map((item, index) => {
      const media = item.media || {};
      const assetUrl = assetFileUrl(media);
      return {
        assetId: item.assetId || `${item.contentType || "asset"}-${index + 1}`,
        label: item.label || item.contentType || `Asset ${index + 1}`,
        contentType: item.contentType || "asset",
        mediaType: mediaTypeFor(media),
        localPath: media.localPath || localPathFromPublicUrl(assetUrl, workspaceRoot),
        assetUrl,
        supportingAssets: supportingAssetsFor(media, assetUrl, workspaceRoot)
      };
    })
    .filter((asset) => asset.assetUrl || asset.localPath);
}

export const APPROVAL_EVIDENCE_GATES = [
  "UGC video evidence reviewed",
  "Paid ad video evidence reviewed",
  "Normal post evidence reviewed",
  "Artifact freshness checked",
  "Rollback and not-live proof reviewed",
  "Approved for Postiz draft upload only"
];

function approvalGateIsCovered(evidence, requirement, reviewAssets) {
  if (!evidence.toLowerCase().includes(requirement.label.toLowerCase())) return false;
  if (requirement.contentType) {
    return reviewAssets.some((asset) => asset.contentType === requirement.contentType);
  }
  return true;
}

function makeApprovalEvidenceSummary(bundle, reviewAssets) {
  const evidence = String(bundle.reviewStatus?.approval?.approvalEvidence || "");
  const gates = approvalEvidenceRequirementsFor(bundle).map((requirement) => {
    const covered = approvalGateIsCovered(evidence, requirement, reviewAssets);
    return {
      label: requirement.label,
      status: covered ? "covered" : "blocked"
    };
  });
  const coveredGates = gates.filter((gate) => gate.status === "covered").length;
  return {
    status: coveredGates === gates.length ? "covered" : "blocked",
    summary: {
      totalGates: gates.length,
      coveredGates,
      blockedGates: gates.length - coveredGates,
      reviewedAssets: reviewAssets.length
    },
    gates
  };
}

const LEGACY_REQUIRED_CONTENT_TYPES = ["ugc_video", "paid_ad_video", "normal_post"];

function requiredContentTypesFor(bundle) {
  // Campaigns created by the Create screen declare which asset types they
  // contain; the original demo campaign predates that field and keeps the
  // strict three-asset requirement.
  const declared = bundle?.postizHandoff?.requiredContentTypes;
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.map(String);
  }
  return LEGACY_REQUIRED_CONTENT_TYPES;
}

function assertReviewBoardAssetsReady(reviewAssets, requiredTypes) {
  const presentTypes = new Set(reviewAssets.map((asset) => asset.contentType));
  const missingTypes = requiredTypes.filter((contentType) => !presentTypes.has(contentType));
  if (missingTypes.length > 0) {
    throw new Error(`approval requires review board assets for: ${missingTypes.join(", ")}`);
  }
}

async function addReviewAssetsFromBoard(bundle, { reviewBoardPath, outDir, workspaceRoot }) {
  const resolvedReviewBoardPath =
    reviewBoardPath || path.join(outDir, "review-board", "review-board.json");
  const reviewBoard = await readJsonIfExists(resolvedReviewBoardPath);
  const reviewAssets = reviewAssetsFromReviewBoard(reviewBoard, workspaceRoot);
  assertReviewBoardAssetsReady(reviewAssets, requiredContentTypesFor(bundle));

  return {
    ...bundle,
    postizHandoff: {
      ...bundle.postizHandoff,
      reviewAssets
    },
    reviewStatus: {
      ...bundle.reviewStatus,
      approval: {
        ...(bundle.reviewStatus?.approval || {}),
        reviewedAssets: reviewAssets.map((asset) => ({
          assetId: asset.assetId,
          contentType: asset.contentType,
          label: asset.label
        })),
        evidenceSummary: makeApprovalEvidenceSummary(bundle, reviewAssets),
        scope: {
          approvedFor: "postiz_draft_upload_only",
          allowsSchedulingOrPublishing: false,
          requiresSeparateScheduleOrPublishApproval: true
        }
      }
    }
  };
}

export async function runReviewDecisionCycle({
  input,
  outDir,
  manualPackageDir = "",
  reviewBoardPath = "",
  workspaceRoot = defaultWorkspaceRoot,
  decision,
  reviewer,
  evidence,
  approvedAt,
  notes
}) {
  const bundle = JSON.parse(await readFile(input, "utf8"));
  let updated = applyReviewDecision(bundle, {
    decision,
    reviewer,
    evidence,
    approvedAt,
    notes
  });

  const resolvedOutDir = outDir || path.dirname(input);
  if (decision === "approve") {
    updated = await addReviewAssetsFromBoard(updated, {
      reviewBoardPath,
      outDir: resolvedOutDir,
      workspaceRoot
    });
  }
  const bundlePath = path.join(resolvedOutDir, bundleNameForDecision(decision));
  await writeJson(bundlePath, updated);

  let manualPackagePath = "";
  if (decision === "approve") {
    const resolvedManualPackageDir =
      manualPackageDir ||
      path.join(studioRoot, "handoff", "postiz", "approved", updated.campaignId);
    await buildManualPostizPackage({
      bundle: updated,
      outDir: resolvedManualPackageDir,
      workspaceRoot
    });
    manualPackagePath = resolvedManualPackageDir;
  }

  const statusResult = await buildWorkflowStatusFromFiles({
    bundlePath,
    jsonOut: path.join(resolvedOutDir, "workflow-status.json"),
    uiOut: path.join(resolvedOutDir, "workflow-status.ui.json"),
    markdownOut: path.join(resolvedOutDir, "workflow-status.md")
  });

  return {
    decision,
    bundlePath,
    manualPackagePath,
    status: statusResult.status,
    statusPath: statusResult.jsonOut,
    statusUiPath: statusResult.uiOut,
    statusMarkdownPath: statusResult.markdownOut
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const input = readArg("input", path.join(generatedDir, "draft-bundle.json"));
  const outDir = readArg("out-dir", generatedDir);
  const result = await runReviewDecisionCycle({
    input,
    outDir,
    manualPackageDir: readArg(
      "manual-package-dir",
      path.join(studioRoot, "handoff", "postiz", "approved", campaignId)
    ),
    reviewBoardPath: readArg("review-board", ""),
    decision: readArg("decision"),
    reviewer: readArg("reviewer"),
    evidence: readArg("evidence"),
    approvedAt: readArg("approved-at", new Date().toISOString()),
    notes: readArg("notes")
  });

  console.log(`bundle=${result.bundlePath}`);
  console.log(`status=${result.status}`);
  console.log(`status_json=${result.statusPath}`);
  console.log(`status_ui=${result.statusUiPath}`);
  console.log(`status_markdown=${result.statusMarkdownPath}`);
  console.log(`manual_package=${result.manualPackagePath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
