import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "PostizDryRunReadinessPanel.jsx");

test("App wires Postiz dry-run readiness before the approval action center", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /PostizDryRunReadinessPanel/);
  assert.match(source, /postiz-dry-run-readiness\/postiz-dry-run-readiness\.ui\.json/);

  const reviewMediaIndex = source.indexOf("<ReviewMediaPanel");
  const postizReadinessIndex = source.indexOf("<PostizDryRunReadinessPanel");
  const decisionIndex = source.indexOf("<ReviewDecisionCommandsPanel");

  assert.ok(postizReadinessIndex > reviewMediaIndex);
  assert.ok(postizReadinessIndex < decisionIndex);
});

test("PostizDryRunReadinessPanel is read-only and blocks live actions", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Postiz Dry-Run Readiness/);
  assert.match(source, /networkCallsAllowed/);
  assert.match(source, /noLivePosting/);
  assert.match(source, /readiness\.steps/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
