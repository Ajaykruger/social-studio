import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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

function isRealReviewer(value) {
  const clean = String(value || "").trim();
  return Boolean(clean && clean !== "pending-human-review");
}

function allReviewChecksPassed(checks = {}) {
  const values = Object.values(checks);
  return values.length > 0 && values.every((value) => value === true);
}

function hasReadyMoneyPrinterTask(bundle) {
  if (bundle?.moneyprinterTask) {
    return bundle.moneyprinterTask.state === 1 && bundle.moneyprinterTask.progress === 100;
  }
  return Boolean(bundle?.postizHandoff?.media?.localPath);
}

function dryRunIsSafe(postizDryRunPackage) {
  if (!postizDryRunPackage) return false;
  return (
    postizDryRunPackage.packageType === "postiz_api_draft_dry_run" &&
    postizDryRunPackage.dryRunOnly === true &&
    postizDryRunPackage.transport?.networkCallsAllowed === false &&
    postizDryRunPackage.postizPayload?.type === "draft" &&
    postizDryRunPackage.safety?.notLiveConfirmed === true
  );
}

function pushBlocker(blockers, condition, message) {
  if (condition) {
    blockers.push(message);
  }
}

function stage(status, label, evidence = "") {
  return { status, label, evidence };
}

function makeMarkdown(status) {
  const lines = [
    "# Crystal Clawz Social Studio Status",
    "",
    `Generated: ${status.generatedAt}`,
    `Campaign: ${status.campaignId}`,
    `Asset: ${status.assetId}`,
    `Overall status: ${status.overall.status}`,
    "",
    "## Safety",
    "",
    `- Nothing has been posted live: ${status.safety.noLivePosting ? "yes" : "no"}`,
    `- Live scheduling/publishing allowed: ${status.readiness.canScheduleOrPublish ? "yes" : "no"}`,
    `- Postiz API draft creation ready: ${status.readiness.canCreatePostizDraft ? "yes" : "no"}`,
    "",
    "## Artifact Freshness",
    "",
    `- Status generated: ${status.generatedAt}`,
    `- Source bundle generated: ${status.source?.generatedAt || ""}`,
    `- Source bundle: ${status.source?.bundle || "draft-bundle.json"}`,
    `- Generated path: ${generatedPathFor(status.campaignId)}`,
    "",
    "## Stages",
    ""
  ];

  for (const [name, item] of Object.entries(status.stages)) {
    lines.push(`- ${name}: ${item.status} - ${item.label}`);
  }

  lines.push("", "## Blockers", "");
  if (status.blockers.length) {
    for (const blocker of status.blockers) {
      lines.push(`- ${blocker}`);
    }
  } else {
    lines.push("- No current blockers for draft handoff.");
  }

  lines.push("", "## Next Actions", "");
  for (const action of status.nextActions) {
    lines.push(`- ${action}`);
  }

  return `${lines.join("\n")}\n`;
}

function statusLabel(status) {
  const labels = {
    needs_review: "Needs review",
    approved_waiting_postiz_dry_run: "Approved, waiting for Postiz dry run",
    postiz_draft_ready: "Postiz draft ready",
    blocked: "Blocked",
    needs_revision: "Needs revision",
    rejected: "Rejected"
  };
  return labels[status] || status;
}

function generatedPathFor(campaignId) {
  return campaignId ? `social-studio/generated/${campaignId}` : "social-studio/generated";
}

function makeUiSummary(status) {
  return {
    campaignId: status.campaignId,
    status: status.overall.status,
    statusLabel: statusLabel(status.overall.status),
    freshness: {
      generatedAt: status.generatedAt,
      sourceGeneratedAt: status.source?.generatedAt || "",
      sourceBundle: status.source?.bundle || "draft-bundle.json",
      generatedPath: generatedPathFor(status.campaignId)
    },
    noLivePosting: status.safety.noLivePosting,
    postizDraftReady: status.readiness.canCreatePostizDraft,
    scheduleOrPublishReady: status.readiness.canScheduleOrPublish,
    stages: [
      { name: "Brand", status: status.stages.brandContext.status, label: status.stages.brandContext.label },
      { name: "MoneyPrinter", status: status.stages.moneyprinterDraft.status, label: status.stages.moneyprinterDraft.label },
      { name: "Review", status: status.stages.humanReview.status, label: status.stages.humanReview.label },
      { name: "Postiz manual", status: status.stages.postizManualPackage.status, label: status.stages.postizManualPackage.label },
      { name: "Postiz API draft", status: status.stages.postizApiDraft.status, label: status.stages.postizApiDraft.label }
    ],
    blocker: status.blockers[0] || "",
    nextAction: status.nextActions[0] || ""
  };
}

export function buildWorkflowStatus({
  bundle,
  postizDryRunPackage = null,
  generatedAt = new Date().toISOString(),
  artifactPresence = {}
}) {
  const reviewStatus = bundle?.reviewStatus || {};
  const handoff = bundle?.postizHandoff || {};
  const handoffReview = handoff.review || {};
  const approved =
    reviewStatus.status === "approved" &&
    handoff.status === "draft_upload_ready" &&
    isRealReviewer(handoffReview.approvedBy) &&
    Boolean(handoffReview.approvedAt) &&
    handoffReview.notLiveConfirmed === true &&
    allReviewChecksPassed(reviewStatus.checks);
  const moneyprinterReady = Boolean(artifactPresence.moneyprinterVideo && hasReadyMoneyPrinterTask(bundle));
  const manualPackageReady = Boolean(artifactPresence.manualPackage && handoff.handoffMode === "manual_upload");
  const safeDryRun = dryRunIsSafe(postizDryRunPackage);
  const manualPackageLabel = manualPackageReady
    ? approved
      ? "Manual Postiz package exists for approved Postiz draft upload."
      : "Manual Postiz preview package exists for review only until approval."
    : "Manual package is missing.";

  const blockers = [];
  pushBlocker(blockers, !artifactPresence.brandContext, "Brand context artifact is missing.");
  pushBlocker(blockers, !moneyprinterReady, "MoneyPrinterTurbo draft video is missing or not complete.");
  pushBlocker(blockers, !manualPackageReady, "Manual Postiz review package is missing.");
  pushBlocker(blockers, !approved, "Human review approval is required before Postiz draft creation.");
  pushBlocker(
    blockers,
    Boolean(postizDryRunPackage) && !safeDryRun,
    "Postiz dry-run package is unsafe or would allow network calls."
  );

  const canCreatePostizDraft = approved && safeDryRun;
  const hasUnsafeDryRun = Boolean(postizDryRunPackage) && !safeDryRun;
  const overallStatus = hasUnsafeDryRun
    ? "blocked"
    : canCreatePostizDraft
      ? "postiz_draft_ready"
      : approved
        ? "approved_waiting_postiz_dry_run"
        : reviewStatus.status || "needs_review";

  const nextActions = [];
  if (!approved) {
    nextActions.push("Complete human review of all generated assets and record approve, needs_revision, or reject.");
  } else if (!safeDryRun) {
    nextActions.push("Upload approved media to local Postiz, capture returned media id/path, then build the dry-run draft payload.");
  } else {
    nextActions.push("Use the dry-run payload to create a Postiz draft only after separate approval for API use.");
  }
  nextActions.push("Keep live scheduling and publishing disabled until there is separate final scheduling/publishing approval.");

  const status = {
    packageType: "social_studio_workflow_status",
    generatedAt,
    campaignId: bundle?.campaignId || "",
    assetId: bundle?.assetId || "",
    source: {
      bundle: "draft-bundle.json",
      generatedAt: bundle?.generatedAt || ""
    },
    overall: {
      status: overallStatus,
      mvpComplete: false,
      reason: "MVP remains review-first and no live posting has been approved."
    },
    readiness: {
      canCreatePostizDraft,
      canScheduleOrPublish: false,
      needsHumanReview: !approved
    },
    safety: {
      noLivePosting: handoffReview.notLiveConfirmed === true,
      crossPostResults: bundle?.moneyprinterTask?.crossPostResults ?? null,
      secretsRequired: false
    },
    stages: {
      brandContext: stage(
        artifactPresence.brandContext ? "ready" : "missing",
        artifactPresence.brandContext ? "Brand context index exists." : "Brand context index needs to be created."
      ),
      moneyprinterDraft: stage(
        moneyprinterReady ? "ready" : "blocked",
        moneyprinterReady ? "MoneyPrinterTurbo draft asset is present." : "MoneyPrinterTurbo draft asset is not ready."
      ),
      humanReview: stage(
        approved ? "ready" : "blocked",
        approved ? `Approved by ${handoffReview.approvedBy}.` : "Human review is still required."
      ),
      postizManualPackage: stage(
        manualPackageReady ? "ready" : "missing",
        manualPackageLabel
      ),
      postizApiDraft: stage(
        canCreatePostizDraft ? "ready" : "blocked",
        canCreatePostizDraft
          ? "Postiz API draft dry-run package is ready."
          : "Postiz API draft dry-run is not ready."
      )
    },
    blockers,
    nextActions,
    artifacts: {
      brandContext: Boolean(artifactPresence.brandContext),
      manualPackage: Boolean(artifactPresence.manualPackage),
      moneyprinterVideo: Boolean(artifactPresence.moneyprinterVideo),
      postizDryRunPackage: Boolean(artifactPresence.postizDryRunPackage)
    }
  };

  status.markdown = makeMarkdown(status);
  status.uiSummary = makeUiSummary(status);
  return status;
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
    return info.size;
  } catch {
    return 0;
  }
}

async function readJsonIfExists(filePath) {
  if (!(await exists(filePath))) return null;
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function buildWorkflowStatusFromFiles({
  bundlePath,
  postizDryRunPath = "",
  jsonOut,
  uiOut = "",
  markdownOut,
  generatedAt,
  artifactPresence
}) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const postizDryRunPackage = await readJsonIfExists(postizDryRunPath);
  const presence =
    artifactPresence ||
    {
      brandContext: await exists(path.join(studioRoot, "brand-brain", "brand-context-index.md")),
      manualPackage: await exists(
        path.join(studioRoot, "handoff", "postiz", "manual", bundle.campaignId, "manifest.json")
      ),
      moneyprinterVideo: (await fileSize(bundle.postizHandoff?.media?.localPath)) > 0,
      postizDryRunPackage: Boolean(postizDryRunPackage)
    };

  const status = buildWorkflowStatus({
    bundle,
    postizDryRunPackage,
    generatedAt,
    artifactPresence: presence
  });

  await mkdir(path.dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, `${JSON.stringify(status, null, 2)}\n`);
  if (uiOut) {
    await mkdir(path.dirname(uiOut), { recursive: true });
    await writeFile(uiOut, `${JSON.stringify(status.uiSummary, null, 2)}\n`);
  }
  await writeFile(markdownOut, status.markdown);
  return { jsonOut, uiOut, markdownOut, status: status.overall.status };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const bundlePath = readArg("bundle", path.join(generatedDir, "draft-bundle.json"));
  const postizDryRunPath = readArg("postiz-dry-run", path.join(generatedDir, "postiz-draft.dry-run.json"));
  const jsonOut = readArg("json-out", path.join(generatedDir, "workflow-status.json"));
  const uiOut = readArg("ui-out", path.join(generatedDir, "workflow-status.ui.json"));
  const markdownOut = readArg("markdown-out", path.join(generatedDir, "workflow-status.md"));

  const result = await buildWorkflowStatusFromFiles({
    bundlePath,
    postizDryRunPath,
    jsonOut,
    uiOut,
    markdownOut
  });

  console.log(`json=${result.jsonOut}`);
  console.log(`ui=${result.uiOut}`);
  console.log(`markdown=${result.markdownOut}`);
  console.log(`status=${result.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
