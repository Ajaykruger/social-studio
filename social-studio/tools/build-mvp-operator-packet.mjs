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

async function readOptionalJson(filePath) {
  return filePath ? readJson(filePath) : null;
}

function displayPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function blockedRequirements(completionAudit) {
  return (completionAudit?.requirements || [])
    .filter((requirement) => requirement.status === "blocked")
    .map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      detail: requirement.detail || ""
    }));
}

function safeCommand(command, { forceCopyEnabled = null } = {}) {
  const copyEnabled = forceCopyEnabled === null ? command.copyEnabled !== false : forceCopyEnabled;
  return {
    id: command.id || command.label,
    label: command.label || command.id,
    status: command.status || "available",
    command: command.command || "",
    copyEnabled,
    requiresNoteEdit: command.requiresNoteEdit === true
  };
}

function safeAction(step, options = {}) {
  return {
    id: step.id,
    label: step.label,
    status: step.status,
    detail: step.detail || "",
    action: step.action || "",
    commands: (step.commands || []).map((command) => safeCommand(command, options))
  };
}

const STEP_BLOCKER_IDS = {
  fill_local_postiz_inputs: ["human_approval_recorded"],
  refresh_postiz_readiness: ["human_approval_recorded", "real_postiz_inputs"],
  build_postiz_dry_run: ["human_approval_recorded", "real_postiz_inputs"],
  confirm_mvp_completion: ["human_approval_recorded", "real_postiz_inputs", "postiz_dry_run_package"]
};

function gatedAction(step, currentBlockers) {
  const action = safeAction(step, { forceCopyEnabled: false });
  const blockerIds = STEP_BLOCKER_IDS[step.id] || [];
  const blockers = blockerIds.length
    ? currentBlockers.filter((blocker) => blockerIds.includes(blocker.id))
    : currentBlockers;
  return {
    ...action,
    blockedUntil: blockers.map((blocker) => blocker.label).join("; ") || "Previous step complete"
  };
}

function makeHandoffSnapshot({ humanApprovalHandoff, postizInputKit }) {
  const readiness = humanApprovalHandoff?.decisionReadiness || {};
  const readinessSummary = readiness.summary || {};
  const mediaFile = (postizInputKit?.operatorEditPlan?.files || []).find(
    (file) => file.id === "postiz_uploaded_media"
  );
  const sourceAssets = (mediaFile?.records || []).map((record) => ({
    key: record.key,
    label: record.label,
    sourceAssetUrl: record.sourceAssetUrl || "",
    sourceInstruction: record.sourceInstruction || "",
    valueShown: record.valueShown === true
  }));
  return {
    humanDecision: {
      status: readiness.status || humanApprovalHandoff?.status || "unknown",
      totalAssets: Number(readinessSummary.totalAssets || 0),
      readyAssets: Number(readinessSummary.readyAssets || 0),
      blockedAssets: Number(readinessSummary.blockedAssets || 0)
    },
    postizInputs: {
      status: postizInputKit?.status || "unknown",
      missingChecks: Number(postizInputKit?.operatorPreflight?.missingChecks || 0),
      sourceAssets
    }
  };
}

function makePostizInputChecklist(postizInputKit) {
  const files = Array.isArray(postizInputKit?.operatorEditPlan?.files) ? postizInputKit.operatorEditPlan.files : [];
  const integrationFile = files.find((file) => file.id === "postiz_integrations") || {};
  const mediaFile = files.find((file) => file.id === "postiz_uploaded_media") || {};
  const integrationSlots = (integrationFile.records || []).map((record) => ({
    platform: record.key || record.label,
    status: record.status || "missing",
    localInputFile: integrationFile.file || "integrations.local.json",
    requiredFields: Array.isArray(record.requiredFields) ? record.requiredFields : [],
    valueShown: record.valueShown === true
  }));
  const mediaUploadRefs = (mediaFile.records || []).map((record) => ({
    assetId: record.key,
    label: record.label,
    contentType: record.contentType || "",
    mediaType: record.mediaType || "",
    status: record.status || "missing",
    localInputFile: mediaFile.file || "uploaded-media.local.json",
    sourceAssetUrl: record.sourceAssetUrl || "",
    sourceInstruction: record.sourceInstruction || "",
    requiredFields: Array.isArray(record.requiredFields) ? record.requiredFields : [],
    valueShown: record.valueShown === true
  }));
  return {
    status: postizInputKit?.status || "unknown",
    summary: {
      requiredPlatforms: integrationSlots.length,
      readyPlatforms: integrationSlots.filter((slot) => slot.status === "ready").length,
      requiredMediaAssets: mediaUploadRefs.length,
      readyMediaAssets: mediaUploadRefs.filter((ref) => ref.status === "ready").length,
      valuesShown: Boolean(postizInputKit?.operatorEditPlan?.valueShown)
    },
    integrationSlots,
    mediaUploadRefs,
    forbiddenFields: Array.isArray(postizInputKit?.operatorEditPlan?.forbiddenFields)
      ? postizInputKit.operatorEditPlan.forbiddenFields
      : []
  };
}

function operatorFiles(campaignId) {
  const base = `social-studio/generated/${campaignId}`;
  return [
    {
      id: "human_approval_handoff",
      label: "Human approval handoff",
      file: `${base}/human-approval-handoff/human-approval-handoff.ui.json`,
      purpose: "Review generated assets and copy the selected decision command."
    },
    {
      id: "postiz_integrations",
      label: "Postiz integration IDs",
      file: `${base}/postiz-input-kit/integrations.local.json`,
      purpose: "Add real channel IDs and platform settings only."
    },
    {
      id: "uploaded_media",
      label: "Uploaded media references",
      file: `${base}/postiz-input-kit/uploaded-media.local.json`,
      purpose: "Add real uploaded media IDs and URLs for approved assets only."
    }
  ];
}

function makeMarkdown(packet) {
  const lines = [
    "# MVP Operator Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Campaign: ${packet.campaignId}`,
    `Status: ${packet.status}`,
    "",
    "## Current Blockers",
    ""
  ];

  for (const blocker of packet.currentBlockers) {
    lines.push(`- ${blocker.label}: ${blocker.detail}`);
  }

  lines.push("", "## Next Safe Actions", "");
  for (const action of packet.nextSafeActions) {
    lines.push(`- ${action.label}: ${action.action}`);
    for (const command of action.commands) {
      const copyStatus = command.copyEnabled === false ? "copy disabled until notes are edited. " : "";
      lines.push(`  - ${command.label}: ${copyStatus}\`${command.command}\``);
    }
  }

  lines.push("", "## Gated Upcoming Actions", "");
  for (const action of packet.gatedUpcomingActions) {
    lines.push(`- ${action.label}: ${action.status}. Blocked until: ${action.blockedUntil}.`);
    for (const command of action.commands) {
      lines.push(`  - ${command.label}: copy disabled. \`${command.command}\``);
    }
  }

  lines.push("", "## Operator Files", "");
  for (const file of packet.operatorFiles) {
    lines.push(`- ${file.label}: ${file.file} - ${file.purpose}`);
  }

  lines.push("", "## Readiness Snapshot", "");
  lines.push(
    `- Human decision: ${packet.handoffSnapshot.humanDecision.status} (${packet.handoffSnapshot.humanDecision.readyAssets}/${packet.handoffSnapshot.humanDecision.totalAssets} assets ready)`
  );
  lines.push(
    `- Postiz inputs: ${packet.handoffSnapshot.postizInputs.status} (${packet.handoffSnapshot.postizInputs.missingChecks} missing checks)`
  );
  for (const asset of packet.handoffSnapshot.postizInputs.sourceAssets) {
    lines.push(`- ${asset.label}: ${asset.sourceAssetUrl}`);
  }

  lines.push("", "## Postiz Input Checklist", "");
  lines.push(
    `- Integration slots: ${packet.postizInputChecklist.integrationSlots
      .map((slot) => slot.platform)
      .join(", ")}`
  );
  for (const slot of packet.postizInputChecklist.integrationSlots) {
    lines.push(
      `- ${slot.platform}: ${slot.status} in ${slot.localInputFile}; fields ${slot.requiredFields.join(", ")}`
    );
  }
  lines.push(
    `- Media upload refs: ${packet.postizInputChecklist.summary.readyMediaAssets}/${packet.postizInputChecklist.summary.requiredMediaAssets} ready`
  );
  for (const item of packet.postizInputChecklist.mediaUploadRefs) {
    lines.push(`- ${item.label}: ${item.sourceAssetUrl}`);
  }

  lines.push("", "## Forbidden Actions", "");
  for (const action of packet.forbiddenActions) {
    lines.push(`- ${action}`);
  }

  lines.push("", "## Next Action", "", `- ${packet.nextAction}`, "");
  return `${lines.join("\n")}\n`;
}

function makeUiSummary(packet) {
  return {
    campaignId: packet.campaignId,
    status: packet.status,
    commandOnly: packet.commandOnly,
    networkCallsAllowed: packet.networkCallsAllowed,
    liveActionsEnabled: packet.liveActionsEnabled,
    summary: packet.summary,
    currentBlockers: packet.currentBlockers,
    nextSafeActions: packet.nextSafeActions,
    gatedUpcomingActions: packet.gatedUpcomingActions,
    operatorFiles: packet.operatorFiles,
    postizValidation: packet.postizValidation,
    handoffSnapshot: packet.handoffSnapshot,
    postizInputChecklist: packet.postizInputChecklist,
    forbiddenActions: packet.forbiddenActions,
    nextAction: packet.nextAction
  };
}

export function buildMvpOperatorPacket({
  completionAudit,
  finishPath,
  postizLocalValidation,
  humanApprovalHandoff = null,
  postizInputKit = null,
  generatedAt = new Date().toISOString()
}) {
  const campaignId = completionAudit?.campaignId || finishPath?.campaignId || "";
  const currentBlockers = blockedRequirements(completionAudit);
  const nextSafeActions = (finishPath?.steps || [])
    .filter((step) => step.status === "available")
    .map(safeAction);
  const gatedUpcomingActions = (finishPath?.steps || [])
    .filter((step) => step.status !== "available" && step.status !== "complete")
    .map((step) => gatedAction(step, currentBlockers));
  const packet = {
    packageType: "social_studio_mvp_operator_packet",
    generatedAt,
    campaignId,
    status: finishPath?.status || completionAudit?.status || "unknown",
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    summary: {
      totalRequirements: completionAudit?.summary?.totalRequirements || 0,
      completeRequirements: completionAudit?.summary?.completeRequirements || 0,
      blockedRequirements: completionAudit?.summary?.blockedRequirements || 0,
      currentStep: finishPath?.summary?.currentStep || ""
    },
    currentBlockers,
    nextSafeActions,
    gatedUpcomingActions,
    operatorFiles: operatorFiles(campaignId).map((file) => ({ ...file, file: displayPath(file.file) })),
    postizValidation: {
      status: postizLocalValidation?.status || "unknown",
      readyForDryRun: postizLocalValidation?.readyForDryRun === true,
      missingChecks: postizLocalValidation?.summary?.missingChecks || 0,
      secretFieldCount: postizLocalValidation?.summary?.secretFieldCount || 0,
      networkCallsAllowed: postizLocalValidation?.networkCallsAllowed === true,
      liveActionsEnabled: postizLocalValidation?.liveActionsEnabled === true
    },
    handoffSnapshot: makeHandoffSnapshot({ humanApprovalHandoff, postizInputKit }),
    postizInputChecklist: makePostizInputChecklist(postizInputKit),
    forbiddenActions: [
      "Do not call the Postiz API from this MVP packet.",
      "Do not schedule or publish any social post from this MVP packet.",
      "Do not paste API keys, access tokens, or secrets into local Postiz input files.",
      "Do not treat the MVP as complete until approval, real Postiz inputs, dry-run package, and completion audit are all green."
    ],
    nextAction:
      finishPath?.nextAction ||
      completionAudit?.nextAction ||
      postizLocalValidation?.nextAction ||
      "Refresh the operator packet after the current blocker changes."
  };

  packet.uiSummary = makeUiSummary(packet);
  packet.markdown = makeMarkdown(packet);
  return packet;
}

export async function buildMvpOperatorPacketFromFiles({
  completionAuditPath,
  finishPathPath,
  postizLocalValidationPath,
  humanApprovalHandoffPath = "",
  postizInputKitPath = "",
  outDir,
  generatedAt
}) {
  const packet = buildMvpOperatorPacket({
    completionAudit: await readJson(completionAuditPath),
    finishPath: await readJson(finishPathPath),
    postizLocalValidation: await readJson(postizLocalValidationPath),
    humanApprovalHandoff: await readOptionalJson(humanApprovalHandoffPath),
    postizInputKit: await readOptionalJson(postizInputKitPath),
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "mvp-operator-packet.json");
  const uiPath = path.join(outDir, "mvp-operator-packet.ui.json");
  const markdownPath = path.join(outDir, "mvp-operator-packet.md");
  await writeFile(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(packet.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, packet.markdown);

  return {
    status: packet.status,
    jsonPath,
    uiPath,
    markdownPath
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildMvpOperatorPacketFromFiles({
    completionAuditPath: readArg("completion-audit", path.join(generatedDir, "mvp-completion-audit", "mvp-completion-audit.ui.json")),
    finishPathPath: readArg("finish-path", path.join(generatedDir, "mvp-finish-path", "mvp-finish-path.ui.json")),
    postizLocalValidationPath: readArg(
      "postiz-local-validation",
      path.join(generatedDir, "postiz-input-kit", "postiz-local-input-validation.ui.json")
    ),
    humanApprovalHandoffPath: readArg(
      "human-approval-handoff",
      path.join(generatedDir, "human-approval-handoff", "human-approval-handoff.ui.json")
    ),
    postizInputKitPath: readArg("postiz-input-kit", path.join(generatedDir, "postiz-input-kit", "postiz-input-kit.ui.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "mvp-operator-packet"))
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
