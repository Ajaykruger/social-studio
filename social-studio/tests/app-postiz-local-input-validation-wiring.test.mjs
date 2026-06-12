import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "PostizLocalInputValidationPanel.jsx");

test("App wires Postiz local input validation between input kit and dry-run readiness", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /PostizLocalInputValidationPanel/);
  assert.match(source, /postiz-input-kit\/postiz-local-input-validation\.ui\.json/);

  const inputKitIndex = source.indexOf("<PostizInputKitPanel");
  const validationIndex = source.indexOf("<PostizLocalInputValidationPanel");
  const readinessIndex = source.indexOf("<PostizDryRunReadinessPanel");

  assert.ok(validationIndex > inputKitIndex);
  assert.ok(validationIndex < readinessIndex);
});

test("PostizLocalInputValidationPanel is read-only and value-redacted", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Postiz Local Input Validation/);
  assert.match(source, /readyForDryRun/);
  assert.match(source, /blockingReasons/);
  assert.match(source, /operatorPreflight/);
  assert.match(source, /integrationChecks/);
  assert.match(source, /mediaChecks/);
  assert.match(source, /missingFields/);
  assert.match(source, /Missing fields/);
  assert.match(source, /valueShown/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
