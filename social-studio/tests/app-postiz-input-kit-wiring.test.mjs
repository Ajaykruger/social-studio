import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "PostizInputKitPanel.jsx");

test("App wires the Postiz input kit before dry-run readiness", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /PostizInputKitPanel/);
  assert.match(source, /postiz-input-kit\/postiz-input-kit\.ui\.json/);

  const reviewMediaIndex = source.indexOf("<ReviewMediaPanel");
  const inputKitIndex = source.indexOf("<PostizInputKitPanel");
  const readinessIndex = source.indexOf("<PostizDryRunReadinessPanel");

  assert.ok(inputKitIndex > reviewMediaIndex);
  assert.ok(inputKitIndex < readinessIndex);
});

test("PostizInputKitPanel shows counts without running Postiz actions", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Postiz Input Kit/);
  assert.match(source, /requiredPlatforms/);
  assert.match(source, /readyIntegrations/);
  assert.match(source, /uploadedMediaReady/);
  assert.match(source, /requiredMediaAssets/);
  assert.match(source, /Upload targets/);
  assert.match(source, /Operator preflight/);
  assert.match(source, /operatorPreflight/);
  assert.match(source, /integrationChecks/);
  assert.match(source, /mediaChecks/);
  assert.match(source, /sourceAssetUrl/);
  assert.match(source, /Open reviewed source/);
  assert.match(source, /secretsInUi/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
