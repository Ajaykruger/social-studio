import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createDecisionApp } from "../../server/decision-api.mjs";

const CAMPAIGN_ID = "cc-test-campaign";

const ALL_GATES = [
  "UGC video evidence reviewed",
  "Paid ad video evidence reviewed",
  "Normal post evidence reviewed",
  "Artifact freshness checked",
  "Rollback and not-live proof reviewed",
  "Approved for Postiz draft upload only"
];

function pendingBundle(mediaDir) {
  return {
    campaignId: CAMPAIGN_ID,
    assetId: `${CAMPAIGN_ID}-draft-001`,
    reviewStatus: {
      campaignId: CAMPAIGN_ID,
      assetId: `${CAMPAIGN_ID}-draft-001`,
      status: "needs_review",
      reviewer: "pending-human-review",
      checks: {
        brandFit: false,
        claimSafe: false,
        productVisible: false,
        captionReady: false,
        ctaReady: false,
        platformReady: false,
        notLive: true
      },
      notes: "Needs review.",
      approval: { approvedBy: "", approvedAt: "", approvalEvidence: "" }
    },
    postizHandoff: {
      campaignId: CAMPAIGN_ID,
      assetId: `${CAMPAIGN_ID}-draft-001`,
      handoffMode: "manual_upload",
      platforms: ["instagram", "facebook"],
      media: {
        localPath: path.join(mediaDir, "final-1.mp4"),
        thumbnailPath: path.join(mediaDir, "thumb.jpg"),
        mediaType: "video",
        aspectRatio: "9:16"
      },
      caption: "Smooth base for cleaner salon work. Shop Crystal Clawz French Rubber Base.",
      hashtags: ["#CrystalClawz", "#NailTechSA"],
      scheduledFor: "",
      status: "needs_review",
      review: {
        approvedBy: "pending-human-review",
        approvedAt: "",
        notLiveConfirmed: true,
        notes: "Preview only."
      }
    }
  };
}

function reviewBoard(mediaDir) {
  const item = (assetId, label, contentType, fileName, isVideo) => ({
    assetId,
    label,
    contentType,
    reviewAction: "review_decision_required",
    media: {
      localPath: path.join(mediaDir, fileName),
      videoUrl: isVideo ? `/social-studio/${CAMPAIGN_ID}/review/${fileName}` : "",
      imageUrl: isVideo ? "" : `/social-studio/${CAMPAIGN_ID}/review/${fileName}`
    },
    postiz: { publishAllowed: false }
  });

  return {
    packageType: "social_studio_review_board",
    status: "needs_review",
    items: [
      item(`${CAMPAIGN_ID}-ugc-video-01`, "UGC video", "ugc_video", "final-1.mp4", true),
      item(`${CAMPAIGN_ID}-paid-ad-video-02`, "Paid ad video", "paid_ad_video", "paid-ad.mp4", true),
      item(`${CAMPAIGN_ID}-normal-post-03`, "Normal post", "normal_post", "normal-post.svg", false)
    ]
  };
}

async function seedWorkspace() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "social-studio-api-"));
  const campaignDir = path.join(workspaceRoot, "social-studio", "generated", CAMPAIGN_ID);
  const mediaDir = path.join(workspaceRoot, "media-src");
  await mkdir(campaignDir, { recursive: true });
  await mkdir(path.join(campaignDir, "review-board"), { recursive: true });
  await mkdir(mediaDir, { recursive: true });

  await writeFile(path.join(mediaDir, "final-1.mp4"), "fake video");
  await writeFile(path.join(mediaDir, "thumb.jpg"), "fake thumb");
  await writeFile(path.join(mediaDir, "paid-ad.mp4"), "fake paid ad");
  await writeFile(path.join(mediaDir, "normal-post.svg"), "<svg />");

  await writeFile(
    path.join(campaignDir, "draft-bundle.json"),
    `${JSON.stringify(pendingBundle(mediaDir), null, 2)}\n`
  );
  await writeFile(
    path.join(campaignDir, "review-board", "review-board.json"),
    `${JSON.stringify(reviewBoard(mediaDir), null, 2)}\n`
  );
  return { workspaceRoot, campaignDir };
}

async function writeReviewPacket(campaignDir) {
  const packetDir = path.join(campaignDir, "review-packet");
  await mkdir(packetDir, { recursive: true });
  const packet = {
    campaignId: CAMPAIGN_ID,
    assetId: `${CAMPAIGN_ID}-draft-001`,
    status: "needs_review",
    statusLabel: "Needs review",
    decisionRequired: true,
    notLiveConfirmed: true,
    scheduleOrPublishReady: false,
    caption: "Smooth base for cleaner salon work.",
    hashtags: ["#CrystalClawz"],
    visualReviewSummary: "Ready for human review.",
    nextAction: "Review the draft, then record approve, needs_revision, or reject.",
    assets: []
  };
  await writeFile(
    path.join(packetDir, "review-packet.ui.json"),
    `${JSON.stringify(packet, null, 2)}\n`
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertReviewPacketMatchesWorkflow(campaignDir, expectedStatus) {
  const workflow = await readJson(path.join(campaignDir, "workflow-status.ui.json"));
  const packet = await readJson(path.join(campaignDir, "review-packet", "review-packet.ui.json"));

  assert.equal(workflow.status, expectedStatus);
  assert.equal(packet.status, workflow.status);
  assert.equal(packet.statusLabel, workflow.statusLabel);
  assert.equal(packet.decisionRequired, false);
  assert.equal(packet.nextAction, workflow.nextAction);
  assert.equal(packet.scheduleOrPublishReady, false);
}

async function withServer(workspaceRoot, run) {
  const app = createDecisionApp({ workspaceRoot });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postDecision(baseUrl, body, campaignId = CAMPAIGN_ID) {
  const response = await fetch(
    `${baseUrl}/api/campaigns/${campaignId}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  return { status: response.status, body: await response.json() };
}

test("decision api approves with all evidence gates and writes audit log", async () => {
  const { workspaceRoot, campaignDir } = await seedWorkspace();
  try {
    await withServer(workspaceRoot, async (baseUrl) => {
      const result = await postDecision(baseUrl, {
        decision: "approve",
        reviewer: "Jen",
        gates: ALL_GATES,
        notes: "Reviewed all three assets on mobile."
      });

      assert.equal(result.status, 200);
      assert.equal(result.body.ok, true);
      assert.equal(result.body.status, "approved_waiting_postiz_dry_run");
      assert.equal(result.body.manualPackageReady, true);
      assert.match(result.body.boundary, /draft upload only/i);

      const approved = JSON.parse(
        await readFile(path.join(campaignDir, "approved-bundle.json"), "utf8")
      );
      assert.equal(approved.reviewStatus.status, "approved");
      assert.equal(approved.reviewStatus.approval.scope.allowsSchedulingOrPublishing, false);

      const manifest = JSON.parse(
        await readFile(
          path.join(
            workspaceRoot,
            "social-studio",
            "handoff",
            "postiz",
            "approved",
            CAMPAIGN_ID,
            "manifest.json"
          ),
          "utf8"
        )
      );
      assert.equal(manifest.packageType, "postiz_manual_draft_ready");

      const auditLines = (
        await readFile(
          path.join(workspaceRoot, "social-studio", "audit", `${CAMPAIGN_ID}.decisions.jsonl`),
          "utf8"
        )
      )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(auditLines.length, 1);
      assert.equal(auditLines[0].decision, "approve");
      assert.equal(auditLines[0].reviewer, "Jen");
      assert.equal(auditLines[0].allowsSchedulingOrPublishing, false);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api rejects approval with a missing evidence gate", async () => {
  const { workspaceRoot } = await seedWorkspace();
  try {
    await withServer(workspaceRoot, async (baseUrl) => {
      const result = await postDecision(baseUrl, {
        decision: "approve",
        reviewer: "Jen",
        gates: ALL_GATES.slice(0, 5)
      });
      assert.equal(result.status, 400);
      assert.match(result.body.error, /missing: Approved for Postiz draft upload only/);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api rejects fake reviewers and generic revision notes", async () => {
  const { workspaceRoot } = await seedWorkspace();
  try {
    await withServer(workspaceRoot, async (baseUrl) => {
      const fakeReviewer = await postDecision(baseUrl, {
        decision: "approve",
        reviewer: "pending-human-review",
        gates: ALL_GATES
      });
      assert.equal(fakeReviewer.status, 400);
      assert.match(fakeReviewer.body.error, /real human reviewer/);

      const genericNotes = await postDecision(baseUrl, {
        decision: "needs_revision",
        reviewer: "Jen",
        notes: "edit required"
      });
      assert.equal(genericNotes.status, 422);
      assert.match(genericNotes.body.error, /specific decision notes/);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api records needs_revision without creating a manual package", async () => {
  const { workspaceRoot, campaignDir } = await seedWorkspace();
  try {
    await withServer(workspaceRoot, async (baseUrl) => {
      const result = await postDecision(baseUrl, {
        decision: "needs_revision",
        reviewer: "Jen",
        notes: "Hook is too slow; product must appear in the first three seconds."
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.status, "needs_revision");
      assert.equal(result.body.manualPackageReady, false);

      const revision = JSON.parse(
        await readFile(path.join(campaignDir, "revision-bundle.json"), "utf8")
      );
      assert.equal(revision.postizHandoff.status, "needs_review");
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api refreshes review packet after approve", async () => {
  const { workspaceRoot, campaignDir } = await seedWorkspace();
  try {
    await writeReviewPacket(campaignDir);
    await withServer(workspaceRoot, async (baseUrl) => {
      const result = await postDecision(baseUrl, {
        decision: "approve",
        reviewer: "Jen",
        gates: ALL_GATES,
        notes: "Reviewed all three assets on mobile."
      });

      assert.equal(result.status, 200);
      await assertReviewPacketMatchesWorkflow(campaignDir, "approved_waiting_postiz_dry_run");
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api refreshes review packet after needs_revision", async () => {
  const { workspaceRoot, campaignDir } = await seedWorkspace();
  try {
    await writeReviewPacket(campaignDir);
    await withServer(workspaceRoot, async (baseUrl) => {
      const result = await postDecision(baseUrl, {
        decision: "needs_revision",
        reviewer: "Jen",
        notes: "Hook is too slow; product must appear in the first three seconds."
      });

      assert.equal(result.status, 200);
      await assertReviewPacketMatchesWorkflow(campaignDir, "needs_revision");
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api refreshes review packet after reject", async () => {
  const { workspaceRoot, campaignDir } = await seedWorkspace();
  try {
    await writeReviewPacket(campaignDir);
    await withServer(workspaceRoot, async (baseUrl) => {
      const result = await postDecision(baseUrl, {
        decision: "reject",
        reviewer: "Jen",
        notes: "Product is not visible enough for this campaign to continue."
      });

      assert.equal(result.status, 200);
      await assertReviewPacketMatchesWorkflow(campaignDir, "rejected");
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api blocks re-approval while an approved bundle exists", async () => {
  const { workspaceRoot } = await seedWorkspace();
  try {
    await withServer(workspaceRoot, async (baseUrl) => {
      const first = await postDecision(baseUrl, {
        decision: "approve",
        reviewer: "Jen",
        gates: ALL_GATES
      });
      assert.equal(first.status, 200);

      const second = await postDecision(baseUrl, {
        decision: "approve",
        reviewer: "Jen",
        gates: ALL_GATES
      });
      assert.equal(second.status, 409);
      assert.match(second.body.error, /already exists/);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api validates campaign ids and 404s unknown campaigns", async () => {
  const { workspaceRoot } = await seedWorkspace();
  try {
    await withServer(workspaceRoot, async (baseUrl) => {
      const badId = await postDecision(
        baseUrl,
        { decision: "reject", reviewer: "Jen", notes: "n/a" },
        "Bad_Campaign!"
      );
      assert.equal(badId.status, 400);

      const unknown = await postDecision(
        baseUrl,
        { decision: "reject", reviewer: "Jen", notes: "n/a" },
        "cc-does-not-exist"
      );
      assert.equal(unknown.status, 404);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("decision api state endpoint exposes gates, bundles, and boundary", async () => {
  const { workspaceRoot } = await seedWorkspace();
  try {
    await withServer(workspaceRoot, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/campaigns/${CAMPAIGN_ID}/state`);
      assert.equal(response.status, 200);
      const state = await response.json();
      assert.deepEqual(state.approvalEvidenceGates, ALL_GATES);
      assert.equal(state.bundles.draft, true);
      assert.equal(state.bundles.approved, false);
      assert.equal(state.boundary.scheduling, false);
      assert.equal(state.boundary.publishing, false);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("studio-data refuses to serve local-only operator value files", async () => {
  const { workspaceRoot, campaignDir } = await seedWorkspace();
  try {
    await writeFile(
      path.join(campaignDir, "integrations.local.json"),
      "[]"
    );
    await withServer(workspaceRoot, async (baseUrl) => {
      const blocked = await fetch(
        `${baseUrl}/studio-data/${CAMPAIGN_ID}/integrations.local.json`
      );
      assert.equal(blocked.status, 403);

      const allowed = await fetch(
        `${baseUrl}/studio-data/${CAMPAIGN_ID}/draft-bundle.json`
      );
      assert.equal(allowed.status, 200);
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
