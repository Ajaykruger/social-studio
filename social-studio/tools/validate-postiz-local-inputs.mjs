import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPostizInputKit } from "./build-postiz-input-kit.mjs";

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

function fileName(filePath) {
  return path.basename(String(filePath || ""));
}

function blockingReasonsFor(kit) {
  if (kit.status === "ready") return [];
  if (kit.status === "blocked_by_input_secrets") return ["input_secrets"];
  return ["missing_postiz_input_values"];
}

function makeUiSummary(result) {
  return {
    status: result.status,
    readyForDryRun: result.readyForDryRun,
    commandOnly: result.commandOnly,
    networkCallsAllowed: result.networkCallsAllowed,
    liveActionsEnabled: result.liveActionsEnabled,
    summary: result.summary,
    files: result.files,
    blockingReasons: result.blockingReasons,
    operatorPreflight: result.operatorPreflight,
    operatorEditPlan: result.operatorEditPlan,
    nextAction: result.nextAction
  };
}

function makeMarkdown(result) {
  const lines = [
    "# Postiz Local Input Validation",
    "",
    `Generated: ${result.generatedAt}`,
    `Campaign: ${result.campaignId}`,
    `Status: ${result.status}`,
    "",
    "## Safety",
    "",
    `- Command only: ${result.commandOnly ? "yes" : "no"}`,
    `- Network calls allowed: ${result.networkCallsAllowed ? "yes" : "no"}`,
    `- Live actions enabled: ${result.liveActionsEnabled ? "yes" : "no"}`,
    `- Values shown: ${result.valueShown ? "yes" : "no"}`,
    "",
    "## Results",
    "",
    `- Ready for dry-run: ${result.readyForDryRun ? "yes" : "no"}`,
    `- Missing checks: ${result.summary.missingChecks}`,
    `- Input secrets: ${result.summary.secretFieldCount > 0 ? "blocked" : "none"}`,
    "",
    "## Operator Preflight",
    ""
  ];

  for (const check of result.operatorPreflight.integrationChecks) {
    lines.push(
      `- ${check.platform}: ${check.status}. File: ${check.localInputFile}. Missing fields: ${check.missingFields.join(", ") || "none"}.`
    );
  }

  for (const check of result.operatorPreflight.mediaChecks) {
    lines.push(
      `- ${check.label}: ${check.status}. File: ${check.localInputFile}. Missing fields: ${check.missingFields.join(", ") || "none"}.`
    );
  }

  lines.push("", "## Operator Edit Plan", "");

  for (const file of result.operatorEditPlan.files) {
    lines.push(`- ${file.file}: ${file.records.length} records need attention.`);
    lines.push(`  - Allowed fields: ${file.allowedFields.join(", ")}`);
  }

  lines.push("", "## Next Action", "", `- ${result.nextAction}`, "");
  return `${lines.join("\n")}\n`;
}

export function validatePostizLocalInputs({
  bundle,
  reviewBoard = null,
  integrations,
  uploadedMedia,
  preparedLocalFiles = {
    integrations: "integrations.local.json",
    uploadedMedia: "uploaded-media.local.json"
  },
  generatedAt = new Date().toISOString()
}) {
  const kit = buildPostizInputKit({
    bundle,
    reviewBoard,
    integrations,
    uploadedMedia,
    preparedLocalFiles,
    generatedAt
  });
  const blockingReasons = blockingReasonsFor(kit);
  const readyForDryRun = kit.status === "ready";
  const result = {
    packageType: "social_studio_postiz_local_input_validation",
    generatedAt,
    campaignId: kit.campaignId,
    status: readyForDryRun ? "ready" : "blocked",
    readyForDryRun,
    exitCode: readyForDryRun ? 0 : 1,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    valueShown: false,
    inputKitStatus: kit.status,
    summary: {
      ...kit.summary,
      missingChecks: kit.operatorPreflight.missingChecks,
      secretFieldCount: kit.validation.secretFieldCount
    },
    files: {
      integrations: preparedLocalFiles?.integrations || "integrations.local.json",
      uploadedMedia: preparedLocalFiles?.uploadedMedia || "uploaded-media.local.json"
    },
    blockingReasons,
    operatorPreflight: kit.operatorPreflight,
    operatorEditPlan: kit.operatorEditPlan,
    nextAction: readyForDryRun
      ? "Inputs are ready; run the Postiz dry-run cycle after human approval is recorded."
      : kit.nextAction
  };

  result.uiSummary = makeUiSummary(result);
  result.markdown = makeMarkdown(result);
  return result;
}

export async function validatePostizLocalInputsFromFiles({
  bundlePath,
  reviewBoardPath = "",
  integrationsPath,
  uploadedMediaPath,
  outDir,
  generatedAt
}) {
  const result = validatePostizLocalInputs({
    bundle: await readJson(bundlePath),
    reviewBoard: reviewBoardPath ? await readJson(reviewBoardPath) : null,
    integrations: await readJson(integrationsPath),
    uploadedMedia: await readJson(uploadedMediaPath),
    preparedLocalFiles: {
      integrations: fileName(integrationsPath),
      uploadedMedia: fileName(uploadedMediaPath)
    },
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "postiz-local-input-validation.json");
  const uiSummaryPath = path.join(outDir, "postiz-local-input-validation.ui.json");
  const markdownPath = path.join(outDir, "postiz-local-input-validation.md");
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(
    uiSummaryPath,
    `${JSON.stringify(result.uiSummary, null, 2)}\n`
  );
  await writeFile(markdownPath, result.markdown);
  result.jsonPath = jsonPath;
  result.uiSummaryPath = uiSummaryPath;
  result.markdownPath = markdownPath;
  return result;
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const inputKitDir = path.join(generatedDir, "postiz-input-kit");
  const result = await validatePostizLocalInputsFromFiles({
    bundlePath: readArg("bundle", path.join(generatedDir, "approved-bundle.json")),
    reviewBoardPath: readArg("review-board", ""),
    integrationsPath: readArg("integrations", path.join(inputKitDir, "integrations.local.json")),
    uploadedMediaPath: readArg("uploaded-media", path.join(inputKitDir, "uploaded-media.local.json")),
    outDir: readArg("out-dir", inputKitDir)
  });

  console.log(`status=${result.status}`);
  console.log(`ready_for_dry_run=${result.readyForDryRun}`);
  console.log(`missing_checks=${result.summary.missingChecks}`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
