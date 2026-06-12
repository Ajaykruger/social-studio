import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectPostizInputSecrets } from "../lib/postiz-input-safety.mjs";

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

function isPlaceholder(value) {
  return /replace-with|placeholder|todo/i.test(String(value || ""));
}

function step(id, label, ready, detail) {
  return {
    id,
    label,
    status: ready ? "ready" : "blocked",
    detail
  };
}

function integrationsAreReal(integrations) {
  if (!Array.isArray(integrations) || integrations.length === 0) return false;
  return integrations.every((integration) => {
    const settings = integration?.settings || {};
    return Boolean(
      integration?.platform &&
        integration?.id &&
        !isPlaceholder(integration.id) &&
        settings.__type &&
        !isPlaceholder(settings.__type)
    );
  });
}

function uploadedMediaIsReal(uploadedMedia) {
  if (!Array.isArray(uploadedMedia) || uploadedMedia.length === 0) return false;
  return uploadedMedia.every((media) =>
    Boolean(media?.id && media?.path && !isPlaceholder(media.id) && !isPlaceholder(media.path))
  );
}

function requiredMediaAssetsFromInputKit(postizInputKit) {
  const assets = Array.isArray(postizInputKit?.validation?.requiredMediaAssets)
    ? postizInputKit.validation.requiredMediaAssets
    : [];
  if (assets.length > 0) {
    return assets.map((asset, index) => ({
      assetId: asset.assetId || `${asset.contentType || "asset"}-${index + 1}`,
      contentType: asset.contentType || "asset"
    }));
  }
  const count = Number(postizInputKit?.summary?.requiredMediaAssets || 0);
  if (count > 1) {
    return Array.from({ length: count }, (_, index) => ({
      assetId: `required-media-${index + 1}`,
      contentType: "asset"
    }));
  }
  return [];
}

function requiredMediaAssetsFromBundle(approvedBundle, postizInputKit) {
  const reviewAssets = Array.isArray(approvedBundle?.postizHandoff?.reviewAssets)
    ? approvedBundle.postizHandoff.reviewAssets
    : [];
  if (reviewAssets.length > 0) {
    return reviewAssets.map((asset, index) => ({
      assetId: asset.assetId || `${asset.contentType || "asset"}-${index + 1}`,
      contentType: asset.contentType || "asset"
    }));
  }
  const inputKitAssets = requiredMediaAssetsFromInputKit(postizInputKit);
  if (inputKitAssets.length > 0) return inputKitAssets;
  return [{ assetId: approvedBundle?.assetId || "primary-asset", contentType: "ugc_video" }];
}

function uploadedMediaReadyCount(uploadedMedia, requiredMediaAssets) {
  const readyMedia = (Array.isArray(uploadedMedia) ? uploadedMedia : []).filter((media) =>
    Boolean(media?.id && media?.path && !isPlaceholder(media.id) && !isPlaceholder(media.path))
  );
  if (requiredMediaAssets.length <= 1) return readyMedia.length;

  return requiredMediaAssets.filter((asset) =>
    readyMedia.some(
      (media) =>
        media.assetId === asset.assetId ||
        (media.contentType && media.contentType === asset.contentType)
    )
  ).length;
}

function statusFor({ humanApprovalReady, postizInputsReady, inputSecretsReady, postizDryRunReady }) {
  if (!inputSecretsReady) return "blocked_by_postiz_input_secrets";
  if (postizDryRunReady) return "dry_run_ready";
  if (!humanApprovalReady) return "blocked_by_human_review";
  if (!postizInputsReady) return "blocked_by_postiz_inputs";
  return "ready_for_dry_run";
}

function nextActionFor(status) {
  const actions = {
    blocked_by_human_review: "Complete human review before building any Postiz draft payload.",
    blocked_by_postiz_input_secrets: "Remove API keys, tokens, and secrets from local Postiz input files before continuing.",
    blocked_by_postiz_inputs: "Replace the example Postiz integration IDs and uploaded media values with real local Postiz values.",
    ready_for_dry_run: "Build the Postiz dry-run payload from the approved bundle and real Postiz references.",
    dry_run_ready: "Review the dry-run payload before any separate API draft creation approval."
  };
  return actions[status] || "Keep Postiz draft creation blocked until every prerequisite is ready.";
}

function makeMarkdown(readiness) {
  const lines = [
    "# Postiz Dry-Run Readiness",
    "",
    `Generated: ${readiness.generatedAt}`,
    `Campaign: ${readiness.campaignId}`,
    `Status: ${readiness.status}`,
    "",
    "## Safety",
    "",
    `- Dry-run only: ${readiness.dryRunOnly ? "yes" : "no"}`,
    `- Network calls allowed: ${readiness.networkCallsAllowed ? "yes" : "no"}`,
    `- Nothing has been posted live: ${readiness.noLivePosting ? "yes" : "no"}`,
    "",
    "## Checklist",
    ""
  ];

  for (const item of readiness.steps) {
    lines.push(`- ${item.label}: ${item.status} - ${item.detail}`);
  }

  lines.push("", "## Next Action", "", `- ${readiness.nextAction}`, "");
  return `${lines.join("\n")}\n`;
}

function makeUiSummary(readiness) {
  return {
    campaignId: readiness.campaignId,
    status: readiness.status,
    dryRunOnly: readiness.dryRunOnly,
    networkCallsAllowed: readiness.networkCallsAllowed,
    noLivePosting: readiness.noLivePosting,
    summary: readiness.summary,
    nextAction: readiness.nextAction,
    steps: readiness.steps
  };
}

export function buildPostizDryRunReadiness({
  workflowStatus,
  approvedBundle,
  postizInputKit,
  integrations,
  uploadedMedia,
  approvedBundleExists = false,
  manualManifestExists = false,
  postizDryRunExists = false,
  generatedAt = new Date().toISOString()
}) {
  const humanApprovalReady = Boolean(
    approvedBundleExists &&
      workflowStatus?.readiness?.needsHumanReview === false &&
      workflowStatus?.overall?.status !== "needs_review"
  );
  const manualReady = Boolean(manualManifestExists && workflowStatus?.artifacts?.manualPackage);
  const secretFindings = detectPostizInputSecrets({ integrations, uploadedMedia });
  const inputSecretsReady = secretFindings.length === 0;
  const requiredMediaAssets = requiredMediaAssetsFromBundle(approvedBundle, postizInputKit);
  const uploadedMediaReady = uploadedMediaReadyCount(uploadedMedia, requiredMediaAssets);
  const mediaReady =
    uploadedMediaIsReal(uploadedMedia) && uploadedMediaReady >= requiredMediaAssets.length;
  const integrationReady = integrationsAreReal(integrations);
  const postizInputsReady = inputSecretsReady && mediaReady && integrationReady;
  const postizDryRunReady = Boolean(
    postizDryRunExists &&
      workflowStatus?.readiness?.canCreatePostizDraft === true &&
      workflowStatus?.artifacts?.postizDryRunPackage === true
  );
  const status = statusFor({ humanApprovalReady, postizInputsReady, inputSecretsReady, postizDryRunReady });

  const steps = [
    step(
      "human_approval",
      "Human approval recorded",
      humanApprovalReady,
      humanApprovalReady
        ? "An approved bundle exists and the workflow no longer needs human review."
        : "Complete review and record approve, needs_revision, or reject first."
    ),
    step(
      "manual_package",
      "Manual Postiz package",
      manualReady,
      manualReady ? "Manual upload package is available for review." : "Manual package manifest is missing."
    ),
    step(
      "local_input_safety",
      "Local Postiz input safety",
      inputSecretsReady,
      inputSecretsReady
        ? "Local Postiz input files contain IDs/media references only, not API keys or tokens."
        : "Remove secret-like fields from local Postiz input files: API keys, tokens, passwords, cookies, and authorization values."
    ),
    step(
      "uploaded_media",
      "Uploaded Postiz media",
      mediaReady,
      mediaReady
        ? `Uploaded media id/path values are present for ${uploadedMediaReady}/${requiredMediaAssets.length} approved assets.`
        : `Real uploaded media id/path values are required for every approved asset (${uploadedMediaReady}/${requiredMediaAssets.length} ready).`
    ),
    step(
      "integrations",
      "Postiz integration IDs",
      integrationReady,
      integrationReady ? "Real platform integration IDs are present." : "Real Postiz integration IDs are required."
    ),
    step(
      "dry_run_package",
      "Postiz dry-run package",
      postizDryRunReady,
      postizDryRunReady ? "Dry-run package exists and remains draft-only." : "Dry-run package has not been created."
    )
  ];
  const readySteps = steps.filter((item) => item.status === "ready").length;
  const readiness = {
    packageType: "social_studio_postiz_dry_run_readiness",
    generatedAt,
    campaignId: workflowStatus?.campaignId || "",
    status,
    dryRunOnly: true,
    networkCallsAllowed: false,
    noLivePosting: workflowStatus?.safety?.noLivePosting === true,
    summary: {
      totalSteps: steps.length,
      readySteps,
      blockedSteps: steps.length - readySteps,
      requiredMediaAssets: requiredMediaAssets.length,
      uploadedMediaReady
    },
    nextAction: nextActionFor(status),
    steps
  };

  readiness.uiSummary = makeUiSummary(readiness);
  readiness.markdown = makeMarkdown(readiness);
  return readiness;
}

export async function buildPostizDryRunReadinessFromFiles({
  workflowStatusPath,
  integrationsPath,
  uploadedMediaPath,
  approvedBundlePath = "",
  postizInputKitPath = "",
  manualManifestPath = "",
  postizDryRunPath = "",
  outDir,
  generatedAt
}) {
  const workflowStatus = JSON.parse(await readFile(workflowStatusPath, "utf8"));
  const integrations = JSON.parse(await readFile(integrationsPath, "utf8"));
  const uploadedMedia = JSON.parse(await readFile(uploadedMediaPath, "utf8"));
  const approvedBundleExists = await exists(approvedBundlePath);
  const approvedBundle = approvedBundleExists
    ? JSON.parse(await readFile(approvedBundlePath, "utf8"))
    : null;
  const postizInputKit = postizInputKitPath
    ? JSON.parse(await readFile(postizInputKitPath, "utf8"))
    : null;
  const manualManifestExists = await exists(manualManifestPath);
  const postizDryRunExists = await exists(postizDryRunPath);
  const readiness = buildPostizDryRunReadiness({
    workflowStatus,
    approvedBundle,
    postizInputKit,
    integrations,
    uploadedMedia,
    approvedBundleExists,
    manualManifestExists,
    postizDryRunExists,
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "postiz-dry-run-readiness.json");
  const uiPath = path.join(outDir, "postiz-dry-run-readiness.ui.json");
  const markdownPath = path.join(outDir, "postiz-dry-run-readiness.md");
  await writeFile(jsonPath, `${JSON.stringify(readiness, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(readiness.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, readiness.markdown);

  return {
    status: readiness.status,
    jsonPath,
    uiPath,
    markdownPath
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildPostizDryRunReadinessFromFiles({
    workflowStatusPath: readArg("workflow-status", path.join(generatedDir, "workflow-status.json")),
    integrationsPath: readArg("integrations", path.join(studioRoot, "handoff", "postiz", "api-draft", "integrations.example.json")),
    uploadedMediaPath: readArg("uploaded-media", path.join(studioRoot, "handoff", "postiz", "api-draft", "uploaded-media.example.json")),
    approvedBundlePath: readArg("approved-bundle", path.join(generatedDir, "approved-bundle.json")),
    postizInputKitPath: readArg("postiz-input-kit", ""),
    manualManifestPath: readArg("manual-manifest", path.join(studioRoot, "handoff", "postiz", "manual", campaignId, "manifest.json")),
    postizDryRunPath: readArg("postiz-dry-run", path.join(generatedDir, "postiz-draft.dry-run.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "postiz-dry-run-readiness"))
  });

  console.log(`status=${result.status}`);
  console.log(`json=${result.jsonPath}`);
  console.log(`ui=${result.uiPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
