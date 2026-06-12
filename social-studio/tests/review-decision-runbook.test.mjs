import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const runbookPath = path.join("social-studio", "review-decision-runbook.md");

test("review decision runbook matches prepared local input and dry-run handoff flow", async () => {
  const runbook = await readFile(runbookPath, "utf8");

  assert.match(runbook, /local Postiz input files have already been prepared/i);
  assert.match(runbook, /edit the existing local files/i);
  assert.match(runbook, /rollback-note\.md/i);
  assert.match(runbook, /rollback and not-live proof reviewed/i);
  assert.doesNotMatch(runbook, /After approval, copy the generated templates/i);
  assert.match(runbook, /--human-approval-handoff="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\human-approval-handoff\\human-approval-handoff\.ui\.json"/);
});

test("review decision runbook approval command includes every required approval evidence gate", async () => {
  const runbook = await readFile(runbookPath, "utf8");

  assert.match(runbook, /UGC video evidence reviewed/);
  assert.match(runbook, /Paid ad video evidence reviewed/);
  assert.match(runbook, /Normal post evidence reviewed/);
  assert.match(runbook, /Artifact freshness checked/);
  assert.match(runbook, /Rollback and not-live proof reviewed/);
  assert.match(runbook, /Approved for Postiz draft upload only/);
  assert.match(runbook, /--review-board="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\review-board\\review-board\.json"/);
});
