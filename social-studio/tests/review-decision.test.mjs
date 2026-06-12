import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyReviewDecision,
  assertRealApproval
} from "../tools/record-review-decision.mjs";

function pendingBundle() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    reviewStatus: {
      campaignId: "cc-rubber-base-demo-2026-06-10",
      assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
      status: "needs_review",
      reviewer: "pending-human-review",
      checks: {
        brandFit: false,
        claimSafe: false,
        productVisible: false,
        captionReady: false,
        ctaReady: false,
        platformReady: false,
        notLive: true
      },
      notes: "Needs review.",
      approval: {
        approvedBy: "",
        approvedAt: "",
        approvalEvidence: ""
      }
    },
    postizHandoff: {
      handoffMode: "manual_upload",
      status: "needs_review",
      scheduledFor: "",
      review: {
        approvedBy: "pending-human-review",
        approvedAt: "",
        notLiveConfirmed: true,
        notes: "Preview only."
      }
    }
  };
}

const fullApprovalEvidence = [
  "UGC video evidence reviewed",
  "Paid ad video evidence reviewed",
  "Normal post evidence reviewed",
  "Artifact freshness checked",
  "Rollback and not-live proof reviewed",
  "Approved for Postiz draft upload only"
].join("; ");

test("rejects approval without a real human reviewer", () => {
  const bundle = pendingBundle();

  assert.throws(
    () =>
      applyReviewDecision(bundle, {
        decision: "approve",
        reviewer: "pending-human-review",
        evidence: "visual review",
        approvedAt: "2026-06-10T12:00:00.000Z"
      }),
    /real human reviewer/i
  );
});

test("rejects approval without evidence", () => {
  const bundle = pendingBundle();

  assert.throws(
    () =>
      applyReviewDecision(bundle, {
        decision: "approve",
        reviewer: "Andre",
        evidence: "",
        approvedAt: "2026-06-10T12:00:00.000Z"
      }),
    /approval evidence/i
  );
});

test("rejects approval evidence that does not cover every required review gate", () => {
  const bundle = pendingBundle();

  assert.throws(
    () =>
      applyReviewDecision(bundle, {
        decision: "approve",
        reviewer: "Andre",
        evidence: "Reviewed contact sheet and MP4 locally.",
        approvedAt: "2026-06-10T12:00:00.000Z"
      }),
    /approval evidence must include/i
  );

  assert.throws(
    () =>
      applyReviewDecision(bundle, {
        decision: "approve",
        reviewer: "Andre",
        evidence: [
          "UGC video evidence reviewed",
          "Paid ad video evidence reviewed",
          "Normal post evidence reviewed",
          "Artifact freshness checked",
          "Rollback and not-live proof reviewed"
        ].join("; "),
        approvedAt: "2026-06-10T12:00:00.000Z"
      }),
    /Postiz draft upload only/i
  );
});

test("approve marks checks true and creates draft-upload-ready manual handoff", () => {
  const bundle = pendingBundle();
  const approved = applyReviewDecision(bundle, {
    decision: "approve",
    reviewer: "Andre",
    evidence: fullApprovalEvidence,
    approvedAt: "2026-06-10T12:00:00.000Z",
    notes: "Approved for manual Postiz draft upload only."
  });

  assert.equal(approved.reviewStatus.status, "approved");
  assert.equal(approved.reviewStatus.checks.brandFit, true);
  assert.equal(approved.reviewStatus.checks.notLive, true);
  assert.equal(approved.postizHandoff.status, "draft_upload_ready");
  assert.equal(approved.postizHandoff.handoffMode, "manual_upload");
  assert.equal(approved.postizHandoff.review.approvedBy, "Andre");
  assert.equal(approved.postizHandoff.review.notLiveConfirmed, true);
  assert.equal(approved.reviewStatus.approval.evidenceSummary.status, "covered");
  assert.equal(approved.reviewStatus.approval.evidenceSummary.summary.coveredGates, 6);
  assert.equal(approved.reviewStatus.approval.scope.approvedFor, "postiz_draft_upload_only");
  assert.equal(approved.reviewStatus.approval.scope.allowsSchedulingOrPublishing, false);
  assert.equal(assertRealApproval(approved.postizHandoff), true);
});

test("needs_revision keeps package away from Postiz readiness", () => {
  const bundle = pendingBundle();
  const revised = applyReviewDecision(bundle, {
    decision: "needs_revision",
    reviewer: "Andre",
    evidence: "Too static for paid UGC.",
    approvedAt: "2026-06-10T12:00:00.000Z",
    notes: "Make it less text-heavy."
  });

  assert.equal(revised.reviewStatus.status, "needs_revision");
  assert.equal(revised.postizHandoff.status, "needs_review");
  assert.equal(revised.postizHandoff.review.approvedBy, "pending-human-review");
});

test("needs_revision rejects missing or generic decision notes", () => {
  const bundle = pendingBundle();

  assert.throws(
    () =>
      applyReviewDecision(bundle, {
        decision: "needs_revision",
        reviewer: "Andre",
        evidence: "UGC video evidence reviewed.",
        approvedAt: "2026-06-10T12:00:00.000Z",
        notes: ""
      }),
    /specific decision notes/i
  );

  assert.throws(
    () =>
      applyReviewDecision(bundle, {
        decision: "needs_revision",
        reviewer: "Andre",
        evidence: "UGC video evidence reviewed.",
        approvedAt: "2026-06-10T12:00:00.000Z",
        notes: "Describe exactly what must change before Postiz draft upload."
      }),
    /specific decision notes/i
  );
});

test("reject rejects generic decision notes", () => {
  const bundle = pendingBundle();

  assert.throws(
    () =>
      applyReviewDecision(bundle, {
        decision: "reject",
        reviewer: "Andre",
        evidence: "UGC video evidence reviewed.",
        approvedAt: "2026-06-10T12:00:00.000Z",
        notes: "Describe why this asset should not continue."
      }),
    /specific decision notes/i
  );
});

test("writes a decision package when run on files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-"));
  try {
    const input = path.join(tempDir, "draft-bundle.json");
    const output = path.join(tempDir, "approved-bundle.json");
    await writeFile(input, `${JSON.stringify(pendingBundle(), null, 2)}\n`);

    const result = await applyReviewDecision.fromFiles({
      input,
      output,
      decision: "approve",
      reviewer: "Andre",
      evidence: fullApprovalEvidence,
      approvedAt: "2026-06-10T12:00:00.000Z",
      notes: "Manual Postiz draft only."
    });

    assert.equal(result.output, output);
    const saved = JSON.parse(await readFile(output, "utf8"));
    assert.equal(saved.postizHandoff.status, "draft_upload_ready");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
