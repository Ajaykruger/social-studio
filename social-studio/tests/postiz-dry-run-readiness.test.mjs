import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildPostizDryRunReadiness,
  buildPostizDryRunReadinessFromFiles
} from "../tools/build-postiz-dry-run-readiness.mjs";

function workflowStatus(status = "needs_review") {
  const approved = status !== "needs_review";
  return {
    packageType: "social_studio_workflow_status",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    overall: {
      status,
      mvpComplete: false
    },
    readiness: {
      canCreatePostizDraft: status === "postiz_draft_ready",
      canScheduleOrPublish: false,
      needsHumanReview: !approved
    },
    safety: {
      noLivePosting: true
    },
    artifacts: {
      manualPackage: true,
      postizDryRunPackage: status === "postiz_draft_ready"
    }
  };
}

function approvedBundleWithReviewAssets() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    postizHandoff: {
      reviewAssets: [
        {
          assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
          contentType: "ugc_video",
          mediaType: "video"
        },
        {
          assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
          contentType: "paid_ad_video",
          mediaType: "video"
        },
        {
          assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
          contentType: "normal_post",
          mediaType: "image"
        }
      ]
    }
  };
}

function postizInputKitWithReviewAssets() {
  const assets = approvedBundleWithReviewAssets().postizHandoff.reviewAssets.map((asset) => ({
    assetId: asset.assetId,
    contentType: asset.contentType
  }));
  return {
    packageType: "social_studio_postiz_input_kit",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    summary: {
      requiredMediaAssets: 3,
      uploadedMediaReady: 0
    },
    validation: {
      requiredMediaAssets: assets
    }
  };
}

function placeholderIntegrations() {
  return [
    {
      platform: "instagram",
      id: "replace-with-postiz-instagram-integration-id",
      settings: { __type: "instagram", post_type: "reel" }
    }
  ];
}

function realIntegrations() {
  return [
    {
      platform: "instagram",
      id: "postiz-instagram-integration-id",
      settings: { __type: "instagram", post_type: "reel" }
    }
  ];
}

function placeholderMedia() {
  return [
    {
      id: "replace-with-postiz-uploaded-media-id",
      path: "https://uploads.postiz.com/replace-with-uploaded-media-path.mp4"
    }
  ];
}

function todoIntegrations() {
  return [
    {
      platform: "instagram",
      id: "TODO_POSTIZ_INSTAGRAM_INTEGRATION_ID",
      settings: { __type: "instagram", post_type: "reel" }
    }
  ];
}

function todoMediaForAllAssets() {
  return approvedBundleWithReviewAssets().postizHandoff.reviewAssets.map((asset) => ({
    assetId: asset.assetId,
    contentType: asset.contentType,
    id: `TODO_POSTIZ_${asset.contentType.toUpperCase()}_UPLOADED_MEDIA_ID`,
    path: `TODO_POSTIZ_${asset.contentType.toUpperCase()}_UPLOADED_MEDIA_PATH`
  }));
}

function realMedia() {
  return [
    {
      id: "postiz-uploaded-media-id",
      path: "https://uploads.postiz.com/final-1.mp4"
    }
  ];
}

function realMediaForAllAssets() {
  return approvedBundleWithReviewAssets().postizHandoff.reviewAssets.map((asset) => ({
    assetId: asset.assetId,
    contentType: asset.contentType,
    id: `postiz-${asset.contentType}-uploaded-media-id`,
    path: `https://uploads.postiz.com/${asset.assetId}.mp4`
  }));
}

function secretIntegrations() {
  return [
    {
      platform: "instagram",
      id: "postiz-instagram-integration-id",
      settings: {
        __type: "instagram",
        post_type: "reel",
        apiKey: "postiz_live_secret_key_1234567890"
      }
    }
  ];
}

function secretMedia() {
  return [
    {
      id: "postiz-uploaded-media-id",
      path: "https://uploads.postiz.com/final-1.mp4",
      accessToken: "postiz_media_access_token_1234567890"
    }
  ];
}

test("builds a blocked Postiz dry-run readiness checklist for current needs-review state", () => {
  const readiness = buildPostizDryRunReadiness({
    workflowStatus: workflowStatus("needs_review"),
    integrations: placeholderIntegrations(),
    uploadedMedia: placeholderMedia(),
    approvedBundleExists: false,
    manualManifestExists: true,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T18:00:00.000Z"
  });

  assert.equal(readiness.packageType, "social_studio_postiz_dry_run_readiness");
  assert.equal(readiness.status, "blocked_by_human_review");
  assert.equal(readiness.dryRunOnly, true);
  assert.equal(readiness.networkCallsAllowed, false);
  assert.equal(readiness.noLivePosting, true);
  assert.equal(readiness.summary.readySteps, 2);
  assert.equal(readiness.summary.blockedSteps, 4);
  assert.deepEqual(
    readiness.steps.map((step) => `${step.id}:${step.status}`),
    [
      "human_approval:blocked",
      "manual_package:ready",
      "local_input_safety:ready",
      "uploaded_media:blocked",
      "integrations:blocked",
      "dry_run_package:blocked"
    ]
  );
  assert.match(readiness.nextAction, /Complete human review/i);
  assert.equal(JSON.stringify(readiness.uiSummary).includes("C:\\"), false);
  assert.equal(JSON.stringify(readiness.uiSummary).includes("replace-with"), false);
});

test("uses Postiz input kit media requirements before approval exists", () => {
  const readiness = buildPostizDryRunReadiness({
    workflowStatus: workflowStatus("needs_review"),
    postizInputKit: postizInputKitWithReviewAssets(),
    integrations: placeholderIntegrations(),
    uploadedMedia: placeholderMedia(),
    approvedBundleExists: false,
    manualManifestExists: true,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T18:00:00.000Z"
  });

  assert.equal(readiness.status, "blocked_by_human_review");
  assert.equal(readiness.summary.requiredMediaAssets, 3);
  assert.equal(readiness.summary.uploadedMediaReady, 0);
  assert.match(
    readiness.steps.find((step) => step.id === "uploaded_media").detail,
    /0\/3/
  );
});

test("keeps TODO Postiz placeholders blocked after local input files are prepared", () => {
  const readiness = buildPostizDryRunReadiness({
    workflowStatus: workflowStatus("needs_review"),
    postizInputKit: postizInputKitWithReviewAssets(),
    integrations: todoIntegrations(),
    uploadedMedia: todoMediaForAllAssets(),
    approvedBundleExists: false,
    manualManifestExists: true,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T18:00:00.000Z"
  });

  assert.equal(readiness.status, "blocked_by_human_review");
  assert.equal(readiness.summary.requiredMediaAssets, 3);
  assert.equal(readiness.summary.uploadedMediaReady, 0);
  assert.equal(
    readiness.steps.find((step) => step.id === "uploaded_media").status,
    "blocked"
  );
  assert.equal(
    readiness.steps.find((step) => step.id === "integrations").status,
    "blocked"
  );
});

test("marks Postiz dry-run readiness ready only after approval and real Postiz references", () => {
  const readiness = buildPostizDryRunReadiness({
    workflowStatus: workflowStatus("approved_waiting_postiz_dry_run"),
    integrations: realIntegrations(),
    uploadedMedia: realMedia(),
    approvedBundleExists: true,
    manualManifestExists: true,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T18:00:00.000Z"
  });

  assert.equal(readiness.status, "ready_for_dry_run");
  assert.equal(readiness.summary.readySteps, 5);
  assert.equal(readiness.summary.blockedSteps, 1);
  assert.match(readiness.nextAction, /Build the Postiz dry-run payload/i);
});

test("blocks Postiz dry-run readiness until every approved review asset has uploaded media", () => {
  const readiness = buildPostizDryRunReadiness({
    workflowStatus: workflowStatus("approved_waiting_postiz_dry_run"),
    approvedBundle: approvedBundleWithReviewAssets(),
    integrations: realIntegrations(),
    uploadedMedia: realMediaForAllAssets().slice(0, 2),
    approvedBundleExists: true,
    manualManifestExists: true,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T18:00:00.000Z"
  });

  assert.equal(readiness.status, "blocked_by_postiz_inputs");
  assert.equal(readiness.summary.requiredMediaAssets, 3);
  assert.equal(
    readiness.steps.find((step) => step.id === "uploaded_media").status,
    "blocked"
  );
  assert.match(
    readiness.steps.find((step) => step.id === "uploaded_media").detail,
    /2\/3/
  );
});

test("blocks dry-run readiness when local Postiz inputs contain secrets", () => {
  const readiness = buildPostizDryRunReadiness({
    workflowStatus: workflowStatus("approved_waiting_postiz_dry_run"),
    integrations: secretIntegrations(),
    uploadedMedia: secretMedia(),
    approvedBundleExists: true,
    manualManifestExists: true,
    postizDryRunExists: false,
    generatedAt: "2026-06-10T18:00:00.000Z"
  });

  assert.equal(readiness.status, "blocked_by_postiz_input_secrets");
  assert.equal(readiness.summary.readySteps, 4);
  assert.equal(readiness.summary.blockedSteps, 2);
  assert.equal(
    readiness.steps.find((step) => step.id === "local_input_safety").status,
    "blocked"
  );
  assert.match(readiness.nextAction, /Remove API keys, tokens, and secrets/i);
  assert.equal(JSON.stringify(readiness.uiSummary).includes("postiz_live_secret_key"), false);
  assert.equal(JSON.stringify(readiness.uiSummary).includes("postiz_media_access_token"), false);
});

test("writes Postiz dry-run readiness JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-readiness-"));
  try {
    const workflowStatusPath = path.join(tempDir, "workflow-status.json");
    const integrationsPath = path.join(tempDir, "integrations.json");
    const uploadedMediaPath = path.join(tempDir, "uploaded-media.json");
    const approvedBundlePath = path.join(tempDir, "approved-bundle.json");
    const postizInputKitPath = path.join(tempDir, "postiz-input-kit.json");
    const manualManifestPath = path.join(tempDir, "manifest.json");
    const postizDryRunPath = path.join(tempDir, "postiz-draft.dry-run.json");
    const outDir = path.join(tempDir, "postiz-readiness");

    await writeFile(workflowStatusPath, `${JSON.stringify(workflowStatus("needs_review"), null, 2)}\n`);
    await writeFile(integrationsPath, `${JSON.stringify(placeholderIntegrations(), null, 2)}\n`);
    await writeFile(uploadedMediaPath, `${JSON.stringify(placeholderMedia(), null, 2)}\n`);
    await writeFile(approvedBundlePath, `${JSON.stringify(approvedBundleWithReviewAssets(), null, 2)}\n`);
    await writeFile(postizInputKitPath, `${JSON.stringify(postizInputKitWithReviewAssets(), null, 2)}\n`);
    await writeFile(manualManifestPath, "{}\n");

    const result = await buildPostizDryRunReadinessFromFiles({
      workflowStatusPath,
      integrationsPath,
      uploadedMediaPath,
      approvedBundlePath,
      postizInputKitPath,
      manualManifestPath,
      postizDryRunPath,
      outDir,
      generatedAt: "2026-06-10T18:00:00.000Z"
    });

    assert.equal(result.status, "blocked_by_human_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "postiz-dry-run-readiness.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "postiz-dry-run-readiness.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "postiz-dry-run-readiness.md"), "utf8");
    assert.equal(saved.status, "blocked_by_human_review");
    assert.equal(ui.status, "blocked_by_human_review");
    assert.match(markdown, /Postiz Dry-Run Readiness/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
