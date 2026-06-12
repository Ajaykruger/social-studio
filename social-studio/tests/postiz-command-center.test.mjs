import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildPostizCommandCenter,
  buildPostizCommandCenterFromFiles
} from "../tools/build-postiz-command-center.mjs";

function inputKit(status = "needs_real_values") {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    networkCallsAllowed: false,
    secretsInUi: false,
    summary: {
      requiredPlatforms: 3,
      readyIntegrations: status === "ready" ? 3 : 0,
      uploadedMediaReady: status === "ready" ? 1 : 0
    },
    files: {
      integrationsTemplate: "integrations.local.template.json",
      uploadedMediaTemplate: "uploaded-media.local.template.json"
    }
  };
}

function readiness(status = "blocked_by_human_review") {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status,
    dryRunOnly: true,
    networkCallsAllowed: false,
    noLivePosting: true,
    summary: {
      totalSteps: 5,
      readySteps: status === "ready_for_dry_run" ? 4 : 1,
      blockedSteps: status === "ready_for_dry_run" ? 1 : 4
    }
  };
}

test("builds copy-only Postiz command center while human review is blocked", () => {
  const center = buildPostizCommandCenter({
    inputKit: inputKit(),
    readiness: readiness(),
    approvedBundleExists: false,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T20:00:00.000Z"
  });

  assert.equal(center.packageType, "social_studio_postiz_command_center");
  assert.equal(center.status, "blocked_by_human_review");
  assert.equal(center.commandOnly, true);
  assert.equal(center.networkCallsAllowed, false);
  assert.equal(center.liveActionsEnabled, false);
  assert.deepEqual(
    center.prerequisiteChecklist.map((item) => `${item.id}:${item.status}`),
    [
      "human_approval:blocked",
      "real_postiz_inputs:blocked",
      "dry_run_only:ready",
      "live_actions_off:ready"
    ]
  );
  assert.equal(center.commands.length, 4);
  assert.deepEqual(
    center.commands.map((command) => command.id),
    ["prepare_local_postiz_inputs", "validate_postiz_inputs", "refresh_postiz_readiness", "build_postiz_dry_run"]
  );
  assert.match(center.commands[0].command, /prepare-postiz-local-inputs\.mjs/);
  assert.match(center.commands[0].guardrail, /refuses to overwrite/i);
  assert.equal(center.commands[0].status, "blocked");
  assert.equal(center.commands[0].copyEnabled, false);
  assert.deepEqual(center.commands[0].requires, ["local_templates"]);
  assert.deepEqual(center.commands[0].writes, ["integrations.local.json", "uploaded-media.local.json"]);
  assert.match(center.commands[0].never.join("\n"), /Postiz API/i);
  assert.match(center.commands[1].command, /validate-postiz-local-inputs\.mjs/);
  assert.match(center.commands[1].command, /--bundle="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\approved-bundle\.json"/);
  assert.doesNotMatch(center.commands[1].command, /--bundle="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\draft-bundle\.json"/);
  assert.match(center.commands[1].command, /--review-board="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\review-board\\review-board\.json"/);
  assert.match(center.commands[1].command, /--out-dir="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\postiz-input-kit"/);
  assert.match(center.commands[1].guardrail, /exits blocked/i);
  assert.equal(center.commands[1].status, "blocked");
  assert.equal(center.commands[1].copyEnabled, false);
  assert.deepEqual(center.commands[1].requires, ["integrations.local.json", "uploaded-media.local.json"]);
  assert.deepEqual(center.commands[1].writes, ["postiz-local-input-validation.json", "postiz-local-input-validation.ui.json", "postiz-local-input-validation.md"]);
  assert.match(center.commands[2].command, /build-postiz-dry-run-readiness\.mjs/);
  assert.match(center.commands[2].command, /--postiz-input-kit="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\postiz-input-kit\\postiz-input-kit\.json"/);
  assert.deepEqual(center.commands[2].requires, ["approved-bundle.json", "integrations.local.json", "uploaded-media.local.json"]);
  assert.match(center.commands[3].command, /run-postiz-dry-run-cycle\.mjs/);
  assert.match(center.commands[3].command, /--human-approval-handoff="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\human-approval-handoff\\human-approval-handoff\.ui\.json"/);
  assert.match(center.commands[3].guardrail, /approved-bundle/i);
  assert.deepEqual(center.commands[3].requires, ["approved-bundle.json", "real Postiz local inputs", "passing verification flags"]);
  assert.match(center.commands[3].never.join("\n"), /schedule/i);
  assert.match(center.nextAction, /Record human approval before filling or validating local Postiz inputs/i);
  assert.match(center.markdown, /Prerequisites/i);
  assert.match(center.markdown, /Copy disabled until prerequisites are ready/i);
  assert.match(center.markdown, /Writes/i);
  assert.match(center.markdown, /Never/i);
  assert.match(center.markdown, /Human approval/i);
  assert.equal(JSON.stringify(center.uiSummary).includes("C:\\"), false);
  assert.equal(JSON.stringify(center.uiSummary).includes("replace-with"), false);
});

test("marks command center ready for dry-run when inputs and approval are ready", () => {
  const center = buildPostizCommandCenter({
    inputKit: inputKit("ready"),
    readiness: readiness("ready_for_dry_run"),
    approvedBundleExists: true,
    postizDryRunExists: false
  });

  assert.equal(center.status, "ready_for_dry_run");
  assert.deepEqual(
    center.prerequisiteChecklist.map((item) => `${item.id}:${item.status}`),
    [
      "human_approval:ready",
      "real_postiz_inputs:ready",
      "dry_run_only:ready",
      "live_actions_off:ready"
    ]
  );
  assert.equal(center.summary.readyCommands, 3);
  assert.equal(center.summary.availableCommands, 1);
  assert.match(center.nextAction, /Run the build dry-run command/i);
});

test("keeps local Postiz commands blocked by human review even when local input files exist", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-command-center-"));
  try {
    const inputKitPath = path.join(tempDir, "postiz-input-kit.ui.json");
    const readinessPath = path.join(tempDir, "postiz-dry-run-readiness.ui.json");
    const integrationsLocalPath = path.join(tempDir, "integrations.local.json");
    const uploadedMediaLocalPath = path.join(tempDir, "uploaded-media.local.json");
    const outDir = path.join(tempDir, "postiz-command-center");
    await writeFile(inputKitPath, `${JSON.stringify(inputKit(), null, 2)}\n`);
    await writeFile(readinessPath, `${JSON.stringify(readiness(), null, 2)}\n`);
    await writeFile(integrationsLocalPath, "[]\n");
    await writeFile(uploadedMediaLocalPath, "[]\n");

    await buildPostizCommandCenterFromFiles({
      inputKitPath,
      readinessPath,
      outDir,
      generatedAt: "2026-06-10T20:00:00.000Z"
    });

    const saved = JSON.parse(await readFile(path.join(outDir, "postiz-command-center.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "postiz-command-center.ui.json"), "utf8"));
    const prepareCommand = saved.commands.find((command) => command.id === "prepare_local_postiz_inputs");
    const validateCommand = saved.commands.find((command) => command.id === "validate_postiz_inputs");
    assert.equal(prepareCommand.status, "blocked");
    assert.equal(prepareCommand.copyEnabled, false);
    assert.match(prepareCommand.guardrail, /already exist/i);
    assert.equal(validateCommand.status, "blocked");
    assert.equal(validateCommand.copyEnabled, false);
    assert.equal(ui.prerequisiteChecklist.length, 4);
    assert.match(saved.nextAction, /Record human approval before validating existing local Postiz inputs/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("post-approval command center validates existing local files instead of preparing again", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-command-center-"));
  try {
    const inputKitPath = path.join(tempDir, "postiz-input-kit.ui.json");
    const readinessPath = path.join(tempDir, "postiz-dry-run-readiness.ui.json");
    const approvedBundlePath = path.join(tempDir, "approved-bundle.json");
    const integrationsLocalPath = path.join(tempDir, "integrations.local.json");
    const uploadedMediaLocalPath = path.join(tempDir, "uploaded-media.local.json");
    const outDir = path.join(tempDir, "postiz-command-center");
    await writeFile(inputKitPath, `${JSON.stringify(inputKit(), null, 2)}\n`);
    await writeFile(readinessPath, `${JSON.stringify(readiness("blocked_by_postiz_inputs"), null, 2)}\n`);
    await writeFile(approvedBundlePath, "{}\n");
    await writeFile(integrationsLocalPath, "[]\n");
    await writeFile(uploadedMediaLocalPath, "[]\n");

    await buildPostizCommandCenterFromFiles({
      inputKitPath,
      readinessPath,
      approvedBundlePath,
      outDir,
      generatedAt: "2026-06-10T20:30:00.000Z"
    });

    const saved = JSON.parse(await readFile(path.join(outDir, "postiz-command-center.json"), "utf8"));
    const prepareCommand = saved.commands.find((command) => command.id === "prepare_local_postiz_inputs");
    const validateCommand = saved.commands.find((command) => command.id === "validate_postiz_inputs");
    assert.equal(saved.status, "needs_real_values");
    assert.equal(prepareCommand.status, "blocked");
    assert.equal(prepareCommand.copyEnabled, false);
    assert.match(prepareCommand.guardrail, /already exist/i);
    assert.equal(validateCommand.status, "available");
    assert.equal(validateCommand.copyEnabled, true);
    assert.match(saved.nextAction, /existing local Postiz input files/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("writes Postiz command center JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-command-center-"));
  try {
    const inputKitPath = path.join(tempDir, "postiz-input-kit.ui.json");
    const readinessPath = path.join(tempDir, "postiz-dry-run-readiness.ui.json");
    const approvedBundlePath = path.join(tempDir, "approved-bundle.json");
    const postizDryRunPath = path.join(tempDir, "postiz-draft.dry-run.json");
    const outDir = path.join(tempDir, "postiz-command-center");
    await writeFile(inputKitPath, `${JSON.stringify(inputKit(), null, 2)}\n`);
    await writeFile(readinessPath, `${JSON.stringify(readiness(), null, 2)}\n`);

    const result = await buildPostizCommandCenterFromFiles({
      inputKitPath,
      readinessPath,
      approvedBundlePath,
      postizDryRunPath,
      outDir,
      generatedAt: "2026-06-10T20:00:00.000Z"
    });

    assert.equal(result.status, "blocked_by_human_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "postiz-command-center.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "postiz-command-center.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "postiz-command-center.md"), "utf8");
    assert.equal(saved.commands.length, 4);
    assert.equal(ui.commands.length, 4);
    assert.deepEqual(ui.commands[3].requires, ["approved-bundle.json", "real Postiz local inputs", "passing verification flags"]);
    assert.match(ui.commands[3].never.join("\n"), /publish/i);
    assert.equal(ui.commands[0].copyEnabled, false);
    assert.equal(ui.prerequisiteChecklist.length, 4);
    assert.match(markdown, /Postiz Command Center/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
