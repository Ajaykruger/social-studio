import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createCampaign,
  generateCreativePack
} from "../../server/generate-campaign.mjs";
import { findBlockedClaimsInObject } from "../../src/utils/claimGuard.js";
import { runReviewDecisionCycle } from "../tools/run-review-decision-cycle.mjs";

const PRODUCT = {
  id: "french-rubber-base",
  name: "French Rubber Base",
  sourceUrl: "https://crystalclawz.co.za/products/french-rubber-base",
  images: ["https://cdn.example/img.jpg"],
  description: "Gives a smooth base for French work."
};

const BRIEF = {
  contentType: "reel_and_post",
  audience: "South African nail technicians",
  angle: "French work looks messy when the base is uneven",
  approvedBenefit: "smooth base",
  cta: "Shop French Rubber Base at crystalclawz.co.za",
  tone: "Warm & encouraging"
};

test("template generation produces a claim-safe pack without an API key", async () => {
  const result = await generateCreativePack({
    product: PRODUCT,
    brief: BRIEF,
    apiKey: ""
  });

  assert.equal(result.generator, "template");
  assert.ok(result.pack.captions.length >= 2);
  assert.ok(result.pack.hooks.length >= 2);
  assert.ok(result.pack.reelScript.length >= 3);
  assert.deepEqual(findBlockedClaimsInObject(result.pack), []);
});

test("generation rejects a blocked phrase used as the approved benefit", async () => {
  await assert.rejects(
    () =>
      generateCreativePack({
        product: PRODUCT,
        brief: { ...BRIEF, approvedBenefit: "long-lasting wear" },
        apiKey: ""
      }),
    /blocked claim family/
  );
});

test("createCampaign rejects packs that carry blocked claims", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cc-create-"));
  try {
    const { pack } = await generateCreativePack({
      product: PRODUCT,
      brief: BRIEF,
      apiKey: ""
    });
    const poisoned = JSON.parse(JSON.stringify(pack));
    poisoned.captions[0] = "Prevents lifting for weeks of wear!";

    await assert.rejects(
      () =>
        createCampaign({
          workspaceRoot,
          product: PRODUCT,
          brief: BRIEF,
          pack: poisoned
        }),
      /blocked claims/
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("createCampaign writes review-ready artifacts and an audit entry", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cc-create-"));
  try {
    const { pack, generator } = await generateCreativePack({
      product: PRODUCT,
      brief: BRIEF,
      apiKey: ""
    });
    const result = await createCampaign({
      workspaceRoot,
      product: PRODUCT,
      brief: BRIEF,
      pack,
      generator
    });

    assert.match(result.campaignId, /^cc-french-rubber-base-\d{4}-\d{2}-\d{2}$/);
    assert.equal(result.includeReel, true);
    assert.deepEqual(result.requiredContentTypes, ["ugc_video", "normal_post"]);

    const campaignDir = path.join(
      workspaceRoot,
      "social-studio",
      "generated",
      result.campaignId
    );
    const bundle = JSON.parse(
      await readFile(path.join(campaignDir, "draft-bundle.json"), "utf8")
    );
    assert.equal(bundle.reviewStatus.status, "needs_review");
    assert.equal(bundle.postizHandoff.status, "needs_review");
    assert.equal(bundle.postizHandoff.scheduledFor, "");
    assert.deepEqual(bundle.postizHandoff.requiredContentTypes, [
      "ugc_video",
      "normal_post"
    ]);
    assert.ok(!path.isAbsolute(bundle.postizHandoff.media.localPath));

    const svg = await readFile(
      path.join(
        workspaceRoot,
        "public",
        "social-studio",
        result.campaignId,
        "review",
        "normal-post-01.svg"
      ),
      "utf8"
    );
    assert.ok(svg.includes("Draft for human review"));
    assert.ok(svg.includes("smooth base"));

    const reviewPacket = JSON.parse(
      await readFile(
        path.join(campaignDir, "review-packet", "review-packet.ui.json"),
        "utf8"
      )
    );
    assert.equal(reviewPacket.assets.length, 2);
    assert.equal(reviewPacket.scheduleOrPublishReady, false);

    const moneyprinter = JSON.parse(
      await readFile(path.join(campaignDir, "moneyprinter-request.json"), "utf8")
    );
    assert.equal(moneyprinter.video_aspect, "9:16");
    assert.ok(moneyprinter.video_script.length > 20);

    const audit = await readFile(
      path.join(
        workspaceRoot,
        "social-studio",
        "audit",
        `${result.campaignId}.decisions.jsonl`
      ),
      "utf8"
    );
    const entry = JSON.parse(audit.trim());
    assert.equal(entry.event, "campaign_created");
    assert.equal(entry.allowsSchedulingOrPublishing, false);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("a reel campaign cannot be approved until the reel render is attached", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cc-create-"));
  try {
    const { pack } = await generateCreativePack({
      product: PRODUCT,
      brief: BRIEF,
      apiKey: ""
    });
    const result = await createCampaign({
      workspaceRoot,
      product: PRODUCT,
      brief: BRIEF,
      pack
    });
    const campaignDir = path.join(
      workspaceRoot,
      "social-studio",
      "generated",
      result.campaignId
    );

    await assert.rejects(
      () =>
        runReviewDecisionCycle({
          input: path.join(campaignDir, "draft-bundle.json"),
          outDir: campaignDir,
          workspaceRoot,
          manualPackageDir: path.join(workspaceRoot, "manual-package"),
          decision: "approve",
          reviewer: "Jen",
          evidence:
            "UGC video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rollback and not-live proof reviewed; Approved for Postiz draft upload only",
          notes: "Approved for Postiz draft upload only."
        }),
      /review board assets for: ugc_video/
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("a post-only campaign approves with campaign-specific evidence gates", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "cc-create-"));
  try {
    const { pack } = await generateCreativePack({
      product: PRODUCT,
      brief: { ...BRIEF, contentType: "post" },
      apiKey: ""
    });
    const result = await createCampaign({
      workspaceRoot,
      product: PRODUCT,
      brief: { ...BRIEF, contentType: "post" },
      pack
    });
    assert.deepEqual(result.requiredContentTypes, ["normal_post"]);

    const campaignDir = path.join(
      workspaceRoot,
      "social-studio",
      "generated",
      result.campaignId
    );

    // Post-only campaigns only need the gates that apply to them - no UGC or
    // paid ad gate is demanded.
    const cycleResult = await runReviewDecisionCycle({
      input: path.join(campaignDir, "draft-bundle.json"),
      outDir: campaignDir,
      workspaceRoot,
      manualPackageDir: path.join(workspaceRoot, "manual-package"),
      decision: "approve",
      reviewer: "Jen",
      evidence:
        "Normal post evidence reviewed; Artifact freshness checked; Rollback and not-live proof reviewed; Approved for Postiz draft upload only",
      notes: "Approved for Postiz draft upload only."
    });

    assert.equal(cycleResult.status, "approved_waiting_postiz_dry_run");
    const approved = JSON.parse(
      await readFile(path.join(campaignDir, "approved-bundle.json"), "utf8")
    );
    assert.equal(approved.reviewStatus.approval.evidenceSummary.status, "covered");
    assert.equal(
      approved.reviewStatus.approval.evidenceSummary.gates.length,
      4
    );
    assert.equal(approved.reviewStatus.approval.scope.allowsSchedulingOrPublishing, false);

    const manifest = JSON.parse(
      await readFile(path.join(workspaceRoot, "manual-package", "manifest.json"), "utf8")
    );
    assert.equal(manifest.packageType, "postiz_manual_draft_ready");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
