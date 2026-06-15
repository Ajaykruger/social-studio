import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { attachRenderedReel } from "../../server/attach-reel.mjs";
import { createDecisionApp } from "../../server/decision-api.mjs";
import {
  createCampaign,
  generateCreativePack
} from "../../server/generate-campaign.mjs";
import { runReviewDecisionCycle } from "../tools/run-review-decision-cycle.mjs";

const PRODUCT = {
  id: "french-rubber-base",
  name: "French Rubber Base",
  sourceUrl: "https://crystalclawz.co.za/products/french-rubber-base",
  images: ["https://cdn.example/img.jpg"],
  description: "Gives a smooth base for French work."
};

const REEL_BRIEF = {
  contentType: "reel_and_post",
  audience: "South African nail technicians",
  angle: "French work looks messy when the base is uneven",
  approvedBenefit: "smooth base",
  cta: "Shop French Rubber Base at crystalclawz.co.za",
  tone: "Warm & encouraging"
};

const POST_BRIEF = {
  ...REEL_BRIEF,
  contentType: "post"
};

const REEL_AND_POST_GATES = [
  "UGC video evidence reviewed",
  "Normal post evidence reviewed",
  "Artifact freshness checked",
  "Rollback and not-live proof reviewed",
  "Approved for Postiz draft upload only"
];

async function makeWorkspace() {
  return mkdtemp(path.join(os.tmpdir(), "cc-attach-reel-"));
}

async function createPack() {
  return generateCreativePack({
    product: PRODUCT,
    brief: REEL_BRIEF,
    apiKey: ""
  });
}

async function createCampaignInWorkspace(workspaceRoot, brief = REEL_BRIEF) {
  const { pack, generator } = await createPack();
  const campaign = await createCampaign({
    workspaceRoot,
    product: PRODUCT,
    brief,
    pack,
    generator,
    generatedAt: "2026-06-12T13:45:00.000Z"
  });
  return {
    ...campaign,
    campaignDir: path.join(workspaceRoot, "social-studio", "generated", campaign.campaignId)
  };
}

async function writeRenderedReel(workspaceRoot, fileName = "rendered-reel.mp4") {
  const storageDir = path.join(workspaceRoot, "MoneyPrinterTurbo", "storage");
  await mkdir(storageDir, { recursive: true });
  const reelPath = path.join(storageDir, fileName);
  await writeFile(reelPath, "fake rendered reel");
  return reelPath;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertRejectsWithStatus(fn, statusCode, messagePattern) {
  await assert.rejects(
    fn,
    (error) => {
      assert.equal(error.statusCode, statusCode);
      assert.match(error.message, messagePattern);
      return true;
    }
  );
}

async function withServer(workspaceRoot, run, appOptions = {}) {
  const app = createDecisionApp({ workspaceRoot, ...appOptions });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("attach rendered reel copies the mp4 and unblocks reel review artifacts", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    const sourcePath = await writeRenderedReel(workspaceRoot);

    const result = await attachRenderedReel({
      workspaceRoot,
      campaignId: campaign.campaignId,
      filePath: "MoneyPrinterTurbo/storage/rendered-reel.mp4",
      attachedAt: "2026-06-12T13:50:00.000Z"
    });

    assert.equal(result.ok, true);
    assert.equal(result.boundary, "Manual Postiz draft upload only. No scheduling. No publishing.");
    assert.equal(result.reelUrl, `/social-studio/${campaign.campaignId}/review/reel-01.mp4`);

    const copied = await stat(
      path.join(workspaceRoot, "public", "social-studio", campaign.campaignId, "review", "reel-01.mp4")
    );
    assert.ok(copied.size > 0);

    const board = await readJson(path.join(campaign.campaignDir, "review-board", "review-board.json"));
    const reelItem = board.items.find((item) => item.contentType === "ugc_video");
    assert.equal(reelItem.reviewAction, "review_decision_required");
    assert.equal(reelItem.media.videoUrl, `/social-studio/${campaign.campaignId}/review/reel-01.mp4`);
    assert.equal(reelItem.postiz.publishAllowed, false);

    const packet = await readJson(path.join(campaign.campaignDir, "review-packet", "review-packet.ui.json"));
    const reelAsset = packet.assets.find((asset) => asset.contentType === "ugc_video");
    assert.equal(reelAsset.label, "Reel");
    assert.equal(reelAsset.assetUrl, `/social-studio/${campaign.campaignId}/review/reel-01.mp4`);
    assert.match(packet.visualReviewSummary, /rendered reel is attached/i);
    assert.doesNotMatch(packet.visualReviewSummary, /still pending/i);

    const workflow = await readJson(path.join(campaign.campaignDir, "workflow-status.ui.json"));
    const reelStage = workflow.stages.find((stage) => stage.name === "Reel render");
    assert.equal(reelStage.status, "ready");
    assert.doesNotMatch(workflow.blocker, /Reel render/i);
    assert.equal(workflow.scheduleOrPublishReady, false);

    const auditLines = (
      await readFile(path.join(workspaceRoot, "social-studio", "audit", `${campaign.campaignId}.decisions.jsonl`), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const attachEntry = auditLines.at(-1);
    assert.equal(attachEntry.event, "reel_attached");
    assert.equal(attachEntry.allowsSchedulingOrPublishing, false);
    assert.match(attachEntry.sourcePath, /MoneyPrinterTurbo\/storage\/rendered-reel\.mp4$/);
    assert.equal(path.resolve(result.sourcePath), path.resolve(sourcePath));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("a reel campaign can be approved after the rendered reel is attached", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    await writeRenderedReel(workspaceRoot);
    await attachRenderedReel({
      workspaceRoot,
      campaignId: campaign.campaignId,
      filePath: "MoneyPrinterTurbo/storage/rendered-reel.mp4"
    });

    const cycleResult = await runReviewDecisionCycle({
      input: path.join(campaign.campaignDir, "draft-bundle.json"),
      outDir: campaign.campaignDir,
      workspaceRoot,
      manualPackageDir: path.join(workspaceRoot, "manual-package"),
      decision: "approve",
      reviewer: "Jen",
      evidence: REEL_AND_POST_GATES.join("; "),
      notes: "Approved for Postiz draft upload only."
    });

    assert.equal(cycleResult.status, "approved_waiting_postiz_dry_run");
    const approved = await readJson(path.join(campaign.campaignDir, "approved-bundle.json"));
    assert.equal(approved.reviewStatus.approval.evidenceSummary.status, "covered");
    assert.deepEqual(
      approved.postizHandoff.reviewAssets.map((asset) => asset.contentType).sort(),
      ["normal_post", "ugc_video"]
    );
    const manifest = await readJson(path.join(workspaceRoot, "manual-package", "manifest.json"));
    assert.equal(manifest.packageType, "postiz_manual_draft_ready");
    assert.deepEqual(
      manifest.assets.map((asset) => asset.contentType).sort(),
      ["normal_post", "ugc_video"]
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("attach reel endpoint uses the guarded attach flow", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    const sourcePath = await writeRenderedReel(workspaceRoot);

    await withServer(workspaceRoot, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/campaigns/${campaign.campaignId}/attach-reel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: sourcePath })
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.reelUrl, `/social-studio/${campaign.campaignId}/review/reel-01.mp4`);
      assert.match(body.boundary, /No scheduling/i);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("attach reel endpoint records allowed Cloudflare Access email in the audit", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    const sourcePath = await writeRenderedReel(workspaceRoot);

    await withServer(
      workspaceRoot,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/campaigns/${campaign.campaignId}/attach-reel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cf-Access-Authenticated-User-Email": "Jen@Example.com"
          },
          body: JSON.stringify({ filePath: sourcePath })
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.ok, true);

        const auditLines = (
          await readFile(path.join(workspaceRoot, "social-studio", "audit", `${campaign.campaignId}.decisions.jsonl`), "utf8")
        )
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        assert.equal(auditLines.at(-1).event, "reel_attached");
        assert.equal(auditLines.at(-1).authenticatedEmail, "jen@example.com");
      },
      { reviewerEmails: ["jen@example.com"] }
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("attach reel endpoint rejects Cloudflare Access email outside the allowlist", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    const sourcePath = await writeRenderedReel(workspaceRoot);

    await withServer(
      workspaceRoot,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/campaigns/${campaign.campaignId}/attach-reel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cf-Access-Authenticated-User-Email": "mallory@example.com"
          },
          body: JSON.stringify({ filePath: sourcePath })
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.match(body.error, /authenticated reviewer email is not allowed/i);
      },
      { reviewerEmails: ["jen@example.com"] }
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("attach rendered reel rejects missing campaigns", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    await writeRenderedReel(workspaceRoot);
    await assertRejectsWithStatus(
      () =>
        attachRenderedReel({
          workspaceRoot,
          campaignId: "cc-missing-campaign",
          filePath: "MoneyPrinterTurbo/storage/rendered-reel.mp4"
        }),
      404,
      /campaign draft bundle not found/i
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("attach rendered reel rejects non-mp4 files", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    const storageDir = path.join(workspaceRoot, "MoneyPrinterTurbo", "storage");
    await mkdir(storageDir, { recursive: true });
    await writeFile(path.join(storageDir, "rendered-reel.txt"), "not a reel");

    await assertRejectsWithStatus(
      () =>
        attachRenderedReel({
          workspaceRoot,
          campaignId: campaign.campaignId,
          filePath: "MoneyPrinterTurbo/storage/rendered-reel.txt"
        }),
      400,
      /rendered reel must be an mp4/i
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("attach rendered reel rejects paths outside the allowed roots", async () => {
  const workspaceRoot = await makeWorkspace();
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cc-outside-reel-"));
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    const outsidePath = path.join(outsideDir, "rendered-reel.mp4");
    await writeFile(outsidePath, "outside reel");

    await assertRejectsWithStatus(
      () =>
        attachRenderedReel({
          workspaceRoot,
          campaignId: campaign.campaignId,
          filePath: outsidePath
        }),
      403,
      /outside the allowed roots/i
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("attach rendered reel rejects campaigns that are already approved", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot);
    await writeRenderedReel(workspaceRoot);
    await writeFile(path.join(campaign.campaignDir, "approved-bundle.json"), "{}\n");

    await assertRejectsWithStatus(
      () =>
        attachRenderedReel({
          workspaceRoot,
          campaignId: campaign.campaignId,
          filePath: "MoneyPrinterTurbo/storage/rendered-reel.mp4"
        }),
      409,
      /already has an approved bundle/i
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("attach rendered reel rejects campaigns without a ugc_video item", async () => {
  const workspaceRoot = await makeWorkspace();
  try {
    const campaign = await createCampaignInWorkspace(workspaceRoot, POST_BRIEF);
    await writeRenderedReel(workspaceRoot);

    await assertRejectsWithStatus(
      () =>
        attachRenderedReel({
          workspaceRoot,
          campaignId: campaign.campaignId,
          filePath: "MoneyPrinterTurbo/storage/rendered-reel.mp4"
        }),
      422,
      /ugc_video item/i
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
