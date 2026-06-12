import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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

function commandStatus({ centerStatus, id, localInputFilesPrepared }) {
  if (centerStatus === "blocked_by_human_review") return "blocked";
  if (id === "prepare_local_postiz_inputs") return localInputFilesPrepared ? "blocked" : "available";
  if (centerStatus === "ready_for_dry_run") return "ready";
  if (id === "validate_postiz_inputs") return "available";
  return "blocked";
}

function statusFor({ inputKit, readiness, approvedBundleExists, postizDryRunExists }) {
  if (postizDryRunExists || readiness?.status === "dry_run_ready") return "dry_run_ready";
  if (!approvedBundleExists || readiness?.status === "blocked_by_human_review") return "blocked_by_human_review";
  if (inputKit?.status !== "ready" || readiness?.status === "blocked_by_postiz_inputs") {
    return "needs_real_values";
  }
  if (readiness?.status === "ready_for_dry_run") return "ready_for_dry_run";
  return "needs_real_values";
}

function nextActionFor(status, localInputFilesPrepared = false) {
  if (status === "blocked_by_human_review") {
    return localInputFilesPrepared
      ? "Record human approval before validating existing local Postiz inputs."
      : "Record human approval before filling or validating local Postiz inputs.";
  }
  if (localInputFilesPrepared && status === "needs_real_values") {
    return "Fill the existing local Postiz input files with real IDs/media references, then validate them.";
  }
  const actions = {
    blocked_by_human_review: "Record human approval, then fill the local Postiz input files.",
    needs_real_values: "Fill the local Postiz integration and uploaded media files, then validate them.",
    ready_for_dry_run: "Run the build dry-run command to create the local Postiz draft payload.",
    dry_run_ready: "Review the dry-run payload before any separate API draft creation approval."
  };
  return actions[status] || "Keep Postiz draft creation blocked until every prerequisite is ready.";
}

function makePrerequisiteChecklist({ inputKit, readiness, approvedBundleExists }) {
  return [
    {
      id: "human_approval",
      label: "Human approval recorded",
      status: approvedBundleExists && readiness?.status !== "blocked_by_human_review" ? "ready" : "blocked",
      detail: approvedBundleExists
        ? "approved-bundle.json exists."
        : "Record a real human approval before building any Postiz dry-run payload."
    },
    {
      id: "real_postiz_inputs",
      label: "Real local Postiz inputs",
      status: inputKit?.status === "ready" ? "ready" : "blocked",
      detail:
        inputKit?.status === "ready"
          ? "Local integrations and uploaded media references are ready."
          : "Fill integrations.local.json and uploaded-media.local.json with real local IDs/media references."
    },
    {
      id: "dry_run_only",
      label: "Dry-run only",
      status: readiness?.dryRunOnly === true ? "ready" : "blocked",
      detail: "This command center only prepares local dry-run payloads."
    },
    {
      id: "live_actions_off",
      label: "Live actions off",
      status: "ready",
      detail: "The app does not run Postiz API calls, scheduling, or publishing."
    }
  ];
}

function pathsFor(campaignId) {
  const generated = `social-studio\\generated\\${campaignId}`;
  const inputKit = `${generated}\\postiz-input-kit`;
  return {
    generated,
    inputKit,
    approvedBundle: `${generated}\\approved-bundle.json`,
    integrationsTemplate: `${inputKit}\\integrations.local.template.json`,
    uploadedMediaTemplate: `${inputKit}\\uploaded-media.local.template.json`,
    integrationsLocal: `${inputKit}\\integrations.local.json`,
    uploadedMediaLocal: `${inputKit}\\uploaded-media.local.json`,
    postizInputKit: `${inputKit}\\postiz-input-kit.json`,
    reviewPacket: `${generated}\\review-packet\\review-packet.json`,
    manualManifest: `social-studio\\handoff\\postiz\\approved\\${campaignId}\\manifest.json`,
    contentPlan: `${generated}\\content-plan\\content-plan.json`,
    brandClaimLedger: `${generated}\\brand-claim-ledger\\brand-claim-ledger.json`,
    productionPackets: `${generated}\\production-packets\\production-packets.json`,
    productionQueue: `${generated}\\production-queue\\production-queue.json`,
    reviewBoard: `${generated}\\review-board\\review-board.json`,
    humanApprovalHandoff: `${generated}\\human-approval-handoff\\human-approval-handoff.ui.json`,
    workflowStatus: `${generated}\\workflow-status.json`,
    postizDryRun: `${generated}\\postiz-draft.dry-run.json`,
    postizReadinessOut: `${generated}\\postiz-dry-run-readiness`
  };
}

function commandMetadata(id) {
  const sharedNever = [
    "Never calls the Postiz API.",
    "Never schedules or publishes social content.",
    "Never writes API keys, tokens, or secrets."
  ];
  const metadata = {
    prepare_local_postiz_inputs: {
      requires: ["local_templates"],
      writes: ["integrations.local.json", "uploaded-media.local.json"],
      never: sharedNever
    },
    validate_postiz_inputs: {
      requires: ["integrations.local.json", "uploaded-media.local.json"],
      writes: [
        "postiz-local-input-validation.json",
        "postiz-local-input-validation.ui.json",
        "postiz-local-input-validation.md"
      ],
      never: sharedNever
    },
    refresh_postiz_readiness: {
      requires: ["approved-bundle.json", "integrations.local.json", "uploaded-media.local.json"],
      writes: [
        "postiz-dry-run-readiness.json",
        "postiz-dry-run-readiness.ui.json",
        "postiz-dry-run-readiness.md"
      ],
      never: sharedNever
    },
    build_postiz_dry_run: {
      requires: ["approved-bundle.json", "real Postiz local inputs", "passing verification flags"],
      writes: [
        "postiz-draft.dry-run.json",
        "workflow-status.json",
        "mvp-completion-audit.json"
      ],
      never: [
        "Never calls the Postiz API.",
        "Never schedules social content.",
        "Never publishes social content.",
        "Never writes API keys, tokens, or secrets."
      ]
    }
  };
  return metadata[id] || { requires: [], writes: [], never: sharedNever };
}

function makeCommands({ campaignId, centerStatus, localInputFilesPrepared = false }) {
  const paths = pathsFor(campaignId);
  const prepareGuardrail = localInputFilesPrepared
    ? "Local input files already exist. Edit integrations.local.json and uploaded-media.local.json, then validate them. The prepare command refuses to overwrite existing local files."
    : "Creates editable local input files from templates only. Refuses to overwrite existing local files. Does not call Postiz.";
  const commands = [
    {
      id: "prepare_local_postiz_inputs",
      label: "Prepare local Postiz inputs",
      guardrail: prepareGuardrail,
      command: [
        "node social-studio\\tools\\prepare-postiz-local-inputs.mjs `",
        `  --integrations-template="${paths.integrationsTemplate}" \``,
        `  --uploaded-media-template="${paths.uploadedMediaTemplate}" \``,
        `  --integrations-out="${paths.integrationsLocal}" \``,
        `  --uploaded-media-out="${paths.uploadedMediaLocal}"`
      ].join("\n")
    },
    {
      id: "validate_postiz_inputs",
      label: "Validate Postiz inputs",
      guardrail: "Uses local files only. Does not call Postiz. Exits blocked until every real ID/media reference is present.",
      command: [
        "node social-studio\\tools\\validate-postiz-local-inputs.mjs `",
        `  --bundle="${paths.approvedBundle}" \``,
        `  --review-board="${paths.reviewBoard}" \``,
        `  --integrations="${paths.integrationsLocal}" \``,
        `  --uploaded-media="${paths.uploadedMediaLocal}" \``,
        `  --out-dir="${paths.inputKit}"`
      ].join("\n")
    },
    {
      id: "refresh_postiz_readiness",
      label: "Refresh Postiz readiness",
      guardrail: "Reads approved bundle and local Postiz references. Does not call Postiz.",
      command: [
        "node social-studio\\tools\\build-postiz-dry-run-readiness.mjs `",
        `  --workflow-status="${paths.workflowStatus}" \``,
        `  --integrations="${paths.integrationsLocal}" \``,
        `  --uploaded-media="${paths.uploadedMediaLocal}" \``,
        `  --approved-bundle="${paths.approvedBundle}" \``,
        `  --postiz-input-kit="${paths.postizInputKit}" \``,
        `  --manual-manifest="${paths.manualManifest}" \``,
        `  --postiz-dry-run="${paths.postizDryRun}" \``,
        `  --out-dir="${paths.postizReadinessOut}"`
      ].join("\n")
    },
    {
      id: "build_postiz_dry_run",
      label: "Build Postiz dry-run",
      guardrail: "Requires approved-bundle.json and real local Postiz media/integration values. Writes a dry-run payload only.",
      command: [
        "node social-studio\\tools\\run-postiz-dry-run-cycle.mjs `",
        `  --input="${paths.approvedBundle}" \``,
        `  --integrations="${paths.integrationsLocal}" \``,
        `  --uploaded-media="${paths.uploadedMediaLocal}" \``,
        `  --review-packet="${paths.reviewPacket}" \``,
        `  --manual-manifest="${paths.manualManifest}" \``,
        `  --content-plan="${paths.contentPlan}" \``,
        `  --brand-claim-ledger="${paths.brandClaimLedger}" \``,
        `  --production-packets="${paths.productionPackets}" \``,
        `  --production-queue="${paths.productionQueue}" \``,
        `  --review-board="${paths.reviewBoard}" \``,
        `  --human-approval-handoff="${paths.humanApprovalHandoff}" \``,
        `  --out-dir="${paths.generated}" \``,
        "  --tests-passing=true `",
        "  --build-passing=true `",
        "  --secret-scan-passing=true `",
        "  --path-leak-scan-passing=true"
      ].join("\n")
    }
  ];

  return commands.map((command) => ({
    ...command,
    ...commandMetadata(command.id),
    status: commandStatus({ centerStatus, id: command.id, localInputFilesPrepared })
  })).map((command) => ({
    ...command,
    copyEnabled: command.status !== "blocked"
  }));
}

function makeMarkdown(center) {
  const lines = [
    "# Postiz Command Center",
    "",
    `Generated: ${center.generatedAt}`,
    `Campaign: ${center.campaignId}`,
    `Status: ${center.status}`,
    "",
    "These commands are copy-only. The app does not run them.",
    "",
    "## Prerequisites",
    ""
  ];

  for (const item of center.prerequisiteChecklist) {
    lines.push(`- ${item.label}: ${item.status}. ${item.detail}`);
  }

  lines.push("");

  for (const command of center.commands) {
    lines.push(
      `## ${command.label}`,
      "",
      command.guardrail,
      "",
      command.copyEnabled ? "- Copy enabled" : "- Copy disabled until prerequisites are ready",
      `- Requires: ${command.requires.join(", ") || "none"}`,
      `- Writes: ${command.writes.join(", ") || "none"}`,
      `- Never: ${command.never.join(" ")}`,
      "",
      "```powershell",
      command.command,
      "```",
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

function makeUiSummary(center) {
  return {
    campaignId: center.campaignId,
    status: center.status,
    commandOnly: center.commandOnly,
    networkCallsAllowed: center.networkCallsAllowed,
    liveActionsEnabled: center.liveActionsEnabled,
    summary: center.summary,
    prerequisiteChecklist: center.prerequisiteChecklist,
    nextAction: center.nextAction,
    commands: center.commands
  };
}

export function buildPostizCommandCenter({
  inputKit,
  readiness,
  approvedBundleExists = false,
  postizDryRunExists = false,
  localInputFilesPrepared = false,
  generatedAt = new Date().toISOString()
}) {
  const campaignId = inputKit?.campaignId || readiness?.campaignId || "";
  const status = statusFor({ inputKit, readiness, approvedBundleExists, postizDryRunExists });
  const commands = makeCommands({ campaignId, centerStatus: status, localInputFilesPrepared });
  const prerequisiteChecklist = makePrerequisiteChecklist({ inputKit, readiness, approvedBundleExists });
  const readyCommands = commands.filter((command) => command.status === "ready").length;
  const center = {
    packageType: "social_studio_postiz_command_center",
    generatedAt,
    campaignId,
    status,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    summary: {
      totalCommands: commands.length,
      readyCommands,
      availableCommands: commands.filter((command) => command.status === "available").length,
      blockedCommands: commands.filter((command) => command.status === "blocked").length
    },
    prerequisiteChecklist,
    nextAction: nextActionFor(status, localInputFilesPrepared),
    commands
  };

  center.uiSummary = makeUiSummary(center);
  center.markdown = makeMarkdown(center);
  return center;
}

export async function buildPostizCommandCenterFromFiles({
  inputKitPath,
  readinessPath,
  approvedBundlePath = "",
  postizDryRunPath = "",
  outDir,
  generatedAt
}) {
  const inputKit = JSON.parse(await readFile(inputKitPath, "utf8"));
  const readiness = JSON.parse(await readFile(readinessPath, "utf8"));
  const inputKitDir = path.dirname(inputKitPath);
  const localInputFilesPrepared = Boolean(
    (await exists(path.join(inputKitDir, "integrations.local.json"))) &&
      (await exists(path.join(inputKitDir, "uploaded-media.local.json")))
  );
  const center = buildPostizCommandCenter({
    inputKit,
    readiness,
    approvedBundleExists: await exists(approvedBundlePath),
    postizDryRunExists: await exists(postizDryRunPath),
    localInputFilesPrepared,
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "postiz-command-center.json");
  const uiPath = path.join(outDir, "postiz-command-center.ui.json");
  const markdownPath = path.join(outDir, "postiz-command-center.md");
  await writeFile(jsonPath, `${JSON.stringify(center, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(center.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, center.markdown);

  return {
    status: center.status,
    jsonPath,
    uiPath,
    markdownPath
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildPostizCommandCenterFromFiles({
    inputKitPath: readArg("input-kit", path.join(generatedDir, "postiz-input-kit", "postiz-input-kit.ui.json")),
    readinessPath: readArg("readiness", path.join(generatedDir, "postiz-dry-run-readiness", "postiz-dry-run-readiness.ui.json")),
    approvedBundlePath: readArg("approved-bundle", path.join(generatedDir, "approved-bundle.json")),
    postizDryRunPath: readArg("postiz-dry-run", path.join(generatedDir, "postiz-draft.dry-run.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "postiz-command-center"))
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
