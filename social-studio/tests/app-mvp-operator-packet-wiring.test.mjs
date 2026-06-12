import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "MvpOperatorPacketPanel.jsx");

test("App wires MVP operator packet before the finish path", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /MvpOperatorPacketPanel/);
  assert.match(source, /mvp-operator-packet\/mvp-operator-packet\.ui\.json/);

  const completionIndex = source.indexOf("<MvpCompletionAuditPanel");
  const operatorIndex = source.indexOf("<MvpOperatorPacketPanel");
  const finishPathIndex = source.indexOf("<MvpFinishPathPanel");

  assert.ok(operatorIndex > completionIndex);
  assert.ok(operatorIndex < finishPathIndex);
});

test("MvpOperatorPacketPanel is copy-only and keeps live actions disabled", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /MVP Operator Packet/);
  assert.match(source, /forbiddenActions/);
  assert.match(source, /operatorFiles/);
  assert.match(source, /Readiness Snapshot/);
  assert.match(source, /handoffSnapshot/);
  assert.match(source, /sourceAssets/);
  assert.match(source, /Open reviewed source/);
  assert.match(source, /Postiz Input Checklist/);
  assert.match(source, /postizInputChecklist/);
  assert.match(source, /integrationSlots/);
  assert.match(source, /mediaUploadRefs/);
  assert.match(source, /Integration slots/);
  assert.match(source, /Upload refs/);
  assert.match(source, /Gated Upcoming Actions/);
  assert.match(source, /gatedUpcomingActions/);
  assert.match(source, /blockedUntil/);
  assert.match(source, /command\.copyEnabled === false/);
  assert.match(source, /Copy disabled/);
  assert.match(source, /CopyButton/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
