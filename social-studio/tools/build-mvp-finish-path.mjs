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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function requirementComplete(audit, id) {
  return audit?.requirements?.find((item) => item.id === id)?.status === "complete";
}

function findCommand(commands = [], id) {
  return commands.find((command) => command.id === id);
}

function safeCommand(command) {
  if (!command) return null;
  return {
    id: command.id || command.decision || command.label,
    label: command.label || command.decision || command.id,
    status: command.status || "available",
    command: command.command || "",
    copyEnabled: command.copyEnabled !== false,
    requiresNoteEdit: command.requiresNoteEdit === true
  };
}

function statusFrom({ humanApproved, postizInputsReady, dryRunReady, mvpComplete, postizReadiness }) {
  if (mvpComplete) return "complete";
  if (dryRunReady) return "waiting_for_completion_audit";
  if (postizReadiness?.status === "ready_for_dry_run") return "ready_for_postiz_dry_run";
  if (postizInputsReady) return "waiting_for_readiness_refresh";
  if (humanApproved) return "waiting_for_postiz_inputs";
  return "waiting_for_human_approval";
}

function firstAction(steps, status) {
  if (status === "complete") {
    return "Draft-only MVP is complete. Creating or publishing real posts still needs separate approval.";
  }

  const firstAvailable = steps.find((step) => step.status === "available");
  if (firstAvailable) return firstAvailable.action;

  const firstBlocked = steps.find((step) => step.status === "blocked");
  return firstBlocked?.action || "Refresh the finish path after the current blocker changes.";
}

function makeStep({ id, label, status, detail, action, preflightChecks = [], expectedOutputs = [], commands = [] }) {
  const stepCommands = commands.filter(Boolean).map((command) => {
    if (status === "blocked" && command.copyEnabled !== false) {
      return {
        ...command,
        copyEnabled: false,
        disabledReason: "prerequisites"
      };
    }
    if (command.copyEnabled === false && !command.disabledReason) {
      return {
        ...command,
        disabledReason: command.requiresNoteEdit ? "notes" : "prerequisites"
      };
    }
    return command;
  });

  return {
    id,
    label,
    status,
    detail,
    action,
    preflightChecks,
    expectedOutputs,
    commands: stepCommands
  };
}

function disabledCopyStatus(command) {
  if (command.copyEnabled !== false) return "";
  return command.disabledReason === "notes"
    ? "Copy disabled until notes are edited. "
    : "Copy disabled until prerequisites are ready. ";
}

function makeMarkdown(finishPath) {
  const lines = [
    "# MVP Finish Path",
    "",
    `Generated: ${finishPath.generatedAt}`,
    `Campaign: ${finishPath.campaignId}`,
    `Status: ${finishPath.status}`,
    "",
    "## Steps",
    ""
  ];

  for (const step of finishPath.steps) {
    lines.push(`- ${step.label}: ${step.status} - ${step.action}`);
    if (step.preflightChecks?.length) {
      lines.push("  - Preflight:");
      for (const check of step.preflightChecks) {
        lines.push(`    - ${check}`);
      }
    }
    if (step.expectedOutputs?.length) {
      lines.push("  - Expected outputs:");
      for (const output of step.expectedOutputs) {
        lines.push(`    - ${output}`);
      }
    }
    for (const command of step.commands) {
      const copyStatus = disabledCopyStatus(command);
      lines.push(`  - ${command.label}: ${copyStatus}\`${command.command}\``);
    }
  }

  lines.push("", "## Next Action", "", `- ${finishPath.nextAction}`, "");
  return `${lines.join("\n")}\n`;
}

function makeUiSummary(finishPath) {
  return {
    campaignId: finishPath.campaignId,
    status: finishPath.status,
    commandOnly: finishPath.commandOnly,
    networkCallsAllowed: finishPath.networkCallsAllowed,
    liveActionsEnabled: finishPath.liveActionsEnabled,
    summary: finishPath.summary,
    nextAction: finishPath.nextAction,
    steps: finishPath.steps
  };
}

export function buildMvpFinishPath({
  completionAudit,
  humanApprovalHandoff,
  postizInputKit,
  postizReadiness,
  commandCenter,
  generatedAt = new Date().toISOString()
}) {
  const humanApproved = requirementComplete(completionAudit, "human_approval_recorded");
  const postizInputsReady = requirementComplete(completionAudit, "real_postiz_inputs") && postizInputKit?.status === "ready";
  const dryRunReady = requirementComplete(completionAudit, "postiz_dry_run_package");
  const mvpComplete = completionAudit?.mvpComplete === true || requirementComplete(completionAudit, "approved_mvp_complete");
  const readyForDryRun = postizReadiness?.status === "ready_for_dry_run" || postizReadiness?.status === "dry_run_ready";

  const approvalAvailable =
    !humanApproved &&
    humanApprovalHandoff?.status === "awaiting_human_decision" &&
    humanApprovalHandoff?.commandOnly === true &&
    humanApprovalHandoff?.liveActionsEnabled === false;
  const postizInputAvailable =
    humanApproved && !postizInputsReady && postizInputKit?.validation?.inputSecretsReady === true;
  const readinessRefreshAvailable = postizInputsReady && !readyForDryRun;
  const dryRunBuildAvailable =
    readyForDryRun &&
    !dryRunReady &&
    findCommand(commandCenter?.commands, "build_postiz_dry_run")?.status === "ready";
  const finalAuditAvailable = dryRunReady && !mvpComplete;

  const prepareCommand = safeCommand(findCommand(commandCenter?.commands, "prepare_local_postiz_inputs"));
  const validateCommand = safeCommand(findCommand(commandCenter?.commands, "validate_postiz_inputs"));
  const refreshCommand = safeCommand(findCommand(commandCenter?.commands, "refresh_postiz_readiness"));
  const dryRunCommand = safeCommand(findCommand(commandCenter?.commands, "build_postiz_dry_run"));
  const decisionCommands = (humanApprovalHandoff?.decisionCommands || []).map(safeCommand);
  const reviewAssetCount = Array.isArray(humanApprovalHandoff?.reviewAssets)
    ? humanApprovalHandoff.reviewAssets.length
    : 0;
  const reviewAction =
    humanApprovalHandoff?.nextAction ||
    "Review all generated assets, then copy approve, needs_revision, or reject.";
  const reviewDetail = humanApproved
    ? "Human approval is recorded."
    : reviewAssetCount > 1
      ? `${reviewAssetCount} generated assets need a real review decision.`
      : "The review asset needs a real review decision.";

  const steps = [
    makeStep({
      id: "review_and_decide",
      label: "Review and record decision",
      status: humanApproved ? "complete" : approvalAvailable ? "available" : "blocked",
      detail: reviewDetail,
      action: reviewAction,
      preflightChecks: [
        "Open the human approval handoff.",
        "Review every generated asset and evidence item.",
        "Confirm artifact freshness before copying a decision command."
      ],
      expectedOutputs: [
        "approved-bundle.json if approve is copied",
        "approved manual Postiz draft package if approve is copied",
        "needs_revision or rejected state if that decision is copied"
      ],
      commands: humanApproved ? [] : decisionCommands
    }),
    makeStep({
      id: "fill_local_postiz_inputs",
      label: "Fill real local Postiz inputs",
      status: postizInputsReady ? "complete" : postizInputAvailable ? "available" : "blocked",
      detail: postizInputsReady
        ? "Real Postiz integration and uploaded media references are ready."
        : "Local Postiz integration IDs and uploaded media references are still needed.",
      action: "Fill only local Postiz IDs and uploaded media references. Do not paste API keys or tokens.",
      preflightChecks: [
        "Confirm human approval is recorded.",
        "Use only local Postiz integration IDs and uploaded media references.",
        "Do not paste API keys, access tokens, refresh tokens, cookies, passwords, or secrets."
      ],
      expectedOutputs: [
        "integrations.local.json",
        "uploaded-media.local.json",
        "postiz-local-input-validation.ui.json"
      ],
      commands: postizInputsReady ? [] : [prepareCommand, validateCommand]
    }),
    makeStep({
      id: "refresh_postiz_readiness",
      label: "Refresh Postiz readiness",
      status: readyForDryRun ? "complete" : readinessRefreshAvailable ? "available" : "blocked",
      detail: readyForDryRun
        ? "Postiz readiness has confirmed the draft-only inputs."
        : "Postiz readiness must be refreshed after local input values are ready.",
      action: "Refresh dry-run readiness from the local input files.",
      preflightChecks: [
        "Confirm approved-bundle.json exists.",
        "Confirm local Postiz input validation is passing.",
        "Confirm the manual approved package manifest exists."
      ],
      expectedOutputs: [
        "postiz-dry-run-readiness.json",
        "postiz-dry-run-readiness.ui.json",
        "postiz-dry-run-readiness.md"
      ],
      commands: readyForDryRun ? [] : [refreshCommand]
    }),
    makeStep({
      id: "build_postiz_dry_run",
      label: "Build Postiz dry-run package",
      status: dryRunReady ? "complete" : dryRunBuildAvailable ? "available" : "blocked",
      detail: dryRunReady
        ? "The draft-only Postiz payload exists."
        : "The Postiz dry-run payload is not created yet.",
      action: "Build the Postiz dry-run payload. It writes local JSON only and does not call Postiz.",
      preflightChecks: [
        "Confirm Postiz readiness status is ready_for_dry_run.",
        "Confirm tests, build, secret scan, and path leak scan flags are true.",
        "Confirm this command is dry-run only and network calls remain off."
      ],
      expectedOutputs: [
        "postiz-draft.dry-run.json",
        "workflow-status.json",
        "mvp-completion-audit.json"
      ],
      commands: dryRunReady ? [] : [dryRunCommand]
    }),
    makeStep({
      id: "confirm_mvp_completion",
      label: "Confirm MVP completion",
      status: mvpComplete ? "complete" : finalAuditAvailable ? "available" : "blocked",
      detail: mvpComplete
        ? "The draft-only MVP completion audit is green."
        : "The completion audit must be refreshed after approval, real inputs, and dry-run package are ready.",
      action: "Refresh the MVP completion audit after the dry-run package exists.",
      preflightChecks: [
        "Confirm human approval is recorded.",
        "Confirm real local Postiz inputs are validated.",
        "Confirm postiz-draft.dry-run.json exists."
      ],
      expectedOutputs: [
        "mvp-completion-audit.json",
        "mvp-completion-audit.ui.json",
        "approved_mvp_complete requirement becomes complete"
      ]
    })
  ];

  const status = statusFrom({ humanApproved, postizInputsReady, dryRunReady, mvpComplete, postizReadiness });
  const completeSteps = steps.filter((step) => step.status === "complete").length;
  const availableSteps = steps.filter((step) => step.status === "available").length;
  const blockedSteps = steps.filter((step) => step.status === "blocked").length;
  const finishPath = {
    packageType: "social_studio_mvp_finish_path",
    generatedAt,
    campaignId:
      completionAudit?.campaignId ||
      humanApprovalHandoff?.campaignId ||
      postizInputKit?.campaignId ||
      postizReadiness?.campaignId ||
      commandCenter?.campaignId ||
      "",
    status,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    summary: {
      totalSteps: steps.length,
      completeSteps,
      availableSteps,
      blockedSteps,
      currentStep: steps.find((step) => step.status === "available")?.label || steps.find((step) => step.status === "blocked")?.label || "Complete"
    },
    steps,
    nextAction: firstAction(steps, status)
  };

  finishPath.uiSummary = makeUiSummary(finishPath);
  finishPath.markdown = makeMarkdown(finishPath);
  return finishPath;
}

export async function buildMvpFinishPathFromFiles({
  completionAuditPath,
  humanApprovalHandoffPath,
  postizInputKitPath,
  postizReadinessPath,
  commandCenterPath,
  outDir,
  generatedAt
}) {
  const finishPath = buildMvpFinishPath({
    completionAudit: await readJson(completionAuditPath),
    humanApprovalHandoff: await readJson(humanApprovalHandoffPath),
    postizInputKit: await readJson(postizInputKitPath),
    postizReadiness: await readJson(postizReadinessPath),
    commandCenter: await readJson(commandCenterPath),
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "mvp-finish-path.json");
  const uiPath = path.join(outDir, "mvp-finish-path.ui.json");
  const markdownPath = path.join(outDir, "mvp-finish-path.md");
  await writeFile(jsonPath, `${JSON.stringify(finishPath, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(finishPath.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, finishPath.markdown);

  return {
    status: finishPath.status,
    jsonPath,
    uiPath,
    markdownPath
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildMvpFinishPathFromFiles({
    completionAuditPath: readArg("completion-audit", path.join(generatedDir, "mvp-completion-audit", "mvp-completion-audit.ui.json")),
    humanApprovalHandoffPath: readArg("human-approval-handoff", path.join(generatedDir, "human-approval-handoff", "human-approval-handoff.ui.json")),
    postizInputKitPath: readArg("postiz-input-kit", path.join(generatedDir, "postiz-input-kit", "postiz-input-kit.ui.json")),
    postizReadinessPath: readArg(
      "postiz-readiness",
      path.join(generatedDir, "postiz-dry-run-readiness", "postiz-dry-run-readiness.ui.json")
    ),
    commandCenterPath: readArg("command-center", path.join(generatedDir, "postiz-command-center", "postiz-command-center.ui.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "mvp-finish-path"))
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
