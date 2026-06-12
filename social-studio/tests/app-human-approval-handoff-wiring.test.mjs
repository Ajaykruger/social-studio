import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "HumanApprovalHandoffPanel.jsx");

test("App wires human approval handoff after the MVP completion audit", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /HumanApprovalHandoffPanel/);
  assert.match(source, /human-approval-handoff\/human-approval-handoff\.ui\.json/);

  const completionIndex = source.indexOf("<MvpCompletionAuditPanel");
  const approvalIndex = source.indexOf("<HumanApprovalHandoffPanel");
  const contentPlanIndex = source.indexOf("<ContentPlanPanel");

  assert.ok(approvalIndex > completionIndex);
  assert.ok(approvalIndex < contentPlanIndex);
});

test("HumanApprovalHandoffPanel is copy-only and exposes review media context", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Human Approval Handoff/);
  assert.match(source, /videoUrl/);
  assert.match(source, /contactSheetUrl/);
  assert.match(source, /reviewAssets/);
  assert.match(source, /Open asset/);
  assert.match(source, /approvalChecklist/);
  assert.match(source, /Required checks/);
  assert.match(source, /reviewEvidence/);
  assert.match(source, /Review evidence/);
  assert.match(source, /Decision intake/);
  assert.match(source, /decisionIntake/);
  assert.match(source, /requiredFields/);
  assert.match(source, /approvalBoundary/);
  assert.match(source, /Decision readiness/);
  assert.match(source, /decisionReadiness/);
  assert.match(source, /Ready to decide/);
  assert.match(source, /Approval evidence/);
  assert.match(source, /approvalEvidenceSummary/);
  assert.match(source, /coveredGates/);
  assert.match(source, /rollbackNotLiveProofReady/);
  assert.match(source, /Rollback proof/);
  assert.match(source, /decisionCommands/);
  assert.match(source, /item\.effect/);
  assert.match(source, /Evidence checklist/);
  assert.match(source, /item\.evidenceChecklist/);
  assert.match(source, /noteGuidance/);
  assert.match(source, /copyEnabled/);
  assert.match(source, /Copy disabled/);
  assert.match(source, /Allows scheduling or publishing/);
  assert.match(source, /CopyButton/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
