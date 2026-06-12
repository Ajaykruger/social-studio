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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readOptionalText(filePath) {
  if (!(await exists(filePath))) return "";
  return readFile(filePath, "utf8");
}

function completeRequirement(id, label, isComplete, detail) {
  return {
    id,
    label,
    status: isComplete ? "complete" : "blocked",
    detail
  };
}

function gateReady(readinessAudit, id) {
  return readinessAudit?.gates?.[id]?.status === "ready";
}

function allGatesReady(readinessAudit, ids) {
  return ids.every((id) => gateReady(readinessAudit, id));
}

function isSafeCommandCenter(commandCenter) {
  return Boolean(
    commandCenter?.commandOnly === true &&
      commandCenter?.networkCallsAllowed === false &&
      commandCenter?.liveActionsEnabled === false
  );
}

function postizInputSafetyReady(postizInputKit, postizReadiness = null) {
  const localSafetyStep = postizReadiness?.steps?.find((step) => step.id === "local_input_safety");
  const localSafetyStepReady = !localSafetyStep || localSafetyStep.status === "ready";

  return Boolean(
    postizInputKit?.networkCallsAllowed === false &&
      postizInputKit?.secretsInUi === false &&
      postizInputKit?.validation?.inputSecretsReady === true &&
      Number(postizInputKit?.validation?.secretFieldCount || 0) === 0 &&
      localSafetyStepReady
  );
}

function postizInputsReady(postizInputKit, postizReadiness = null) {
  return Boolean(
    postizInputKit?.status === "ready" &&
      postizInputKit?.networkCallsAllowed === false &&
      postizInputKit?.secretsInUi === false &&
      postizInputSafetyReady(postizInputKit, postizReadiness) &&
      postizInputKit?.validation?.uploadedMediaReady === true &&
      postizInputKit?.validation?.integrationsReady === true
  );
}

function postizLocalValidationReady(postizLocalValidation, realPostizInputsReady = false) {
  const safeReport = Boolean(
    postizLocalValidation?.commandOnly === true &&
      postizLocalValidation?.networkCallsAllowed === false &&
      postizLocalValidation?.liveActionsEnabled === false &&
      Number(postizLocalValidation?.summary?.secretFieldCount || 0) === 0
  );
  if (!safeReport) return false;
  if (realPostizInputsReady) {
    return Boolean(postizLocalValidation?.status === "ready" && postizLocalValidation?.readyForDryRun === true);
  }
  return Boolean(postizLocalValidation?.status === "blocked" && postizLocalValidation?.readyForDryRun === false);
}

function postizDryRunReady({ workflowStatus, readinessAudit, postizReadiness, postizDryRunExists }) {
  return Boolean(
    postizDryRunExists &&
      workflowStatus?.overall?.status === "postiz_draft_ready" &&
      workflowStatus?.readiness?.canCreatePostizDraft === true &&
      workflowStatus?.artifacts?.postizDryRunPackage === true &&
      readinessAudit?.overall?.status === "draft_mvp_ready" &&
      gateReady(readinessAudit, "postizApiDryRun") &&
      postizReadiness?.status === "dry_run_ready" &&
      postizReadiness?.dryRunOnly === true &&
      postizReadiness?.networkCallsAllowed === false
  );
}

function rollbackProofReady({ rollbackNote, noLivePostingReady, workflowStatus, postizReadiness, commandCenter }) {
  const note = String(rollbackNote || "");
  return Boolean(
    noLivePostingReady &&
      /rollback/i.test(note) &&
      /(not[- ]live|unpublished|draft[- ]only|draft only)/i.test(note) &&
      workflowStatus?.safety?.crossPostResults === null &&
      postizReadiness?.noLivePosting === true &&
      commandCenter?.liveActionsEnabled === false
  );
}

function agentSkillLoopReady(mvpPlan) {
  const plan = String(mvpPlan || "");
  return Boolean(
    /Skills And Plugins To Use/i.test(plan) &&
      /Agent Lanes/i.test(plan) &&
      /Build-Check-Edit Loop/i.test(plan) &&
      /Superpowers/i.test(plan) &&
      /Postiz agent/i.test(plan) &&
      /MoneyPrinterTurbo agent/i.test(plan)
  );
}

function buildRequirements({
  mvpPlan,
  workflowStatus,
  readinessAudit,
  postizInputKit,
  postizLocalValidation,
  postizReadiness,
  commandCenter,
  rollbackNote,
  approvedBundleExists,
  postizDryRunExists
}) {
  const brandBrainReady = Boolean(
    mvpPlan?.trim() &&
      workflowStatus?.artifacts?.brandContext === true &&
      gateReady(readinessAudit, "planAndBrand")
  );
  const agentLoopReady = agentSkillLoopReady(mvpPlan);
  const contentWorkflowReady = allGatesReady(readinessAudit, [
    "contentPlan",
    "brandClaimLedger",
    "productionPackets",
    "productionQueue",
    "reviewBoard"
  ]);
  const moneyprinterReady = Boolean(
    workflowStatus?.artifacts?.moneyprinterVideo === true &&
      gateReady(readinessAudit, "moneyprinterDraft") &&
      gateReady(readinessAudit, "reviewPacket")
  );
  const reviewFirstHandoffReady = Boolean(
    gateReady(readinessAudit, "manualPostizHandoff") &&
      postizReadiness?.dryRunOnly === true &&
      postizReadiness?.networkCallsAllowed === false &&
      isSafeCommandCenter(commandCenter)
  );
  const noLivePostingReady = Boolean(
    workflowStatus?.safety?.noLivePosting === true &&
      workflowStatus?.readiness?.canScheduleOrPublish === false &&
      gateReady(readinessAudit, "noLivePosting") &&
      postizReadiness?.noLivePosting === true &&
      commandCenter?.liveActionsEnabled === false
  );
  const verificationReady = gateReady(readinessAudit, "verification");
  const postizInputSafety = postizInputSafetyReady(postizInputKit, postizReadiness);
  const rollbackReady = rollbackProofReady({
    rollbackNote,
    noLivePostingReady,
    workflowStatus,
    postizReadiness,
    commandCenter
  });
  const humanApprovalReady = Boolean(
    approvedBundleExists &&
      workflowStatus?.readiness?.needsHumanReview === false &&
      gateReady(readinessAudit, "humanApproval")
  );
  const realPostizInputsReady = postizInputsReady(postizInputKit, postizReadiness);
  const localValidationReady = postizLocalValidationReady(postizLocalValidation, realPostizInputsReady);
  const dryRunReady = postizDryRunReady({
    workflowStatus,
    readinessAudit,
    postizReadiness,
    postizDryRunExists
  });

  const baseRequirements = [
    completeRequirement(
      "brand_brain_and_brief",
      "Brand brain and MVP brief",
      brandBrainReady,
      brandBrainReady ? "Brand context and MVP plan are available." : "Brand context or MVP plan is missing."
    ),
    completeRequirement(
      "agent_skill_loop",
      "Scoped agents, skills, and build-check-edit loop",
      agentLoopReady,
      agentLoopReady
        ? "MVP plan names the plugins, skills, agent lanes, and build-check-edit loop."
        : "Add scoped agents, skills, and build-check-edit loop to the MVP plan."
    ),
    completeRequirement(
      "content_workflow_coverage",
      "UGC, ad video, and post workflow coverage",
      contentWorkflowReady,
      contentWorkflowReady
        ? "UGC video, paid ad video, and normal post assets are planned through review."
        : "One or more content workflow artifacts are missing."
    ),
    completeRequirement(
      "moneyprinter_draft",
      "MoneyPrinterTurbo draft media",
      moneyprinterReady,
      moneyprinterReady ? "Draft video and review packet are available." : "Draft video or review packet is missing."
    ),
    completeRequirement(
      "postiz_review_first_handoff",
      "Postiz review-first handoff",
      reviewFirstHandoffReady,
      reviewFirstHandoffReady
        ? "Postiz handoff remains manual, local, and command-only."
        : "Postiz handoff is missing or not safely review-first."
    ),
    completeRequirement(
      "no_live_posting",
      "No live posting enabled",
      noLivePostingReady,
      noLivePostingReady ? "Scheduling and publishing remain disabled." : "A live-posting safety flag is not locked down."
    ),
    completeRequirement(
      "verified_build_and_scans",
      "Verified tests, build, and scans",
      verificationReady,
      verificationReady ? "Latest readiness audit includes passing verification flags." : "Verification is missing or stale."
    ),
    completeRequirement(
      "postiz_input_safety",
      "Postiz local input safety",
      postizInputSafety,
      postizInputSafety
        ? "Local Postiz input files are checked for API keys, tokens, and secrets."
        : "Remove API keys, tokens, and secrets from local Postiz input files."
    ),
    completeRequirement(
      "postiz_local_input_validation",
      "Postiz local input validation",
      localValidationReady,
      localValidationReady
        ? "Local Postiz input validation report is present, redacted, and safe."
        : "Run the local Postiz input validator and keep its redacted report available."
    ),
    completeRequirement(
      "rollback_not_live_proof",
      "Rollback and not-live proof",
      rollbackReady,
      rollbackReady
        ? "Rollback and not-live proof is documented for the draft-only handoff."
        : "Add rollback and not-live proof before treating the MVP as complete."
    ),
    completeRequirement(
      "human_approval_recorded",
      "Human approval recorded",
      humanApprovalReady,
      humanApprovalReady ? "Approved bundle exists and review is no longer pending." : "Record human approval first."
    ),
    completeRequirement(
      "real_postiz_inputs",
      "Real local Postiz input values",
      realPostizInputsReady,
      realPostizInputsReady
        ? "Real integration IDs and uploaded media references are present."
        : "Real Postiz integration IDs and uploaded media references are still required."
    ),
    completeRequirement(
      "postiz_dry_run_package",
      "Postiz draft dry-run package",
      dryRunReady,
      dryRunReady ? "Draft-only dry-run payload exists with network calls off." : "Dry-run package has not been created."
    )
  ];

  const approvedMvpReady = baseRequirements.every((item) => item.status === "complete");
  return [
    ...baseRequirements,
    completeRequirement(
      "approved_mvp_complete",
      "Approved draft-only MVP complete",
      approvedMvpReady,
      approvedMvpReady
        ? "All draft-only MVP requirements are complete."
        : "The MVP is not complete until every requirement above is complete."
    )
  ];
}

function nextActionFor(requirements) {
  const firstBlocked = requirements.find((item) => item.status === "blocked");
  if (!firstBlocked) {
    return "MVP package is complete for draft-only review-first handoff. Posting still needs separate approval.";
  }

  const actions = {
    brand_brain_and_brief: "Restore the MVP plan and brand context before treating the project as ready.",
    agent_skill_loop: "Restore scoped agents, skills, and build-check-edit loop in the MVP plan.",
    content_workflow_coverage: "Refresh the content plan, claim ledger, packets, queue, and review board.",
    moneyprinter_draft: "Regenerate or restore the MoneyPrinterTurbo draft media and review packet.",
    postiz_review_first_handoff: "Restore the command-only Postiz handoff before continuing.",
    no_live_posting: "Keep scheduling and publishing disabled before continuing.",
    verified_build_and_scans: "Rerun tests, build, secret scan, and UI path-leak scan.",
    postiz_input_safety: "Remove API keys, tokens, and secrets from local Postiz input files before continuing.",
    postiz_local_input_validation: "Run the local Postiz input validator and keep its redacted report available.",
    rollback_not_live_proof: "Add rollback and not-live proof for the draft-only Postiz handoff.",
    human_approval_recorded: "Record human approval before treating the MVP as complete.",
    real_postiz_inputs: "Add real local Postiz integration IDs and uploaded media references, then refresh readiness.",
    postiz_dry_run_package: "Build the Postiz dry-run package after approval and real Postiz inputs are ready.",
    approved_mvp_complete: "Refresh the completion audit after all prior requirements are complete."
  };
  return actions[firstBlocked.id] || "Complete the first blocked requirement.";
}

function makeUiSummary(audit) {
  return {
    campaignId: audit.campaignId,
    status: audit.status,
    mvpComplete: audit.mvpComplete,
    summary: audit.summary,
    nextAction: audit.nextAction,
    requirements: audit.requirements
  };
}

function makeMarkdown(audit) {
  const lines = [
    "# MVP Completion Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    `Campaign: ${audit.campaignId}`,
    `Status: ${audit.status}`,
    `MVP complete: ${audit.mvpComplete ? "yes" : "no"}`,
    "",
    "## Objective",
    "",
    audit.goalText,
    "",
    "## Requirements",
    ""
  ];

  for (const item of audit.requirements) {
    lines.push(`- ${item.label}: ${item.status} - ${item.detail}`);
  }

  lines.push("", "## Next Action", "", `- ${audit.nextAction}`, "");
  return `${lines.join("\n")}\n`;
}

export function buildMvpCompletionAudit({
  goalText = "Complete the Crystal Clawz Social Studio draft-only review-first MVP.",
  mvpPlan = "",
  workflowStatus,
  readinessAudit,
  postizInputKit,
  postizLocalValidation,
  postizReadiness,
  commandCenter,
  rollbackNote = "",
  approvedBundleExists = false,
  postizDryRunExists = false,
  generatedAt = new Date().toISOString()
}) {
  const requirements = buildRequirements({
    mvpPlan,
    workflowStatus,
    readinessAudit,
    postizInputKit,
    postizLocalValidation,
    postizReadiness,
    commandCenter,
    rollbackNote,
    approvedBundleExists,
    postizDryRunExists
  });
  const completeRequirements = requirements.filter((item) => item.status === "complete").length;
  const blockedRequirements = requirements.length - completeRequirements;
  const mvpComplete = blockedRequirements === 0;
  const audit = {
    packageType: "social_studio_mvp_completion_audit",
    generatedAt,
    campaignId: workflowStatus?.campaignId || readinessAudit?.campaignId || postizInputKit?.campaignId || "",
    status: mvpComplete ? "complete" : "incomplete",
    mvpComplete,
    goalText,
    summary: {
      totalRequirements: requirements.length,
      completeRequirements,
      blockedRequirements
    },
    requirements,
    nextAction: nextActionFor(requirements)
  };

  audit.uiSummary = makeUiSummary(audit);
  audit.markdown = makeMarkdown(audit);
  return audit;
}

export async function buildMvpCompletionAuditFromFiles({
  goalText,
  mvpPlanPath,
  workflowStatusPath,
  readinessAuditPath,
  postizInputKitPath,
  postizLocalValidationPath = "",
  postizReadinessPath,
  commandCenterPath,
  rollbackNotePath = path.join(studioRoot, "handoff", "postiz", "rollback-note.md"),
  approvedBundlePath = "",
  postizDryRunPath = "",
  jsonOut,
  uiOut,
  markdownOut,
  generatedAt
}) {
  const audit = buildMvpCompletionAudit({
    goalText,
    mvpPlan: await readFile(mvpPlanPath, "utf8"),
    workflowStatus: await readJson(workflowStatusPath),
    readinessAudit: await readJson(readinessAuditPath),
    postizInputKit: await readJson(postizInputKitPath),
    postizLocalValidation: postizLocalValidationPath ? await readJson(postizLocalValidationPath) : null,
    postizReadiness: await readJson(postizReadinessPath),
    commandCenter: await readJson(commandCenterPath),
    rollbackNote: await readOptionalText(rollbackNotePath),
    approvedBundleExists: await exists(approvedBundlePath),
    postizDryRunExists: await exists(postizDryRunPath),
    generatedAt
  });

  await mkdir(path.dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(uiOut, `${JSON.stringify(audit.uiSummary, null, 2)}\n`);
  await writeFile(markdownOut, audit.markdown);

  return { status: audit.status, jsonOut, uiOut, markdownOut };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const outDir = readArg("out-dir", path.join(generatedDir, "mvp-completion-audit"));
  const result = await buildMvpCompletionAuditFromFiles({
    goalText: readArg(
      "goal",
      "Build a Crystal Clawz Social Studio MVP that wires Postiz, MoneyPrinterTurbo, and brand files into a review-first content workflow."
    ),
    mvpPlanPath: readArg("mvp-plan", path.join(studioRoot, "plans", "mvp-plan.md")),
    workflowStatusPath: readArg("workflow-status", path.join(generatedDir, "workflow-status.json")),
    readinessAuditPath: readArg("readiness-audit", path.join(generatedDir, "mvp-readiness-audit.json")),
    postizInputKitPath: readArg("postiz-input-kit", path.join(generatedDir, "postiz-input-kit", "postiz-input-kit.ui.json")),
    postizLocalValidationPath: readArg(
      "postiz-local-validation",
      path.join(generatedDir, "postiz-input-kit", "postiz-local-input-validation.ui.json")
    ),
    postizReadinessPath: readArg(
      "postiz-readiness",
      path.join(generatedDir, "postiz-dry-run-readiness", "postiz-dry-run-readiness.ui.json")
    ),
    commandCenterPath: readArg("command-center", path.join(generatedDir, "postiz-command-center", "postiz-command-center.ui.json")),
    rollbackNotePath: readArg("rollback-note", path.join(studioRoot, "handoff", "postiz", "rollback-note.md")),
    approvedBundlePath: readArg("approved-bundle", path.join(generatedDir, "approved-bundle.json")),
    postizDryRunPath: readArg("postiz-dry-run", path.join(generatedDir, "postiz-draft.dry-run.json")),
    jsonOut: readArg("json-out", path.join(outDir, "mvp-completion-audit.json")),
    uiOut: readArg("ui-out", path.join(outDir, "mvp-completion-audit.ui.json")),
    markdownOut: readArg("markdown-out", path.join(outDir, "mvp-completion-audit.md"))
  });

  console.log(`status=${result.status}`);
  console.log(`json=${result.jsonOut}`);
  console.log(`ui=${result.uiOut}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
