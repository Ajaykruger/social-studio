import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "MvpFinishPathPanel.jsx");

test("App wires MVP finish path after the completion audit", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /MvpFinishPathPanel/);
  assert.match(source, /mvp-finish-path\/mvp-finish-path\.ui\.json/);

  const completionIndex = source.indexOf("<MvpCompletionAuditPanel");
  const finishPathIndex = source.indexOf("<MvpFinishPathPanel");
  const approvalIndex = source.indexOf("<HumanApprovalHandoffPanel");

  assert.ok(finishPathIndex > completionIndex);
  assert.ok(finishPathIndex < approvalIndex);
});

test("MvpFinishPathPanel is copy-only and does not run workflow commands", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /MVP Finish Path/);
  assert.match(source, /commandOnly/);
  assert.match(source, /networkCallsAllowed/);
  assert.match(source, /liveActionsEnabled/);
  assert.match(source, /command\.copyEnabled === false/);
  assert.match(source, /Copy disabled/);
  assert.match(source, /CopyButton/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
