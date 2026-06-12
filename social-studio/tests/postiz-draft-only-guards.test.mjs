import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyReviewDecision } from "../tools/record-review-decision.mjs";
import { buildPostizDraftPackage } from "../handoff/postiz/create-draft-payload.mjs";
import {
  assertDraftSafeSettings,
  findDirectPublishSettings,
  isPlaceholderValue
} from "../lib/postiz-input-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      notes: "Needs review.",
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
      platforms: ["tiktok"],
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
    }
  };
}

function approvedBundle() {
  return applyReviewDecision(pendingBundle(), {
    decision: "approve",
    reviewer: "Jen",
    evidence: fullApprovalEvidence,
    approvedAt: "2026-06-12T12:00:00.000Z",
    notes: "Approved for Postiz draft creation only."
  });
}

function tiktokIntegration(settingsOverrides = {}) {
  return [
    {
      platform: "tiktok",
      id: "postiz-tiktok-channel-id",
      settings: {
        __type: "tiktok",
        privacy_level: "PUBLIC_TO_EVERYONE",
        content_posting_method: "UPLOAD",
        ...settingsOverrides
      }
    }
  ];
}

function uploadedMedia() {
  return [
    {
      id: "postiz-media-id-1",
      path: "/uploads/final-1.mp4",
      assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
      contentType: "ugc_video"
    }
  ];
}

test("placeholder detection treats TODO_ values as unfilled", () => {
  assert.equal(isPlaceholderValue("TODO_POSTIZ_INSTAGRAM_INTEGRATION_ID"), true);
  assert.equal(isPlaceholderValue("replace-with-real-id"), true);
  assert.equal(isPlaceholderValue("placeholder"), true);
  assert.equal(isPlaceholderValue("postiz-real-channel-id"), false);
});

test("draft payload rejects TODO_ placeholder integration ids", () => {
  const integrations = tiktokIntegration();
  integrations[0].id = "TODO_POSTIZ_TIKTOK_INTEGRATION_ID";
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        integrations,
        uploadedMedia: uploadedMedia()
      }),
    /placeholder Postiz integration id is not allowed/
  );
});

test("draft payload rejects TODO_ placeholder uploaded media references", () => {
  const media = uploadedMedia();
  media[0].id = "TODO_POSTIZ_UGC_VIDEO_UPLOADED_MEDIA_ID";
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        integrations: tiktokIntegration(),
        uploadedMedia: media
      }),
    /placeholder uploaded Postiz media reference is not allowed/
  );
});

test("draft payload rejects direct publish settings (TikTok DIRECT_POST)", () => {
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        integrations: tiktokIntegration({ content_posting_method: "DIRECT_POST" }),
        uploadedMedia: uploadedMedia()
      }),
    /draft-only handoff cannot carry direct publish settings for tiktok/
  );
});

test("draft payload accepts draft-safe UPLOAD settings", () => {
  const result = buildPostizDraftPackage({
    bundle: approvedBundle(),
    integrations: tiktokIntegration(),
    uploadedMedia: uploadedMedia()
  });
  assert.equal(result.postizPayload.type, "draft");
  assert.equal(result.dryRunOnly, true);
  assert.equal(
    result.postizPayload.posts[0].settings.content_posting_method,
    "UPLOAD"
  );
});

test("direct publish guard helpers flag DIRECT_POST and pass UPLOAD", () => {
  assert.deepEqual(
    findDirectPublishSettings({ content_posting_method: "UPLOAD" }),
    []
  );
  assert.equal(
    findDirectPublishSettings({ content_posting_method: "DIRECT_POST" }).length,
    1
  );
  assert.throws(
    () => assertDraftSafeSettings({ content_posting_method: "DIRECT_POST" }, "tiktok"),
    /direct publish settings/
  );
});

test("no committed Postiz input template carries DIRECT_POST", async () => {
  const files = [
    "../handoff/postiz/api-draft/integrations.example.json",
    "../generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/integrations.local.template.json",
    "../generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/postiz-input-kit.json"
  ];
  for (const file of files) {
    const content = await readFile(path.join(__dirname, file), "utf8");
    assert.ok(
      !content.includes("DIRECT_POST"),
      `${file} must not contain DIRECT_POST`
    );
  }
});
