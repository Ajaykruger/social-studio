import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "ContentCoverageAuditPanel.jsx");

test("App wires content coverage audit after the content plan", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /ContentCoverageAuditPanel/);
  assert.match(source, /content-coverage-audit\/content-coverage-audit\.ui\.json/);

  const contentPlanIndex = source.indexOf("<ContentPlanPanel");
  const coverageIndex = source.indexOf("<ContentCoverageAuditPanel");
  const packetsIndex = source.indexOf("<ProductionPacketsPanel");

  assert.ok(coverageIndex > contentPlanIndex);
  assert.ok(coverageIndex < packetsIndex);
});

test("ContentCoverageAuditPanel is display-only and names production gaps", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Content Coverage Audit/);
  assert.match(source, /generatedContentTypes/);
  assert.match(source, /pendingProductionContentTypes/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
