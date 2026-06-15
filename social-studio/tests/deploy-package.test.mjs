import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const deployRoot = path.join(process.cwd(), "deploy");
const execFile = promisify(execFileCallback);

async function deployFile(name) {
  return readFile(path.join(deployRoot, name), "utf8");
}

function bashCommand() {
  if (process.env.BASH_PATH) {
    return process.env.BASH_PATH;
  }

  if (process.platform === "win32") {
    return "C:\\Program Files\\Git\\bin\\bash.exe";
  }

  return "bash";
}

async function assertBashSyntax(scriptName) {
  const scriptPath = path.join(deployRoot, scriptName);
  await access(scriptPath);
  await execFile(bashCommand(), ["-n", scriptPath], { timeout: 10000 });
}

test("deployment package includes the required runbook and config files", async () => {
  const [runbook, service, caddyfile, backup] = await Promise.all([
    deployFile("DEPLOY.md"),
    deployFile("social-studio.service"),
    deployFile("Caddyfile"),
    deployFile("backup.sh")
  ]);

  assert.match(runbook, /Hetzner CX32/i);
  assert.match(runbook, /Ubuntu 24\.04/i);
  assert.match(runbook, /ufw allow 22\/tcp/i);
  assert.match(runbook, /ufw allow 80\/tcp/i);
  assert.match(runbook, /ufw allow 443\/tcp/i);
  assert.match(runbook, /Node(?:\.js)? 22/i);
  assert.match(runbook, /npm ci/);
  assert.match(runbook, /npm run build/);
  assert.match(runbook, /\/opt\/social-studio/);
  assert.match(runbook, /ANTHROPIC_API_KEY/);
  assert.match(runbook, /STUDIO_REVIEWERS/);
  assert.match(runbook, /Cloudflare Access/i);
  assert.match(runbook, /0 2 \* \* \*/);
  assert.match(runbook, /must never be exposed without Cloudflare Access/i);
  assert.match(runbook, /Fast path/i);
  assert.match(runbook, /deploy\/bootstrap\.sh/);
  assert.match(runbook, /deploy\/update\.sh/);

  assert.match(service, /WorkingDirectory=\/opt\/social-studio/);
  assert.match(service, /ExecStart=\/usr\/bin\/node server\/decision-api\.mjs/);
  assert.match(service, /Environment=HOST=127\.0\.0\.1 PORT=4810/);
  assert.match(service, /Restart=on-failure/);

  assert.match(caddyfile, /studio\.example\.com/);
  assert.match(caddyfile, /reverse_proxy 127\.0\.0\.1:4810/);
  assert.match(caddyfile, /placeholder/i);

  assert.match(backup, /set -euo pipefail/);
  assert.match(backup, /\/var\/backups\/social-studio/);
  assert.match(backup, /social-studio\/generated/);
  assert.match(backup, /social-studio\/audit/);
  assert.match(backup, /social-studio\/handoff/);
  assert.match(backup, /public\/social-studio/);
  assert.match(backup, /-mtime \+14/);
});

test("turnkey deploy scripts pass bash syntax checks", async () => {
  await Promise.all([
    assertBashSyntax("backup.sh"),
    assertBashSyntax("bootstrap.sh"),
    assertBashSyntax("update.sh"),
    assertBashSyntax("healthcheck.sh")
  ]);
});

test("bootstrap script keeps existing env files private and never overwrites them", async () => {
  const bootstrap = await deployFile("bootstrap.sh");

  assert.match(bootstrap, /set -euo pipefail/);
  assert.match(bootstrap, /if \[\[ ! -f "\$\{ENV_FILE\}" \]\]/);
  assert.match(bootstrap, /cp "\$\{APP_DIR\}\/deploy\/\.env\.example" "\$\{ENV_FILE\}"/);
  assert.match(bootstrap, /chmod 600 "\$\{ENV_FILE\}"/);
  assert.doesNotMatch(bootstrap, /cat >"\$\{ENV_FILE\}"/);
});

test("deploy env example lists server variables without real secrets", async () => {
  const envExample = await deployFile(".env.example");

  assert.match(envExample, /ANTHROPIC_API_KEY=/);
  assert.match(envExample, /STUDIO_REVIEWERS=Jen,Andre/);
  assert.match(envExample, /HOST=127\.0\.0\.1/);
  assert.match(envExample, /PORT=4810/);
  assert.match(envExample, /\/opt\/social-studio\/\.env/);
  assert.match(envExample, /chmod 600/);
  assert.doesNotMatch(envExample, /sk-ant-/i);
});

test("deployment package does not commit real hostnames or secret values", async () => {
  const files = await Promise.all([
    deployFile("DEPLOY.md"),
    deployFile("social-studio.service"),
    deployFile("Caddyfile"),
    deployFile("backup.sh"),
    deployFile(".env.example")
  ]);
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /crystalclawz\.(com|co\.za)/i);
  assert.doesNotMatch(combined, /sk-ant-/i);
  assert.doesNotMatch(combined, /BEGIN PRIVATE KEY/i);
  assert.doesNotMatch(combined, /ghp_|gho_/i);
});
