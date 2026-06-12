import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applyReviewDecision } from "../tools/record-review-decision.mjs";
import { buildWorkflowStatus, buildWorkflowStatusFromFiles } from "../tools/build-workflow-status.mjs";

const fullApprovalEvidence = [
  "UGC video evidence reviewed",
  "Paid ad video evidence reviewed",
  "Normal post evidence reviewed",
  "Artifact freshness checked",
  "Rollback and not-live proof reviewed",
  "Approved for Postiz draft upload only"
].join("; ");

function pendingBundle() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    generatedAt: "2026-06-10T11:17:33.844Z",
    reviewStatus: {
      campaignId: "cc-rubber-base-demo-2026-06-10",
      assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
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
      notes: "Draft bundle prepared. Human reviewer must approve for Postiz draft upload only.",
      approval: {
        approvedBy: "",
        approvedAt: "",
        approvalEvidence: ""
      }
    },
    postizHandoff: {
      campaignId: "cc-rubber-base-demo-2026-06-10",
      assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
      handoffMode: "manual_upload",
      platforms: ["instagram", "facebook", "tiktok"],
      media: {
        localPath: "C:\\drafts\\final-1.mp4",
        thumbnailPath: "C:\\drafts\\thumb.jpg",
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
    },
    moneyprinterTask: {
      taskId: "task-123",
      state: 1,
      progress: 100,
      crossPostResults: null
    }
  };
}

function approvedBundle() {
  return applyReviewDecision(pendingBundle(), {
    decision: "approve",
    reviewer: "Andre",
    evidence: fullApprovalEvidence,
    approvedAt: "2026-06-10T12:00:00.000Z",
    notes: "Approved for Postiz draft creation only."
  });
}

function dryRunPackage() {
  return {
    packageType: "postiz_api_draft_dry_run",
    dryRunOnly: true,
    transport: {
      networkCallsAllowed: false
    },
    postizPayload: {
      type: "draft",
      posts: [
        {
          integration: { id: "postiz-instagram-channel-id" },
          value: [{ content: "caption", image: [{ id: "media-id", path: "https://uploads.postiz.com/final.mp4" }] }],
          settings: { __type: "instagram", post_type: "reel" }
        }
      ]
    },
    safety: {
      reviewStatus: "approved",
      postizStatus: "draft_upload_ready",
      approvedBy: "Andre",
      approvedAt: "2026-06-10T12:00:00.000Z",
      notLiveConfirmed: true,
      scheduledFor: ""
    }
  };
}

test("summarizes the current needs-review workflow without allowing Postiz draft creation", () => {
  const status = buildWorkflowStatus({
    bundle: pendingBundle(),
    generatedAt: "2026-06-10T13:30:00.000Z",
    artifactPresence: {
      brandContext: true,
      manualPackage: true,
      moneyprinterVideo: true,
      postizDryRunPackage: false
    }
  });

  assert.equal(status.overall.status, "needs_review");
  assert.equal(status.overall.mvpComplete, false);
  assert.equal(status.safety.noLivePosting, true);
  assert.equal(status.readiness.canCreatePostizDraft, false);
  assert.equal(status.readiness.canScheduleOrPublish, false);
  assert.equal(status.stages.moneyprinterDraft.status, "ready");
  assert.equal(status.stages.humanReview.status, "blocked");
  assert.match(status.stages.postizManualPackage.label, /review only until approval/i);
  assert.doesNotMatch(status.stages.postizManualPackage.label, /review\/upload/i);
  assert.match(status.nextActions[0], /all generated assets/i);
  assert.match(status.nextActions[1], /separate final scheduling\/publishing approval/i);
  assert.doesNotMatch(status.nextActions[1], /until there is explicit approval/i);
  assert.deepEqual(status.uiSummary, {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    statusLabel: "Needs review",
    freshness: {
      generatedAt: "2026-06-10T13:30:00.000Z",
      sourceGeneratedAt: "2026-06-10T11:17:33.844Z",
      sourceBundle: "draft-bundle.json",
      generatedPath: "social-studio/generated/cc-rubber-base-demo-2026-06-10"
    },
    noLivePosting: true,
    postizDraftReady: false,
    scheduleOrPublishReady: false,
    stages: [
      { name: "Brand", status: "ready", label: "Brand context index exists." },
      { name: "MoneyPrinter", status: "ready", label: "MoneyPrinterTurbo draft asset is present." },
      { name: "Review", status: "blocked", label: "Human review is still required." },
      { name: "Postiz manual", status: "ready", label: "Manual Postiz preview package exists for review only until approval." },
      { name: "Postiz API draft", status: "blocked", label: "Postiz API draft dry-run is not ready." }
    ],
    blocker: "Human review approval is required before Postiz draft creation.",
    nextAction: "Complete human review of all generated assets and record approve, needs_revision, or reject."
  });
  assert.match(status.markdown, /# Crystal Clawz Social Studio Status/);
});

test("marks Postiz API draft dry run ready only after approval and dry-run payload", () => {
  const status = buildWorkflowStatus({
    bundle: approvedBundle(),
    postizDryRunPackage: dryRunPackage(),
    generatedAt: "2026-06-10T13:30:00.000Z",
    artifactPresence: {
      brandContext: true,
      manualPackage: true,
      moneyprinterVideo: true,
      postizDryRunPackage: true
    }
  });

  assert.equal(status.overall.status, "postiz_draft_ready");
  assert.equal(status.overall.mvpComplete, false);
  assert.equal(status.readiness.canCreatePostizDraft, true);
  assert.equal(status.readiness.canScheduleOrPublish, false);
  assert.equal(status.stages.postizApiDraft.status, "ready");
  assert.match(status.stages.postizManualPackage.label, /approved Postiz draft upload/i);
  assert.match(status.markdown, /Postiz API draft dry-run package is ready/);
});

test("flags unsafe dry-run packages that would make network calls", () => {
  const unsafe = dryRunPackage();
  unsafe.transport.networkCallsAllowed = true;

  const status = buildWorkflowStatus({
    bundle: approvedBundle(),
    postizDryRunPackage: unsafe,
    artifactPresence: {
      brandContext: true,
      manualPackage: true,
      moneyprinterVideo: true,
      postizDryRunPackage: true
    }
  });

  assert.equal(status.overall.status, "blocked");
  assert.equal(status.readiness.canCreatePostizDraft, false);
  assert.match(status.blockers.join("\n"), /network calls/i);
});

test("writes JSON and Markdown workflow status from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-status-"));
  try {
    const bundlePath = path.join(tempDir, "draft-bundle.json");
    const jsonOut = path.join(tempDir, "workflow-status.json");
    const uiOut = path.join(tempDir, "workflow-status.ui.json");
    const markdownOut = path.join(tempDir, "workflow-status.md");
    await writeFile(bundlePath, `${JSON.stringify(pendingBundle(), null, 2)}\n`);

    const result = await buildWorkflowStatusFromFiles({
      bundlePath,
      jsonOut,
      uiOut,
      markdownOut,
      generatedAt: "2026-06-10T13:30:00.000Z",
      artifactPresence: {
        brandContext: true,
        manualPackage: true,
        moneyprinterVideo: true,
        postizDryRunPackage: false
      }
    });

    assert.equal(result.jsonOut, jsonOut);
    const savedJson = JSON.parse(await readFile(jsonOut, "utf8"));
    const savedUi = JSON.parse(await readFile(uiOut, "utf8"));
    const savedMarkdown = await readFile(markdownOut, "utf8");
    assert.equal(savedJson.overall.status, "needs_review");
    assert.equal(savedUi.status, "needs_review");
    assert.equal(savedUi.freshness.generatedAt, "2026-06-10T13:30:00.000Z");
    assert.equal(savedUi.freshness.sourceGeneratedAt, "2026-06-10T11:17:33.844Z");
    assert.equal(savedUi.freshness.generatedPath, "social-studio/generated/cc-rubber-base-demo-2026-06-10");
    assert.equal(JSON.stringify(savedUi).includes("C:\\"), false);
    assert.match(savedMarkdown, /Nothing has been posted live/);
    assert.match(savedMarkdown, /separate final scheduling\/publishing approval/i);
    assert.doesNotMatch(savedMarkdown, /until there is explicit approval/i);
    assert.match(savedMarkdown, /Artifact Freshness/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
