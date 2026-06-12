import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "MvpCompletionAuditPanel.jsx");

test("App wires MVP completion audit after the status panel", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /MvpCompletionAuditPanel/);
  assert.match(source, /mvp-completion-audit\/mvp-completion-audit\.ui\.json/);

  const statusIndex = source.indexOf("<SocialStudioStatusPanel");
  const completionIndex = source.indexOf("<MvpCompletionAuditPanel");
  const contentPlanIndex = source.indexOf("<ContentPlanPanel");

  assert.ok(completionIndex > statusIndex);
  assert.ok(completionIndex < contentPlanIndex);
});

test("MvpCompletionAuditPanel is display-only and does not run workflow commands", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /MVP Completion Audit/);
  assert.match(source, /completeRequirements/);
  assert.match(source, /blockedRequirements/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
