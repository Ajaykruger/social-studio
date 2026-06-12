import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildManualPostizPackage } from "../handoff/postiz/build-manual-package.mjs";
import { buildBrandClaimLedgerFromFiles } from "./build-brand-claim-ledger.mjs";
import { buildContentCoverageAuditFromFiles } from "./build-content-coverage-audit.mjs";
import { buildContentPlanFromFiles } from "./build-content-plan.mjs";
import { buildHumanApprovalHandoffFromFiles } from "./build-human-approval-handoff.mjs";
import { buildMvpCompletionAuditFromFiles } from "./build-mvp-completion-audit.mjs";
import { buildMvpFinishPathFromFiles } from "./build-mvp-finish-path.mjs";
import { buildMvpOperatorPacketFromFiles } from "./build-mvp-operator-packet.mjs";
import { buildMvpReadinessAuditFromFiles } from "./build-mvp-readiness-audit.mjs";
import { buildPostizCommandCenterFromFiles } from "./build-postiz-command-center.mjs";
import { buildPostizDryRunReadinessFromFiles } from "./build-postiz-dry-run-readiness.mjs";
import { buildPostizInputKitFromFiles } from "./build-postiz-input-kit.mjs";
import { validatePostizLocalInputsFromFiles } from "./validate-postiz-local-inputs.mjs";
import { buildPaidAdVideoReviewAssetFromFiles } from "./build-paid-ad-video-review-asset.mjs";
import { buildProductionPacketsFromFiles } from "./build-production-packets.mjs";
import { buildProductionQueueFromFiles } from "./build-production-queue.mjs";
import { buildReviewBoardFromFiles } from "./build-review-board.mjs";
import { buildReviewDecisionCommandsFromFiles } from "./build-review-decision-commands.mjs";
import { buildReviewPacketFromFiles } from "./build-review-packet.mjs";
import { buildStaticPostReviewAssetFromFiles } from "./build-static-post-review-asset.mjs";
import { buildWorkflowStatusFromFiles } from "./build-workflow-status.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(studioRoot, "..");

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

async function firstExistingPath(paths) {
  for (const filePath of paths) {
    if (await exists(filePath)) return filePath;
  }
  return paths[paths.length - 1];
}

function assertNeedsReviewRefresh(bundle) {
  if (bundle?.reviewStatus?.status !== "needs_review") {
    throw new Error("refresh current review state requires reviewStatus.status needs_review");
  }
  if (bundle?.postizHandoff?.status !== "needs_review") {
    throw new Error("refresh current review state requires postizHandoff.status needs_review");
  }
  if (bundle?.postizHandoff?.review?.notLiveConfirmed !== true) {
    throw new Error("refresh current review state requires notLiveConfirmed true");
  }
  if (bundle?.postizHandoff?.review?.approvedBy !== "pending-human-review") {
    throw new Error("refresh current review state requires pending-human-review, not an approval");
  }
  if (bundle?.postizHandoff?.scheduledFor) {
    throw new Error("refresh current review state cannot refresh scheduled content");
  }
  if (bundle?.moneyprinterTask?.crossPostResults !== null && bundle?.moneyprinterTask?.crossPostResults !== undefined) {
    throw new Error("refresh current review state cannot refresh content with cross-post results");
  }
}

async function assertNoPromotionArtifacts({ approvedBundlePath, postizDryRunPath }) {
  if (await exists(approvedBundlePath)) {
    throw new Error(`refresh current review state refuses existing approved bundle: ${approvedBundlePath}`);
  }
  if (await exists(postizDryRunPath)) {
    throw new Error(`refresh current review state refuses existing Postiz dry-run package: ${postizDryRunPath}`);
  }
}

function assetUrlFromMedia(media = {}) {
  return String(media.videoUrl || media.imageUrl || "").trim();
}

function mediaTypeFromMedia(media = {}) {
  return media.videoUrl ? "video" : "image";
}

function localPathFromPublicReviewUrl(publicUrl, { publicUrlBase, publicOutDir }) {
  const clean = String(publicUrl || "").trim();
  if (!clean.startsWith("/")) return "";
  const base = String(publicUrlBase || "").replace(/\/$/, "");
  if (base && clean.startsWith(`${base}/`)) {
    const relative = clean.slice(base.length + 1).replace(/\//g, path.sep);
    return path.join(publicOutDir, relative);
  }
  return path.join(projectRoot, "public", clean.slice(1).replace(/\//g, path.sep));
}

function supportingAssetsFromMedia(media = {}, primaryUrl = "", pathContext) {
  return [
    ["contact_sheet", media.contactSheetUrl],
    ["storyboard", media.imageUrl && media.imageUrl !== primaryUrl ? media.imageUrl : ""]
  ]
    .filter(([, url]) => String(url || "").trim())
    .map(([type, assetUrl]) => ({
      type,
      assetUrl,
      localPath: localPathFromPublicReviewUrl(assetUrl, pathContext)
    }));
}

function reviewAssetsFromReviewBoard(reviewBoard, pathContext) {
  const items = Array.isArray(reviewBoard?.items) ? reviewBoard.items : [];
  return items
    .filter((item) => item?.reviewAction === "review_decision_required")
    .filter((item) => item?.postiz?.publishAllowed !== true)
    .map((item, index) => {
      const media = item.media || {};
      const assetUrl = assetUrlFromMedia(media);
      return {
        assetId: item.assetId || `${item.contentType || "asset"}-${index + 1}`,
        label: item.label || item.contentType || `Asset ${index + 1}`,
        contentType: item.contentType || "asset",
        mediaType: mediaTypeFromMedia(media),
        localPath: media.localPath || localPathFromPublicReviewUrl(assetUrl, pathContext),
        assetUrl,
        supportingAssets: supportingAssetsFromMedia(media, assetUrl, pathContext)
      };
    })
    .filter((asset) => asset.assetUrl || asset.localPath);
}

function bundleWithReviewBoardAssets(bundle, reviewBoard, pathContext) {
  const reviewAssets = reviewAssetsFromReviewBoard(reviewBoard, pathContext);
  if (reviewAssets.length === 0) return bundle;
  return {
    ...bundle,
    postizHandoff: {
      ...bundle.postizHandoff,
      reviewAssets
    }
  };
}

function verificationFromArgs() {
  const yes = (name) => readArg(name, "false") === "true";
  return {
    testsPassing: yes("tests-passing"),
    buildPassing: yes("build-passing"),
    secretScanPassing: yes("secret-scan-passing"),
    pathLeakScanPassing: yes("path-leak-scan-passing")
  };
}

export async function refreshCurrentReviewState({
  bundlePath,
  briefPath = path.join(studioRoot, "examples", "rubber-base-campaign-brief.example.json"),
  productPath = path.join(studioRoot, "examples", "rubber-base-product-input.example.json"),
  brandContextPath = path.join(studioRoot, "brand-brain", "brand-context-index.md"),
  mvpPlanPath = path.join(studioRoot, "plans", "mvp-plan.md"),
  requestTemplatePath = path.join(studioRoot, "connectors", "moneyprinter", "request.example.json"),
  postizIntegrationsPath = "",
  postizUploadedMediaPath = "",
  generatedDir = "",
  manualPackageDir = "",
  contactSheetPath,
  visualReviewPath = "",
  publicOutDir = "",
  publicUrlBase = "",
  reviewer = "Andre",
  generatedAt = new Date().toISOString(),
  verification = {},
  paidAdVideoBuilder
}) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  assertNeedsReviewRefresh(bundle);

  const campaignId = bundle.campaignId;
  const resolvedGeneratedDir = generatedDir || path.join(studioRoot, "generated", campaignId);
  const resolvedManualPackageDir =
    manualPackageDir || path.join(studioRoot, "handoff", "postiz", "manual", campaignId);
  const resolvedPublicOutDir =
    publicOutDir || path.join(projectRoot, "public", "social-studio", campaignId, "review");
  const resolvedPublicUrlBase = publicUrlBase || `/social-studio/${campaignId}/review`;
  const approvedBundlePath = path.join(resolvedGeneratedDir, "approved-bundle.json");
  const postizDryRunPath = path.join(resolvedGeneratedDir, "postiz-draft.dry-run.json");
  const resolvedPostizIntegrationsPath =
    postizIntegrationsPath ||
    (await firstExistingPath([
      path.join(resolvedGeneratedDir, "postiz-input-kit", "integrations.local.json"),
      path.join(studioRoot, "handoff", "postiz", "api-draft", "integrations.example.json")
    ]));
  const resolvedPostizUploadedMediaPath =
    postizUploadedMediaPath ||
    (await firstExistingPath([
      path.join(resolvedGeneratedDir, "postiz-input-kit", "uploaded-media.local.json"),
      path.join(studioRoot, "handoff", "postiz", "api-draft", "uploaded-media.example.json")
    ]));

  await assertNoPromotionArtifacts({ approvedBundlePath, postizDryRunPath });
  const approvedBundleExistedBefore = await exists(approvedBundlePath);
  const postizDryRunExistedBefore = await exists(postizDryRunPath);

  const contentPlanResult = await buildContentPlanFromFiles({
    briefPath,
    productPath,
    outDir: path.join(resolvedGeneratedDir, "content-plan"),
    generatedAt
  });

  const brandClaimLedgerResult = await buildBrandClaimLedgerFromFiles({
    contentPlanPath: contentPlanResult.jsonPath,
    productPath,
    brandContextPath,
    outDir: path.join(resolvedGeneratedDir, "brand-claim-ledger"),
    generatedAt
  });

  const productionPacketsResult = await buildProductionPacketsFromFiles({
    contentPlanPath: contentPlanResult.jsonPath,
    requestTemplatePath,
    outDir: path.join(resolvedGeneratedDir, "production-packets"),
    generatedAt
  });

  const normalPostReviewResult = await buildStaticPostReviewAssetFromFiles({
    productionPacketsPath: productionPacketsResult.jsonPath,
    outDir: path.join(resolvedGeneratedDir, "normal-post-review"),
    publicOutDir: resolvedPublicOutDir,
    publicUrlBase: resolvedPublicUrlBase,
    generatedAt
  });

  const paidAdVideoReviewResult = await buildPaidAdVideoReviewAssetFromFiles({
    productionPacketsPath: productionPacketsResult.jsonPath,
    outDir: path.join(resolvedGeneratedDir, "paid-ad-video-review"),
    publicOutDir: resolvedPublicOutDir,
    publicUrlBase: resolvedPublicUrlBase,
    generatedAt,
    runVideoBuilder: paidAdVideoBuilder
  });

  const productionQueueResult = await buildProductionQueueFromFiles({
    productionPacketsPath: productionPacketsResult.jsonPath,
    draftBundlePath: bundlePath,
    staticPostReviewAssetPath: normalPostReviewResult.jsonPath,
    paidAdVideoReviewAssetPath: paidAdVideoReviewResult.jsonPath,
    outDir: path.join(resolvedGeneratedDir, "production-queue"),
    generatedAt
  });

  const contentCoverageResult = await buildContentCoverageAuditFromFiles({
    contentPlanPath: contentPlanResult.uiPath,
    productionQueuePath: productionQueueResult.uiPath,
    outDir: path.join(resolvedGeneratedDir, "content-coverage-audit"),
    generatedAt
  });

  const reviewPacketResult = await buildReviewPacketFromFiles({
    bundlePath,
    contactSheetPath,
    visualReviewPath,
    outDir: path.join(resolvedGeneratedDir, "review-packet"),
    publicOutDir: resolvedPublicOutDir,
    publicUrlBase: resolvedPublicUrlBase,
    generatedAt
  });

  const decisionCommandsResult = await buildReviewDecisionCommandsFromFiles({
    bundlePath,
    outDir: path.join(resolvedGeneratedDir, "review-decision-commands"),
    reviewer,
    generatedAt
  });

  const reviewBoardResult = await buildReviewBoardFromFiles({
    productionQueuePath: productionQueueResult.jsonPath,
    reviewPacketPath: reviewPacketResult.packetPath,
    decisionCommandsPath: path.join(decisionCommandsResult.outDir, "review-decision-commands.json"),
    outDir: path.join(resolvedGeneratedDir, "review-board"),
    generatedAt
  });

  const reviewBoard = JSON.parse(await readFile(reviewBoardResult.jsonPath, "utf8"));
  const manualPreviewBundle = bundleWithReviewBoardAssets(bundle, reviewBoard, {
    publicUrlBase: resolvedPublicUrlBase,
    publicOutDir: resolvedPublicOutDir
  });

  await buildManualPostizPackage({
    bundle: manualPreviewBundle,
    outDir: resolvedManualPackageDir
  });

  const workflowResult = await buildWorkflowStatusFromFiles({
    bundlePath,
    postizDryRunPath,
    jsonOut: path.join(resolvedGeneratedDir, "workflow-status.json"),
    uiOut: path.join(resolvedGeneratedDir, "workflow-status.ui.json"),
    markdownOut: path.join(resolvedGeneratedDir, "workflow-status.md"),
    generatedAt,
    artifactPresence: {
      brandContext: await exists(brandContextPath),
      manualPackage: await exists(path.join(resolvedManualPackageDir, "manifest.json")),
      moneyprinterVideo: (await fileSize(bundle.postizHandoff?.media?.localPath)) > 0,
      postizDryRunPackage: false
    }
  });

  const auditResult = await buildMvpReadinessAuditFromFiles({
    workflowStatusPath: workflowResult.jsonOut,
    reviewPacketPath: reviewPacketResult.packetPath,
    manualManifestPath: path.join(resolvedManualPackageDir, "manifest.json"),
    contentPlanPath: contentPlanResult.jsonPath,
    brandClaimLedgerPath: brandClaimLedgerResult.jsonPath,
    productionPacketsPath: productionPacketsResult.jsonPath,
    productionQueuePath: productionQueueResult.jsonPath,
    reviewBoardPath: reviewBoardResult.jsonPath,
    postizDryRunPath,
    jsonOut: path.join(resolvedGeneratedDir, "mvp-readiness-audit.json"),
    markdownOut: path.join(resolvedGeneratedDir, "mvp-readiness-audit.md"),
    verification,
    generatedAt
  });

  const postizInputKitResult = await buildPostizInputKitFromFiles({
    bundlePath,
    reviewBoardPath: reviewBoardResult.jsonPath,
    integrationsPath: resolvedPostizIntegrationsPath,
    uploadedMediaPath: resolvedPostizUploadedMediaPath,
    outDir: path.join(resolvedGeneratedDir, "postiz-input-kit"),
    generatedAt
  });

  const postizLocalValidationResult = await validatePostizLocalInputsFromFiles({
    bundlePath,
    reviewBoardPath: reviewBoardResult.jsonPath,
    integrationsPath: resolvedPostizIntegrationsPath,
    uploadedMediaPath: resolvedPostizUploadedMediaPath,
    outDir: path.join(resolvedGeneratedDir, "postiz-input-kit"),
    generatedAt
  });

  const postizReadinessResult = await buildPostizDryRunReadinessFromFiles({
    workflowStatusPath: workflowResult.jsonOut,
    integrationsPath: resolvedPostizIntegrationsPath,
    uploadedMediaPath: resolvedPostizUploadedMediaPath,
    approvedBundlePath,
    postizInputKitPath: postizInputKitResult.jsonPath,
    manualManifestPath: path.join(resolvedManualPackageDir, "manifest.json"),
    postizDryRunPath,
    outDir: path.join(resolvedGeneratedDir, "postiz-dry-run-readiness"),
    generatedAt
  });

  const postizCommandCenterResult = await buildPostizCommandCenterFromFiles({
    inputKitPath: postizInputKitResult.uiPath,
    readinessPath: postizReadinessResult.uiPath,
    approvedBundlePath,
    postizDryRunPath,
    outDir: path.join(resolvedGeneratedDir, "postiz-command-center"),
    generatedAt
  });

  const completionAuditResult = await buildMvpCompletionAuditFromFiles({
    goalText:
      "Build a Crystal Clawz Social Studio MVP that wires Postiz, MoneyPrinterTurbo, and brand files into a review-first content workflow.",
    mvpPlanPath,
    workflowStatusPath: workflowResult.jsonOut,
    readinessAuditPath: auditResult.jsonOut,
    postizInputKitPath: postizInputKitResult.uiPath,
    postizLocalValidationPath: postizLocalValidationResult.uiSummaryPath,
    postizReadinessPath: postizReadinessResult.uiPath,
    commandCenterPath: postizCommandCenterResult.uiPath,
    approvedBundlePath,
    postizDryRunPath,
    jsonOut: path.join(resolvedGeneratedDir, "mvp-completion-audit", "mvp-completion-audit.json"),
    uiOut: path.join(resolvedGeneratedDir, "mvp-completion-audit", "mvp-completion-audit.ui.json"),
    markdownOut: path.join(resolvedGeneratedDir, "mvp-completion-audit", "mvp-completion-audit.md"),
    generatedAt
  });

  const humanApprovalHandoffResult = await buildHumanApprovalHandoffFromFiles({
    reviewPacketPath: reviewPacketResult.uiPath,
    decisionCommandsPath: path.join(decisionCommandsResult.outDir, "review-decision-commands.ui.json"),
    brandClaimLedgerPath: brandClaimLedgerResult.uiPath,
    completionAuditPath: completionAuditResult.uiOut,
    reviewBoardPath: reviewBoardResult.uiPath,
    productionPacketsPath: productionPacketsResult.jsonPath,
    outDir: path.join(resolvedGeneratedDir, "human-approval-handoff"),
    generatedAt
  });

  const finishPathResult = await buildMvpFinishPathFromFiles({
    completionAuditPath: completionAuditResult.uiOut,
    humanApprovalHandoffPath: humanApprovalHandoffResult.uiPath,
    postizInputKitPath: postizInputKitResult.uiPath,
    postizReadinessPath: postizReadinessResult.uiPath,
    commandCenterPath: postizCommandCenterResult.uiPath,
    outDir: path.join(resolvedGeneratedDir, "mvp-finish-path"),
    generatedAt
  });

  const operatorPacketResult = await buildMvpOperatorPacketFromFiles({
    completionAuditPath: completionAuditResult.uiOut,
    finishPathPath: finishPathResult.uiPath,
    postizLocalValidationPath: postizLocalValidationResult.uiSummaryPath,
    humanApprovalHandoffPath: humanApprovalHandoffResult.uiPath,
    postizInputKitPath: postizInputKitResult.uiPath,
    outDir: path.join(resolvedGeneratedDir, "mvp-operator-packet"),
    generatedAt
  });

  return {
    campaignId,
    status: auditResult.status,
    completionStatus: completionAuditResult.status,
    workflowStatus: workflowResult.status,
    approvalCreated: !approvedBundleExistedBefore && (await exists(approvedBundlePath)),
    postizDryRunCreated: !postizDryRunExistedBefore && (await exists(postizDryRunPath)),
    paths: {
      manualPackageDir: resolvedManualPackageDir,
      contentPlan: contentPlanResult.jsonPath,
      contentPlanUi: contentPlanResult.uiPath,
      contentCoverage: contentCoverageResult.jsonPath,
      contentCoverageUi: contentCoverageResult.uiPath,
      brandClaimLedger: brandClaimLedgerResult.jsonPath,
      brandClaimLedgerUi: brandClaimLedgerResult.uiPath,
      productionPackets: productionPacketsResult.jsonPath,
      productionPacketsUi: productionPacketsResult.uiPath,
      normalPostReview: normalPostReviewResult.jsonPath,
      normalPostReviewUi: normalPostReviewResult.uiPath,
      paidAdVideoReview: paidAdVideoReviewResult.jsonPath,
      paidAdVideoReviewUi: paidAdVideoReviewResult.uiPath,
      productionQueue: productionQueueResult.jsonPath,
      productionQueueUi: productionQueueResult.uiPath,
      reviewBoard: reviewBoardResult.jsonPath,
      reviewBoardUi: reviewBoardResult.uiPath,
      postizInputKit: postizInputKitResult.jsonPath,
      postizInputKitUi: postizInputKitResult.uiPath,
      postizLocalInputValidation: postizLocalValidationResult.jsonPath,
      postizLocalInputValidationUi: postizLocalValidationResult.uiSummaryPath,
      postizDryRunReadiness: postizReadinessResult.jsonPath,
      postizDryRunReadinessUi: postizReadinessResult.uiPath,
      postizCommandCenter: postizCommandCenterResult.jsonPath,
      postizCommandCenterUi: postizCommandCenterResult.uiPath,
      mvpCompletionAudit: completionAuditResult.jsonOut,
      mvpCompletionAuditUi: completionAuditResult.uiOut,
      mvpFinishPath: finishPathResult.jsonPath,
      mvpFinishPathUi: finishPathResult.uiPath,
      mvpOperatorPacket: operatorPacketResult.jsonPath,
      mvpOperatorPacketUi: operatorPacketResult.uiPath,
      humanApprovalHandoff: humanApprovalHandoffResult.jsonPath,
      humanApprovalHandoffUi: humanApprovalHandoffResult.uiPath,
      reviewPacket: reviewPacketResult.packetPath,
      reviewPacketUi: reviewPacketResult.uiPath,
      decisionCommandsDir: decisionCommandsResult.outDir,
      workflowStatus: workflowResult.jsonOut,
      workflowStatusUi: workflowResult.uiOut,
      mvpReadinessAudit: auditResult.jsonOut,
      publicReviewDir: resolvedPublicOutDir
    }
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = readArg("generated-dir", path.join(studioRoot, "generated", campaignId));
  const result = await refreshCurrentReviewState({
    bundlePath: readArg("bundle", path.join(generatedDir, "draft-bundle.json")),
    briefPath: readArg("brief", path.join(studioRoot, "examples", "rubber-base-campaign-brief.example.json")),
    productPath: readArg("product", path.join(studioRoot, "examples", "rubber-base-product-input.example.json")),
    brandContextPath: readArg("brand-context", path.join(studioRoot, "brand-brain", "brand-context-index.md")),
    mvpPlanPath: readArg("mvp-plan", path.join(studioRoot, "plans", "mvp-plan.md")),
    requestTemplatePath: readArg("request", path.join(studioRoot, "connectors", "moneyprinter", "request.example.json")),
    postizIntegrationsPath: readArg("postiz-integrations", ""),
    postizUploadedMediaPath: readArg("postiz-uploaded-media", ""),
    generatedDir,
    manualPackageDir: readArg("manual-package-dir", path.join(studioRoot, "handoff", "postiz", "manual", campaignId)),
    contactSheetPath: readArg("contact-sheet", path.join(generatedDir, "visual-review", "contact_sheet.jpg")),
    visualReviewPath: readArg("visual-review", path.join(generatedDir, "visual-review", "visual-review.md")),
    publicOutDir: readArg("public-out-dir", path.join(projectRoot, "public", "social-studio", campaignId, "review")),
    publicUrlBase: readArg("public-url-base", `/social-studio/${campaignId}/review`),
    reviewer: readArg("reviewer", "Andre"),
    verification: verificationFromArgs()
  });

  console.log(`status=${result.status}`);
  console.log(`workflow_status=${result.workflowStatus}`);
  console.log(`content_plan=${result.paths.contentPlan}`);
  console.log(`content_coverage=${result.paths.contentCoverage}`);
  console.log(`brand_claim_ledger=${result.paths.brandClaimLedger}`);
  console.log(`production_packets=${result.paths.productionPackets}`);
  console.log(`normal_post_review=${result.paths.normalPostReview}`);
  console.log(`paid_ad_video_review=${result.paths.paidAdVideoReview}`);
  console.log(`production_queue=${result.paths.productionQueue}`);
  console.log(`review_board=${result.paths.reviewBoard}`);
  console.log(`postiz_input_kit=${result.paths.postizInputKit}`);
  console.log(`postiz_dry_run_readiness=${result.paths.postizDryRunReadiness}`);
  console.log(`postiz_command_center=${result.paths.postizCommandCenter}`);
  console.log(`completion_status=${result.completionStatus}`);
  console.log(`completion_audit=${result.paths.mvpCompletionAudit}`);
  console.log(`finish_path=${result.paths.mvpFinishPath}`);
  console.log(`human_approval_handoff=${result.paths.humanApprovalHandoff}`);
  console.log(`manual_package=${result.paths.manualPackageDir}`);
  console.log(`review_packet=${result.paths.reviewPacket}`);
  console.log(`decision_commands=${result.paths.decisionCommandsDir}`);
  console.log(`audit=${result.paths.mvpReadinessAudit}`);
  console.log(`approval_created=${result.approvalCreated}`);
  console.log(`postiz_dry_run_created=${result.postizDryRunCreated}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
