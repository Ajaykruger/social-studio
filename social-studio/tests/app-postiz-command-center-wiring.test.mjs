import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "PostizCommandCenterPanel.jsx");

test("App wires Postiz command center after dry-run readiness", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /PostizCommandCenterPanel/);
  assert.match(source, /postiz-command-center\/postiz-command-center\.ui\.json/);

  const readinessIndex = source.indexOf("<PostizDryRunReadinessPanel");
  const commandCenterIndex = source.indexOf("<PostizCommandCenterPanel");
  const decisionIndex = source.indexOf("<ReviewDecisionCommandsPanel");

  assert.ok(commandCenterIndex > readinessIndex);
  assert.ok(commandCenterIndex < decisionIndex);
});

test("PostizCommandCenterPanel stays copy-only and local-only", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Postiz Command Center/);
  assert.match(source, /commandOnly/);
  assert.match(source, /networkCallsAllowed/);
  assert.match(source, /prerequisiteChecklist/);
  assert.match(source, /Prerequisites/);
  assert.match(source, /item\.requires/);
  assert.match(source, /item\.writes/);
  assert.match(source, /item\.never/);
  assert.match(source, /copyEnabled/);
  assert.match(source, /Copy disabled/);
  assert.match(source, /CopyButton/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
