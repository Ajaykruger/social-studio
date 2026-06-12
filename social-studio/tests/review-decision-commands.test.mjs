import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildReviewDecisionCommands,
  buildReviewDecisionCommandsFromFiles
} from "../tools/build-review-decision-commands.mjs";

function pendingBundle() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    reviewStatus: {
      status: "needs_review"
    },
    postizHandoff: {
      status: "needs_review",
      scheduledFor: "",
      review: {
        approvedBy: "pending-human-review",
        approvedAt: "",
        notLiveConfirmed: true
      },
      media: {
        localPath: "C:\\path\\to\\CC UCG\\MoneyPrinterTurbo\\storage\\tasks\\task\\final-1.mp4",
        thumbnailPath: "C:\\path\\to\\CC UCG\\social-studio\\generated\\thumb.jpg"
      }
    }
  };
}

test("builds copy-only review decision commands for the current needs-review bundle", () => {
  const packet = buildReviewDecisionCommands({
    bundle: pendingBundle(),
    generatedAt: "2026-06-10T16:00:00.000Z"
  });

  assert.equal(packet.status, "needs_review");
  assert.equal(packet.commandOnly, true);
  assert.equal(packet.liveActionsEnabled, false);
  assert.deepEqual(packet.summary, {
    commandCount: 3,
    liveActionsEnabled: false,
    blocker: "Human review decision is required before Postiz draft creation.",
    nextAction: "Review all generated assets, then copy approve or edit notes before running needs_revision or reject."
  });
  assert.equal(packet.commands.length, 3);
  assert.deepEqual(
    packet.commands.map((command) => command.decision),
    ["approve", "needs_revision", "reject"]
  );
  assert.equal(packet.commands[0].effect.createsApprovedBundle, true);
  assert.equal(packet.commands[0].effect.createsManualPostizPackage, true);
  assert.equal(packet.commands[0].effect.allowsSchedulingOrPublishing, false);
  assert.match(packet.commands[0].effect.operatorSummary, /Postiz draft upload only/i);
  assert.equal(packet.commands[1].effect.createsApprovedBundle, false);
  assert.equal(packet.commands[1].effect.keepsPostizBlocked, true);
  assert.equal(packet.commands[2].effect.createsApprovedBundle, false);
  assert.equal(packet.commands[2].effect.keepsPostizBlocked, true);
  assert.deepEqual(packet.commands[0].evidenceChecklist, [
    "UGC video evidence reviewed",
    "Paid ad video evidence reviewed",
    "Normal post evidence reviewed",
    "Artifact freshness checked",
    "Rollback and not-live proof reviewed",
    "Approved for Postiz draft upload only"
  ]);
  assert.match(packet.commands[0].command, /run-review-decision-cycle\.mjs/);
  assert.match(packet.commands[0].command, /UGC video evidence reviewed/);
  assert.match(packet.commands[0].command, /Paid ad video evidence reviewed/);
  assert.match(packet.commands[0].command, /Normal post evidence reviewed/);
  assert.match(packet.commands[0].command, /Artifact freshness checked/);
  assert.match(packet.commands[0].command, /rollback and not-live proof reviewed/i);
  assert.match(packet.commands[0].command, /--decision=approve/);
  assert.match(
    packet.commands[0].command,
    /--review-board="social-studio\\generated\\cc-rubber-base-demo-2026-06-10\\review-board\\review-board\.json"/
  );
  assert.equal(packet.commands[0].copyEnabled, true);
  assert.match(packet.commands[1].command, /--decision=needs_revision/);
  assert.equal(packet.commands[1].requiresNoteEdit, true);
  assert.equal(packet.commands[1].copyEnabled, false);
  assert.match(packet.commands[1].noteGuidance, /specific revision notes/i);
  assert.match(packet.commands[2].command, /--decision=reject/);
  assert.equal(packet.commands[2].requiresNoteEdit, true);
  assert.equal(packet.commands[2].copyEnabled, false);
  assert.match(packet.commands[2].noteGuidance, /specific rejection notes/i);
  assert.equal(JSON.stringify(packet).includes("C:\\"), false);
  assert.equal(JSON.stringify(packet).includes("MoneyPrinterTurbo"), false);
});

test("rejects command packet generation when content is already approved", () => {
  const bundle = pendingBundle();
  bundle.reviewStatus.status = "approved";
  bundle.postizHandoff.status = "draft_upload_ready";
  bundle.postizHandoff.review.approvedBy = "Andre";
  bundle.postizHandoff.review.approvedAt = "2026-06-10T12:00:00.000Z";

  assert.throws(
    () => buildReviewDecisionCommands({ bundle }),
    /needs_review bundle/i
  );
});

test("rejects command packet generation when not-live proof is missing", () => {
  const bundle = pendingBundle();
  bundle.postizHandoff.review.notLiveConfirmed = false;

  assert.throws(
    () => buildReviewDecisionCommands({ bundle }),
    /notLiveConfirmed/i
  );
});

test("writes JSON, UI JSON, and Markdown command packet from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-decision-commands-"));
  try {
    const bundlePath = path.join(tempDir, "draft-bundle.json");
    const outDir = path.join(tempDir, "commands");
    await writeFile(bundlePath, `${JSON.stringify(pendingBundle(), null, 2)}\n`);

    const result = await buildReviewDecisionCommandsFromFiles({
      bundlePath,
      outDir,
      generatedAt: "2026-06-10T16:00:00.000Z"
    });

    assert.equal(result.status, "needs_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "review-decision-commands.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "review-decision-commands.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "review-decision-commands.md"), "utf8");
    assert.equal(saved.commands.length, 3);
    assert.equal(ui.commands.length, 3);
    assert.equal(ui.summary.commandCount, 3);
    assert.equal(ui.commands[0].effect.createsApprovedBundle, true);
    assert.equal(ui.commands[0].effect.allowsSchedulingOrPublishing, false);
    assert.equal(ui.commands[0].copyEnabled, true);
    assert.match(ui.commands[0].evidenceChecklist.join("\n"), /UGC video evidence reviewed/);
    assert.match(ui.commands[0].evidenceChecklist.join("\n"), /Artifact freshness checked/);
    assert.equal(ui.commands[1].requiresNoteEdit, true);
    assert.equal(ui.commands[1].copyEnabled, false);
    assert.equal(ui.commands[2].copyEnabled, false);
    assert.match(ui.commands[1].noteGuidance, /specific revision notes/i);
    assert.match(ui.summary.blocker, /Human review/i);
    assert.equal(JSON.stringify(ui).includes("C:\\"), false);
    assert.match(markdown, /Approve/);
    assert.match(markdown, /Evidence checklist/);
    assert.match(markdown, /UGC video evidence reviewed/);
    assert.match(markdown, /rollback and not-live proof reviewed/i);
    assert.match(markdown, /Copy disabled until notes are edited/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
