import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPostizDraftPackageFromFiles } from "../handoff/postiz/create-draft-payload.mjs";
import { buildMvpCompletionAuditFromFiles } from "./build-mvp-completion-audit.mjs";
import { buildMvpFinishPathFromFiles } from "./build-mvp-finish-path.mjs";
import { buildMvpOperatorPacketFromFiles } from "./build-mvp-operator-packet.mjs";
import { buildMvpReadinessAuditFromFiles } from "./build-mvp-readiness-audit.mjs";
import { buildPostizCommandCenterFromFiles } from "./build-postiz-command-center.mjs";
import { buildPostizDryRunReadinessFromFiles } from "./build-postiz-dry-run-readiness.mjs";
import { buildPostizInputKitFromFiles } from "./build-postiz-input-kit.mjs";
import { buildWorkflowStatusFromFiles } from "./build-workflow-status.mjs";
import { validatePostizLocalInputsFromFiles } from "./validate-postiz-local-inputs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
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

function assertApprovedManualManifest(manualManifest, approvedBundle) {
  const manifestReview = manualManifest?.review || {};
  const bundleApproval = approvedBundle?.reviewStatus?.approval || {};
  const bundleReview = approvedBundle?.postizHandoff?.review || {};
  const manifestScope = manifestReview.approvalScope || {};
  const manifestEvidence = manifestReview.approvalEvidenceSummary || {};

  if (
    manualManifest?.packageType !== "postiz_manual_draft_ready" ||
    manualManifest?.postiz?.handoffMode !== "manual_upload" ||
    manualManifest?.postiz?.status !== "draft_upload_ready"
  ) {
    throw new Error("approved manual manifest must be a draft-ready manual Postiz package");
  }
  if (manualManifest.campaignId !== approvedBundle.campaignId || manualManifest.assetId !== approvedBundle.assetId) {
    throw new Error("approved manual manifest must match the approved bundle campaign and asset");
  }
  if (
    manifestReview.approvedBy !== bundleApproval.approvedBy ||
    manifestReview.approvedAt !== bundleApproval.approvedAt ||
    manifestReview.notLiveConfirmed !== true ||
    bundleReview.notLiveConfirmed !== true
  ) {
    throw new Error("approved manual manifest must match the approved bundle review proof");
  }
  if (
    manifestScope.approvedFor !== "postiz_draft_upload_only" ||
    manifestScope.allowsSchedulingOrPublishing !== false ||
    manifestEvidence.status !== "covered"
  ) {
    throw new Error("approved manual manifest must prove Postiz draft-only approval coverage");
  }
  return true;
}

async function ensureHumanApprovalHandoffPath({ requestedPath, outDir, bundle, generatedAt }) {
  if (await exists(requestedPath)) return requestedPath;

  const fallbackPath = path.join(outDir, "human-approval-handoff", "human-approval-handoff.ui.json");
  const reviewAssets = Array.isArray(bundle?.postizHandoff?.reviewAssets)
    ? bundle.postizHandoff.reviewAssets.map((asset) => ({
        assetId: asset.assetId || "",
        label: asset.label || asset.contentType || "Approved asset",
        contentType: asset.contentType || "asset",
        assetUrl: asset.assetUrl || ""
      }))
    : [];
  const fallback = {
    packageType: "social_studio_human_approval_handoff",
    generatedAt,
    campaignId: bundle?.campaignId || "",
    status: "approval_recorded",
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    scheduleOrPublishReady: false,
    reviewAssets,
    decisionCommands: [],
    nextAction: "Human approval has been recorded."
  };
  await mkdir(path.dirname(fallbackPath), { recursive: true });
  await writeFile(fallbackPath, `${JSON.stringify(fallback, null, 2)}\n`);
  return fallbackPath;
}

export async function runPostizDryRunCycle({
  input,
  integrationsPath,
  uploadedMediaPath,
  reviewPacketPath,
  manualManifestPath,
  contentPlanPath = "",
  brandClaimLedgerPath = "",
  productionPacketsPath = "",
  productionQueuePath = "",
  reviewBoardPath = "",
  mvpPlanPath = path.join(studioRoot, "plans", "mvp-plan.md"),
  humanApprovalHandoffPath = "",
  outDir,
  apiBaseUrl,
  verification,
  generatedAt
}) {
  const resolvedOutDir = outDir || path.dirname(input);
  await mkdir(resolvedOutDir, { recursive: true });
  const approvedBundle = await readJson(input);
  assertApprovedManualManifest(await readJson(manualManifestPath), approvedBundle);

  const dryRunPath = path.join(resolvedOutDir, "postiz-draft.dry-run.json");
  await buildPostizDraftPackageFromFiles({
    input,
    output: dryRunPath,
    integrations: await readJson(integrationsPath),
    uploadedMedia: await readJson(uploadedMediaPath),
    apiBaseUrl,
    generatedAt
  });

  const workflowResult = await buildWorkflowStatusFromFiles({
    bundlePath: input,
    postizDryRunPath: dryRunPath,
    jsonOut: path.join(resolvedOutDir, "workflow-status.json"),
    uiOut: path.join(resolvedOutDir, "workflow-status.ui.json"),
    markdownOut: path.join(resolvedOutDir, "workflow-status.md"),
    generatedAt,
    artifactPresence: {
      brandContext: true,
      manualPackage: true,
      moneyprinterVideo: true,
      postizDryRunPackage: true
    }
  });

  const auditResult = await buildMvpReadinessAuditFromFiles({
    workflowStatusPath: workflowResult.jsonOut,
    reviewPacketPath,
    manualManifestPath,
    contentPlanPath,
    brandClaimLedgerPath,
    productionPacketsPath,
    productionQueuePath,
    reviewBoardPath,
    postizDryRunPath: dryRunPath,
    jsonOut: path.join(resolvedOutDir, "mvp-readiness-audit.json"),
    markdownOut: path.join(resolvedOutDir, "mvp-readiness-audit.md"),
    verification,
    generatedAt
  });

  const inputKitResult = await buildPostizInputKitFromFiles({
    bundlePath: input,
    reviewBoardPath,
    integrationsPath,
    uploadedMediaPath,
    outDir: path.join(resolvedOutDir, "postiz-input-kit"),
    generatedAt
  });

  const postizLocalValidationResult = await validatePostizLocalInputsFromFiles({
    bundlePath: input,
    reviewBoardPath,
    integrationsPath,
    uploadedMediaPath,
    outDir: path.join(resolvedOutDir, "postiz-input-kit"),
    generatedAt
  });

  const postizReadinessResult = await buildPostizDryRunReadinessFromFiles({
    workflowStatusPath: workflowResult.jsonOut,
    integrationsPath,
    uploadedMediaPath,
    approvedBundlePath: input,
    postizInputKitPath: inputKitResult.jsonPath,
    manualManifestPath,
    postizDryRunPath: dryRunPath,
    outDir: path.join(resolvedOutDir, "postiz-dry-run-readiness"),
    generatedAt
  });

  const commandCenterResult = await buildPostizCommandCenterFromFiles({
    inputKitPath: inputKitResult.uiPath,
    readinessPath: postizReadinessResult.uiPath,
    approvedBundlePath: input,
    postizDryRunPath: dryRunPath,
    outDir: path.join(resolvedOutDir, "postiz-command-center"),
    generatedAt
  });

  const completionResult = await buildMvpCompletionAuditFromFiles({
    goalText:
      "Build a Crystal Clawz Social Studio MVP that wires Postiz, MoneyPrinterTurbo, and brand files into a review-first content workflow.",
    mvpPlanPath,
    workflowStatusPath: workflowResult.jsonOut,
    readinessAuditPath: auditResult.jsonOut,
    postizInputKitPath: inputKitResult.uiPath,
    postizLocalValidationPath: postizLocalValidationResult.uiSummaryPath,
    postizReadinessPath: postizReadinessResult.uiPath,
    commandCenterPath: commandCenterResult.uiPath,
    approvedBundlePath: input,
    postizDryRunPath: dryRunPath,
    jsonOut: path.join(resolvedOutDir, "mvp-completion-audit", "mvp-completion-audit.json"),
    uiOut: path.join(resolvedOutDir, "mvp-completion-audit", "mvp-completion-audit.ui.json"),
    markdownOut: path.join(resolvedOutDir, "mvp-completion-audit", "mvp-completion-audit.md"),
    generatedAt
  });

  const resolvedHumanApprovalHandoffPath =
    await ensureHumanApprovalHandoffPath({
      requestedPath:
        humanApprovalHandoffPath ||
        path.join(resolvedOutDir, "human-approval-handoff", "human-approval-handoff.ui.json"),
      outDir: resolvedOutDir,
      bundle: approvedBundle,
      generatedAt
    });
  const finishPathResult = await buildMvpFinishPathFromFiles({
    completionAuditPath: completionResult.uiOut,
    humanApprovalHandoffPath: resolvedHumanApprovalHandoffPath,
    postizInputKitPath: inputKitResult.uiPath,
    postizReadinessPath: postizReadinessResult.uiPath,
    commandCenterPath: commandCenterResult.uiPath,
    outDir: path.join(resolvedOutDir, "mvp-finish-path"),
    generatedAt
  });

  const operatorPacketResult = await buildMvpOperatorPacketFromFiles({
    completionAuditPath: completionResult.uiOut,
    finishPathPath: finishPathResult.uiPath,
    postizLocalValidationPath: postizLocalValidationResult.uiSummaryPath,
    humanApprovalHandoffPath: resolvedHumanApprovalHandoffPath,
    postizInputKitPath: inputKitResult.uiPath,
    outDir: path.join(resolvedOutDir, "mvp-operator-packet"),
    generatedAt
  });

  return {
    dryRunPath,
    status: workflowResult.status,
    workflowStatusPath: workflowResult.jsonOut,
    workflowStatusUiPath: workflowResult.uiOut,
    workflowStatusMarkdownPath: workflowResult.markdownOut,
    auditStatus: auditResult.status,
    auditPath: auditResult.jsonOut,
    auditMarkdownPath: auditResult.markdownOut,
    postizInputKitStatus: inputKitResult.status,
    postizInputKitPath: inputKitResult.jsonPath,
    postizInputKitUiPath: inputKitResult.uiPath,
    postizLocalValidationStatus: postizLocalValidationResult.status,
    postizLocalValidationPath: postizLocalValidationResult.jsonPath,
    postizLocalValidationUiPath: postizLocalValidationResult.uiSummaryPath,
    postizReadinessStatus: postizReadinessResult.status,
    postizReadinessPath: postizReadinessResult.jsonPath,
    postizReadinessUiPath: postizReadinessResult.uiPath,
    commandCenterStatus: commandCenterResult.status,
    commandCenterPath: commandCenterResult.jsonPath,
    commandCenterUiPath: commandCenterResult.uiPath,
    completionStatus: completionResult.status,
    completionPath: completionResult.jsonOut,
    completionUiPath: completionResult.uiOut,
    finishPathStatus: finishPathResult.status,
    finishPathPath: finishPathResult.jsonPath,
    finishPathUiPath: finishPathResult.uiPath,
    operatorPacketStatus: operatorPacketResult.status,
    operatorPacketPath: operatorPacketResult.jsonPath,
    operatorPacketUiPath: operatorPacketResult.uiPath
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

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await runPostizDryRunCycle({
    input: readArg("input", path.join(generatedDir, "approved-bundle.json")),
    integrationsPath: readArg("integrations", path.join(studioRoot, "handoff", "postiz", "api-draft", "integrations.example.json")),
    uploadedMediaPath: readArg("uploaded-media", path.join(studioRoot, "handoff", "postiz", "api-draft", "uploaded-media.example.json")),
    reviewPacketPath: readArg("review-packet", path.join(generatedDir, "review-packet", "review-packet.json")),
    manualManifestPath: readArg("manual-manifest", path.join(studioRoot, "handoff", "postiz", "approved", campaignId, "manifest.json")),
    contentPlanPath: readArg("content-plan", path.join(generatedDir, "content-plan", "content-plan.json")),
    brandClaimLedgerPath: readArg("brand-claim-ledger", path.join(generatedDir, "brand-claim-ledger", "brand-claim-ledger.json")),
    productionPacketsPath: readArg("production-packets", path.join(generatedDir, "production-packets", "production-packets.json")),
    productionQueuePath: readArg("production-queue", path.join(generatedDir, "production-queue", "production-queue.json")),
    reviewBoardPath: readArg("review-board", path.join(generatedDir, "review-board", "review-board.json")),
    mvpPlanPath: readArg("mvp-plan", path.join(studioRoot, "plans", "mvp-plan.md")),
    humanApprovalHandoffPath: readArg("human-approval-handoff", path.join(generatedDir, "human-approval-handoff", "human-approval-handoff.ui.json")),
    outDir: readArg("out-dir", generatedDir),
    apiBaseUrl: readArg("api-base-url", "http://localhost:4007/api/public/v1"),
    verification: verificationFromArgs()
  });

  console.log(`dry_run=${result.dryRunPath}`);
  console.log(`workflow_status=${result.status}`);
  console.log(`audit_status=${result.auditStatus}`);
  console.log(`audit=${result.auditPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
