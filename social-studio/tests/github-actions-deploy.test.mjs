import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const deployWorkflowPath = path.resolve(".github", "workflows", "deploy.yml");

test("deploy workflow runs only after successful CI on main and skips without secrets", async () => {
  const workflow = await readFile(deployWorkflowPath, "utf8");

  assert.match(workflow, /name:\s*Deploy/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\[\s*CI\s*\]/);
  assert.match(workflow, /types:\s*\[\s*completed\s*\]/);
  assert.match(workflow, /branches:\s*\[\s*main\s*\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.doesNotMatch(workflow, /^\s*pull_request:/m);

  assert.match(workflow, /DEPLOY_HOST/);
  assert.match(workflow, /DEPLOY_USER/);
  assert.match(workflow, /DEPLOY_SSH_KEY/);
  assert.match(workflow, /configured=false/);
  assert.match(workflow, /Deploy secrets not configured; skipping/);
  assert.match(workflow, /steps\.deploy_secrets\.outputs\.configured == 'true'/);
  assert.match(workflow, /\/opt\/social-studio\/deploy\/update\.sh/);
});

test("deployment runbook documents opt-in auto deploy secrets", async () => {
  const runbook = await readFile(path.resolve("deploy", "DEPLOY.md"), "utf8");

  assert.match(runbook, /Optional auto-deploy on push/i);
  assert.match(runbook, /DEPLOY_HOST/);
  assert.match(runbook, /DEPLOY_USER/);
  assert.match(runbook, /DEPLOY_SSH_KEY/);
  assert.match(runbook, /ssh-keygen/);
  assert.match(runbook, /opt-in/i);
  assert.match(runbook, /nothing auto-deploys/i);
  assert.match(runbook, /CI workflow succeeds/i);
});
