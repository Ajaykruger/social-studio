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

function assertNeedsReviewBundle(bundle) {
  if (bundle?.reviewStatus?.status !== "needs_review" || bundle?.postizHandoff?.status !== "needs_review") {
    throw new Error("review decision commands require a needs_review bundle");
  }
  if (bundle?.postizHandoff?.review?.notLiveConfirmed !== true) {
    throw new Error("review decision commands require notLiveConfirmed true");
  }
  return true;
}

function decisionCommand({ campaignId, decision, reviewer, evidence, notes }) {
  const base = [
    "node social-studio\\tools\\run-review-decision-cycle.mjs `",
    `  --input="social-studio\\generated\\${campaignId}\\draft-bundle.json" \``,
    `  --out-dir="social-studio\\generated\\${campaignId}" \``
  ];

  if (decision === "approve") {
    base.push(`  --manual-package-dir="social-studio\\handoff\\postiz\\approved\\${campaignId}" \``);
    base.push(`  --review-board="social-studio\\generated\\${campaignId}\\review-board\\review-board.json" \``);
  }

  base.push(
    `  --decision=${decision} \``,
    `  --reviewer="${reviewer}" \``,
    `  --evidence="${evidence}" \``,
    `  --notes="${notes}"`
  );

  return base.join("\n");
}

function decisionEffect(decision) {
  if (decision === "approve") {
    return {
      createsApprovedBundle: true,
      createsManualPostizPackage: true,
      keepsPostizBlocked: false,
      allowsSchedulingOrPublishing: false,
      operatorSummary:
        "Creates the approved bundle and manual Postiz package for Postiz draft upload only. Scheduling and publishing still need separate approval."
    };
  }

  if (decision === "needs_revision") {
    return {
      createsApprovedBundle: false,
      createsManualPostizPackage: false,
      keepsPostizBlocked: true,
      allowsSchedulingOrPublishing: false,
      operatorSummary:
        "Keeps Postiz blocked and records the requested changes before any draft upload can continue."
    };
  }

  return {
    createsApprovedBundle: false,
    createsManualPostizPackage: false,
    keepsPostizBlocked: true,
    allowsSchedulingOrPublishing: false,
    operatorSummary:
      "Stops this asset from continuing to Postiz. No approved bundle, draft upload, scheduling, or publishing is created."
  };
}

function evidenceChecklistFor(decision) {
  const reviewedAssets = [
    "UGC video evidence reviewed",
    "Paid ad video evidence reviewed",
    "Normal post evidence reviewed",
    "Artifact freshness checked"
  ];
  if (decision === "approve") {
    return [
      ...reviewedAssets,
      "Rollback and not-live proof reviewed",
      "Approved for Postiz draft upload only"
    ];
  }
  if (decision === "needs_revision") {
    return [
      ...reviewedAssets,
      "Revision notes describe exactly what must change",
      "Postiz remains blocked"
    ];
  }
  return [
    ...reviewedAssets,
    "Rejection notes describe why the campaign should stop",
    "Postiz remains blocked"
  ];
}

function evidenceTextFor(decision) {
  return evidenceChecklistFor(decision).join("; ");
}

function noteGuidanceFor(decision) {
  if (decision === "needs_revision") {
    return "Edit --notes with specific revision notes before running.";
  }
  if (decision === "reject") {
    return "Edit --notes with specific rejection notes before running.";
  }
  return "Approval notes are already scoped to Postiz draft upload only.";
}

function makeCommands({ campaignId, reviewer }) {
  return [
    {
      decision: "approve",
      label: "Approve",
      resultStatus: "approved_waiting_postiz_dry_run",
      effect: decisionEffect("approve"),
      evidenceChecklist: evidenceChecklistFor("approve"),
      requiresNoteEdit: false,
      copyEnabled: true,
      noteGuidance: noteGuidanceFor("approve"),
      command: decisionCommand({
        campaignId,
        decision: "approve",
        reviewer,
        evidence: evidenceTextFor("approve"),
        notes: "Approved for Postiz draft upload only. Do not publish without separate approval."
      })
    },
    {
      decision: "needs_revision",
      label: "Needs revision",
      resultStatus: "needs_revision",
      effect: decisionEffect("needs_revision"),
      evidenceChecklist: evidenceChecklistFor("needs_revision"),
      requiresNoteEdit: true,
      copyEnabled: false,
      noteGuidance: noteGuidanceFor("needs_revision"),
      command: decisionCommand({
        campaignId,
        decision: "needs_revision",
        reviewer,
        evidence: evidenceTextFor("needs_revision"),
        notes: "EDIT REQUIRED: add specific revision notes before running."
      })
    },
    {
      decision: "reject",
      label: "Reject",
      resultStatus: "rejected",
      effect: decisionEffect("reject"),
      evidenceChecklist: evidenceChecklistFor("reject"),
      requiresNoteEdit: true,
      copyEnabled: false,
      noteGuidance: noteGuidanceFor("reject"),
      command: decisionCommand({
        campaignId,
        decision: "reject",
        reviewer,
        evidence: evidenceTextFor("reject"),
        notes: "EDIT REQUIRED: add specific rejection notes before running."
      })
    }
  ];
}

function makeSummary(commands) {
  return {
    commandCount: commands.length,
    liveActionsEnabled: false,
    blocker: "Human review decision is required before Postiz draft creation.",
    nextAction: "Review all generated assets, then copy approve or edit notes before running needs_revision or reject."
  };
}

function makeMarkdown(packet) {
  const lines = [
    "# Review Decision Commands",
    "",
    `Campaign: ${packet.campaignId}`,
    `Status: ${packet.status}`,
    `Blocker: ${packet.summary.blocker}`,
    `Next action: ${packet.summary.nextAction}`,
    "",
    "These commands are copy-only. They do not run from the app.",
    ""
  ];

  for (const command of packet.commands) {
    lines.push(
      `## ${command.label}`,
      "",
      `- Result: ${command.effect.operatorSummary}`,
      `- Creates approved bundle: ${command.effect.createsApprovedBundle ? "yes" : "no"}`,
      `- Creates manual Postiz package: ${command.effect.createsManualPostizPackage ? "yes" : "no"}`,
      `- Scheduling or publishing allowed: ${command.effect.allowsSchedulingOrPublishing ? "yes" : "no"}`,
      command.copyEnabled ? "- Copy: enabled" : "- Copy disabled until notes are edited",
      "",
      "Evidence checklist:",
      ...command.evidenceChecklist.map((item) => `- ${item}`),
      "",
      "```powershell",
      command.command,
      "```",
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

function makeUiSummary(packet) {
  return {
    campaignId: packet.campaignId,
    assetId: packet.assetId,
    status: packet.status,
    commandOnly: packet.commandOnly,
    liveActionsEnabled: packet.liveActionsEnabled,
    summary: packet.summary,
    commands: packet.commands.map((command) => ({
      decision: command.decision,
      label: command.label,
      resultStatus: command.resultStatus,
      effect: command.effect,
      evidenceChecklist: command.evidenceChecklist,
      requiresNoteEdit: command.requiresNoteEdit,
      copyEnabled: command.copyEnabled,
      noteGuidance: command.noteGuidance,
      command: command.command
    }))
  };
}

export function buildReviewDecisionCommands({
  bundle,
  reviewer = "Andre",
  generatedAt = new Date().toISOString()
}) {
  assertNeedsReviewBundle(bundle);
  const campaignId = bundle.campaignId;
  const commands = makeCommands({ campaignId, reviewer });
  const packet = {
    packageType: "social_studio_review_decision_commands",
    generatedAt,
    campaignId,
    assetId: bundle.assetId,
    status: bundle.reviewStatus.status,
    commandOnly: true,
    liveActionsEnabled: false,
    summary: makeSummary(commands),
    commands
  };
  packet.uiSummary = makeUiSummary(packet);
  packet.markdown = makeMarkdown(packet);
  return packet;
}

export async function buildReviewDecisionCommandsFromFiles({
  bundlePath,
  outDir,
  reviewer,
  generatedAt
}) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const packet = buildReviewDecisionCommands({ bundle, reviewer, generatedAt });
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "review-decision-commands.json"), `${JSON.stringify(packet, null, 2)}\n`);
  await writeFile(path.join(outDir, "review-decision-commands.ui.json"), `${JSON.stringify(packet.uiSummary, null, 2)}\n`);
  await writeFile(path.join(outDir, "review-decision-commands.md"), packet.markdown);
  return { outDir, status: packet.status };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildReviewDecisionCommandsFromFiles({
    bundlePath: readArg("bundle", path.join(generatedDir, "draft-bundle.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "review-decision-commands")),
    reviewer: readArg("reviewer", "Andre")
  });
  console.log(`out_dir=${result.outDir}`);
  console.log(`status=${result.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
