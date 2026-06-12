import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  buildDraftBundle,
  assertReviewFirstHandoff,
  loadJsonFile
} from "../tools/build-draft-bundle.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

test("rejects draft-upload-ready handoff when human approval is pending", () => {
  const unsafeHandoff = {
    status: "draft_upload_ready",
    review: {
      approvedBy: "pending-human-review",
      approvedAt: "",
      notLiveConfirmed: true
    }
  };

  assert.throws(
    () => assertReviewFirstHandoff(unsafeHandoff),
    /cannot be draft_upload_ready without human approval/i
  );
});

test("allows needs-review handoff preview when nothing is live", () => {
  const safePreview = {
    status: "needs_review",
    review: {
      approvedBy: "pending-human-review",
      approvedAt: "",
      notLiveConfirmed: true
    }
  };

  assert.equal(assertReviewFirstHandoff(safePreview), true);
});

test("builds draft bundle from Rubber Base fixtures without approving it", async () => {
  const brief = await loadJsonFile(
    path.join(studioRoot, "examples", "rubber-base-campaign-brief.example.json")
  );
  const product = await loadJsonFile(
    path.join(studioRoot, "examples", "rubber-base-product-input.example.json")
  );
  const requestTemplate = await loadJsonFile(
    path.join(studioRoot, "connectors", "moneyprinter", "request.example.json")
  );

  const bundle = buildDraftBundle({
    brief,
    product,
    requestTemplate,
    mediaPath: "C:\\example\\draft.mp4",
    thumbnailPath: "C:\\example\\draft-thumb.jpg"
  });

  assert.equal(bundle.reviewStatus.status, "needs_review");
  assert.equal(bundle.reviewStatus.checks.notLive, true);
  assert.match(bundle.reviewStatus.notes, /Postiz draft upload only/i);
  assert.doesNotMatch(bundle.reviewStatus.notes, /Postiz scheduling/i);
  assert.equal(bundle.postizHandoff.status, "needs_review");
  assert.equal(bundle.postizHandoff.review.notLiveConfirmed, true);
  assert.equal(bundle.postizHandoff.review.approvedBy, "pending-human-review");
  assert.match(bundle.postizHandoff.caption, /^Smooth base/);
  assert.equal(bundle.moneyprinterRequest.video_aspect, "9:16");
  assert.match(bundle.moneyprinterRequest.video_script_prompt, /South African nail technicians/i);

  const serialized = JSON.stringify(bundle);
  assert.doesNotMatch(serialized, /sk-live|sk-proj|Bearer\s+[A-Za-z0-9._-]{12,}/);
});

test("existing Postiz handoff example remains review-first", async () => {
  const handoff = JSON.parse(
    await readFile(
      path.join(studioRoot, "examples", "rubber-base-postiz-handoff.example.json"),
      "utf8"
    )
  );

  assert.equal(assertReviewFirstHandoff(handoff), true);
});

test("postiz handoff schema hardens draft-upload-ready statuses", async () => {
  const schema = await loadJsonFile(
    path.join(studioRoot, "schemas", "postiz-handoff.schema.json")
  );

  const advancedStatusRule = schema.allOf.find((rule) =>
    rule.if?.properties?.status?.enum?.includes("draft_upload_ready")
  );

  assert.ok(advancedStatusRule, "draft_upload_ready conditional rule is missing");
  const reviewRule = advancedStatusRule.then.properties.review.properties;
  assert.equal(reviewRule.notLiveConfirmed.const, true);
  assert.equal(reviewRule.approvedBy.not.const, "pending-human-review");
  assert.ok(reviewRule.approvedAt.minLength >= 10);
  assert.equal(schema.properties.reviewAssets.items.required.includes("assetId"), true);
  assert.equal(schema.properties.reviewAssets.items.properties.mediaType.enum.includes("video"), true);
});

test("review status schema requires all checks before approval statuses", async () => {
  const schema = await loadJsonFile(
    path.join(studioRoot, "schemas", "review-status.schema.json")
  );

  const approvalRule = schema.allOf.find((rule) =>
    rule.if?.properties?.status?.enum?.includes("approved")
  );

  assert.ok(approvalRule, "approval conditional rule is missing");
  const checks = approvalRule.then.properties.checks.properties;
  assert.equal(checks.brandFit.const, true);
  assert.equal(checks.claimSafe.const, true);
  assert.equal(checks.productVisible.const, true);
  assert.equal(checks.notLive.const, true);
  assert.ok(
    approvalRule.then.properties.approval.properties.approvalEvidence.minLength >= 3
  );
});
