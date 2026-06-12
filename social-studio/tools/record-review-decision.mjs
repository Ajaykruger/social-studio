import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const DECISIONS = new Set(["approve", "needs_revision", "reject"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireText(value, label) {
  const clean = String(value || "").trim();
  if (!clean) {
    throw new Error(`${label} is required`);
  }
  return clean;
}

function requireReviewer(value) {
  const reviewer = requireText(value, "real human reviewer");
  if (reviewer === "pending-human-review") {
    throw new Error("a real human reviewer is required");
  }
  return reviewer;
}

function approvalTimestamp(value) {
  const clean = requireText(value, "approval timestamp");
  if (clean.length < 10) {
    throw new Error("approval timestamp is too short");
  }
  return clean;
}

function requireSpecificDecisionNotes(value, decision) {
  const notes = requireText(value, "specific decision notes");
  const lower = notes.toLowerCase();
  const genericFragments = [
    "describe exactly what must change",
    "describe why this asset should not continue",
    "update this text",
    "edit required"
  ];
  if (genericFragments.some((fragment) => lower.includes(fragment))) {
    throw new Error(`specific decision notes are required for ${decision}`);
  }
  return notes;
}

const APPROVAL_EVIDENCE_REQUIREMENTS = [
  {
    label: "UGC video evidence reviewed",
    pattern: /ugc video evidence reviewed/i
  },
  {
    label: "Paid ad video evidence reviewed",
    pattern: /paid ad video evidence reviewed/i
  },
  {
    label: "Normal post evidence reviewed",
    pattern: /normal post evidence reviewed/i
  },
  {
    label: "Artifact freshness checked",
    pattern: /artifact freshness checked/i
  },
  {
    label: "Rollback and not-live proof reviewed",
    pattern: /rollback and not-live proof reviewed/i
  },
  {
    label: "Approved for Postiz draft upload only",
    pattern: /approved for postiz draft upload only/i
  }
];

function requireApprovalEvidenceCoverage(value) {
  const evidence = requireText(value, "approval evidence");
  const missing = APPROVAL_EVIDENCE_REQUIREMENTS.filter((requirement) => !requirement.pattern.test(evidence));
  if (missing.length > 0) {
    throw new Error(`approval evidence must include: ${missing.map((requirement) => requirement.label).join("; ")}`);
  }
  return evidence;
}

function makeApprovalEvidenceSummary(evidence) {
  const gates = APPROVAL_EVIDENCE_REQUIREMENTS.map((requirement) => ({
    label: requirement.label,
    status: requirement.pattern.test(evidence) ? "covered" : "blocked"
  }));
  const coveredGates = gates.filter((gate) => gate.status === "covered").length;
  return {
    status: coveredGates === gates.length ? "covered" : "blocked",
    summary: {
      totalGates: gates.length,
      coveredGates,
      blockedGates: gates.length - coveredGates
    },
    gates
  };
}

function makeApprovalScope() {
  return {
    approvedFor: "postiz_draft_upload_only",
    allowsSchedulingOrPublishing: false,
    requiresSeparateScheduleOrPublishApproval: true
  };
}

function allChecks(value) {
  return {
    brandFit: value,
    claimSafe: value,
    productVisible: value,
    captionReady: value,
    ctaReady: value,
    platformReady: value,
    notLive: true
  };
}

export function assertRealApproval(handoff) {
  const review = handoff?.review || {};
  requireReviewer(review.approvedBy);
  approvalTimestamp(review.approvedAt);
  if (review.notLiveConfirmed !== true) {
    throw new Error("notLiveConfirmed must be true");
  }
  return true;
}

export function applyReviewDecision(bundle, options) {
  const decision = String(options?.decision || "").trim();
  if (!DECISIONS.has(decision)) {
    throw new Error("decision must be approve, needs_revision, or reject");
  }

  const reviewer = requireReviewer(options?.reviewer);
  const evidence =
    decision === "approve"
      ? requireApprovalEvidenceCoverage(options?.evidence)
      : requireText(options?.evidence, "approval evidence");
  const decidedAt = approvalTimestamp(options?.approvedAt || new Date().toISOString());
  const notes =
    decision === "approve"
      ? String(options?.notes || "").trim()
      : requireSpecificDecisionNotes(options?.notes, decision);
  const next = clone(bundle);

  next.reviewStatus.reviewer = reviewer;
  next.reviewStatus.notes = notes || evidence;

  if (decision === "approve") {
    next.reviewStatus.status = "approved";
    next.reviewStatus.checks = allChecks(true);
    next.reviewStatus.approval = {
      approvedBy: reviewer,
      approvedAt: decidedAt,
      approvalEvidence: evidence,
      evidenceSummary: makeApprovalEvidenceSummary(evidence),
      scope: makeApprovalScope()
    };

    next.postizHandoff.status = "draft_upload_ready";
    next.postizHandoff.scheduledFor = next.postizHandoff.scheduledFor || "";
    next.postizHandoff.review = {
      approvedBy: reviewer,
      approvedAt: decidedAt,
      notLiveConfirmed: true,
      notes: notes || "Approved for manual Postiz draft upload only."
    };
    assertRealApproval(next.postizHandoff);
    return next;
  }

  const status = decision === "reject" ? "rejected" : "needs_revision";
  next.reviewStatus.status = status;
  next.reviewStatus.checks = {
    ...next.reviewStatus.checks,
    notLive: true
  };
  next.reviewStatus.approval = {
    approvedBy: "",
    approvedAt: "",
    approvalEvidence: evidence
  };
  next.postizHandoff.status = "needs_review";
  next.postizHandoff.scheduledFor = "";
  next.postizHandoff.review = {
    approvedBy: "pending-human-review",
    approvedAt: "",
    notLiveConfirmed: true,
    notes: notes || evidence
  };
  return next;
}

applyReviewDecision.fromFiles = async function fromFiles({
  input,
  output,
  decision,
  reviewer,
  evidence,
  approvedAt,
  notes
}) {
  const bundle = JSON.parse(await readFile(input, "utf8"));
  const updated = applyReviewDecision(bundle, {
    decision,
    reviewer,
    evidence,
    approvedAt,
    notes
  });
  await writeFile(output, `${JSON.stringify(updated, null, 2)}\n`);
  return { output, status: updated.reviewStatus.status };
};

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const input = readArg("input");
  const output = readArg("output");
  if (!input || !output) {
    throw new Error("usage: record-review-decision --input=<bundle> --output=<bundle> --decision=<approve|needs_revision|reject> --reviewer=<name> --evidence=<text>");
  }
  const result = await applyReviewDecision.fromFiles({
    input,
    output,
    decision: readArg("decision"),
    reviewer: readArg("reviewer"),
    evidence: readArg("evidence"),
    approvedAt: readArg("approved-at", new Date().toISOString()),
    notes: readArg("notes")
  });
  console.log(`output=${result.output}`);
  console.log(`status=${result.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
