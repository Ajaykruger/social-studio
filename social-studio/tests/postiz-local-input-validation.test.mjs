import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  validatePostizLocalInputs,
  validatePostizLocalInputsFromFiles
} from "../tools/validate-postiz-local-inputs.mjs";

function bundleWithReviewAssets() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    postizHandoff: {
      platforms: ["instagram", "facebook", "tiktok"],
      media: { mediaType: "video" },
      reviewAssets: [
        {
          assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
          label: "UGC video",
          contentType: "ugc_video",
          mediaType: "video",
          assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4"
        },
        {
          assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
          label: "Paid ad video",
          contentType: "paid_ad_video",
          mediaType: "video",
          assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4"
        },
        {
          assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
          label: "Normal post",
          contentType: "normal_post",
          mediaType: "image",
          assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg"
        }
      ]
    }
  };
}

function placeholderIntegrations() {
  return ["instagram", "facebook", "tiktok"].map((platform) => ({
    platform,
    id: `TODO_POSTIZ_${platform.toUpperCase()}_INTEGRATION_ID`,
    settings: { __type: platform }
  }));
}

function realIntegrations() {
  return ["instagram", "facebook", "tiktok"].map((platform) => ({
    platform,
    id: `postiz-${platform}-integration-id`,
    settings: { __type: platform }
  }));
}

function realMedia() {
  return bundleWithReviewAssets().postizHandoff.reviewAssets.map((asset) => ({
    assetId: asset.assetId,
    contentType: asset.contentType,
    id: `postiz-${asset.contentType}-uploaded-media-id`,
    path: `https://uploads.postiz.com/${asset.assetId}.mp4`
  }));
}

test("blocks placeholder local Postiz inputs with a redacted fail-fast report", () => {
  const result = validatePostizLocalInputs({
    bundle: bundleWithReviewAssets(),
    integrations: placeholderIntegrations(),
    uploadedMedia: realMedia().slice(0, 1),
    generatedAt: "2026-06-11T08:30:00.000Z"
  });

  assert.equal(result.packageType, "social_studio_postiz_local_input_validation");
  assert.equal(result.status, "blocked");
  assert.equal(result.readyForDryRun, false);
  assert.equal(result.exitCode, 1);
  assert.equal(result.commandOnly, true);
  assert.equal(result.networkCallsAllowed, false);
  assert.equal(result.liveActionsEnabled, false);
  assert.deepEqual(result.blockingReasons, ["missing_postiz_input_values"]);
  assert.equal(result.summary.missingChecks, 5);
  assert.equal(result.operatorPreflight.integrationChecks.length, 3);
  assert.equal(result.operatorPreflight.mediaChecks.length, 3);
  assert.deepEqual(
    result.operatorEditPlan.files.map((file) => file.file),
    ["integrations.local.json", "uploaded-media.local.json"]
  );
  assert.equal(result.operatorEditPlan.files[0].records.length, 3);
  assert.equal(result.operatorEditPlan.files[1].records.length, 2);
  assert.match(result.operatorEditPlan.forbiddenFields.join("\n"), /tokens/i);
  assert.equal(result.uiSummary.operatorEditPlan.files.length, 2);
  assert.match(result.nextAction, /Edit integrations\.local\.json and uploaded-media\.local\.json/i);
  assert.doesNotMatch(JSON.stringify(result.uiSummary), /TODO_POSTIZ|postiz-ugc_video-uploaded-media-id|uploads\.postiz|C:\\/i);
});

test("marks local Postiz inputs ready only when every required reference is real", () => {
  const result = validatePostizLocalInputs({
    bundle: bundleWithReviewAssets(),
    integrations: realIntegrations(),
    uploadedMedia: realMedia(),
    generatedAt: "2026-06-11T08:30:00.000Z"
  });

  assert.equal(result.status, "ready");
  assert.equal(result.readyForDryRun, true);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.blockingReasons, []);
  assert.equal(result.summary.missingChecks, 0);
  assert.match(result.nextAction, /run the Postiz dry-run cycle/i);
});

test("reports exact missing fields for partially filled local Postiz inputs", () => {
  const result = validatePostizLocalInputs({
    bundle: bundleWithReviewAssets(),
    integrations: [
      {
        platform: "instagram",
        id: "postiz-instagram-integration-id",
        settings: {}
      },
      {
        platform: "facebook",
        id: "TODO_POSTIZ_FACEBOOK_INTEGRATION_ID",
        settings: { __type: "facebook" }
      },
      {
        platform: "tiktok",
        id: "postiz-tiktok-integration-id",
        settings: { __type: "tiktok" }
      }
    ],
    uploadedMedia: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        contentType: "ugc_video",
        id: "postiz-ugc-video-uploaded-media-id",
        path: "TODO_POSTIZ_UGC_VIDEO_UPLOADED_MEDIA_MP4_PATH"
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        contentType: "paid_ad_video",
        id: "",
        path: "https://uploads.postiz.com/paid-ad-video-02.mp4"
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        contentType: "normal_post",
        id: "postiz-normal-post-uploaded-media-id",
        path: "https://uploads.postiz.com/normal-post-03.svg"
      }
    ],
    generatedAt: "2026-06-11T08:30:00.000Z"
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(
    result.operatorPreflight.integrationChecks.map((check) => [check.platform, check.status, check.missingFields]),
    [
      ["instagram", "missing", ["settings.__type"]],
      ["facebook", "missing", ["id"]],
      ["tiktok", "ready", []]
    ]
  );
  assert.deepEqual(
    result.operatorPreflight.mediaChecks.map((check) => [check.contentType, check.status, check.missingFields]),
    [
      ["ugc_video", "missing", ["path"]],
      ["paid_ad_video", "missing", ["id"]],
      ["normal_post", "ready", []]
    ]
  );
  assert.deepEqual(
    result.operatorEditPlan.files[0].records.map((record) => [record.key, record.missingFields]),
    [
      ["instagram", ["settings.__type"]],
      ["facebook", ["id"]]
    ]
  );
  assert.deepEqual(
    result.operatorEditPlan.files[1].records.map((record) => [record.contentType, record.missingFields]),
    [
      ["ugc_video", ["path"]],
      ["paid_ad_video", ["id"]]
    ]
  );
  assert.match(result.markdown, /instagram: missing\. File: integrations\.local\.json\. Missing fields: settings\.__type/i);
  assert.match(result.markdown, /UGC video: missing\. File: uploaded-media\.local\.json\. Missing fields: path/i);
  assert.doesNotMatch(JSON.stringify(result.uiSummary), /postiz-instagram-integration-id|uploads\.postiz|postiz-normal-post-uploaded-media-id/i);
});

test("writes validation JSON, UI JSON, and Markdown from files without leaking values", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-input-validation-"));
  try {
    const bundlePath = path.join(tempDir, "approved-bundle.json");
    const integrationsPath = path.join(tempDir, "integrations.local.json");
    const uploadedMediaPath = path.join(tempDir, "uploaded-media.local.json");
    const reportDir = path.join(tempDir, "validation");

    await writeFile(bundlePath, `${JSON.stringify(bundleWithReviewAssets(), null, 2)}\n`);
    await writeFile(
      integrationsPath,
      `${JSON.stringify([{ ...realIntegrations()[0], settings: { __type: "instagram", apiKey: "postiz_live_secret_key_1234567890" } }], null, 2)}\n`
    );
    await writeFile(uploadedMediaPath, `${JSON.stringify(realMedia(), null, 2)}\n`);

    const result = await validatePostizLocalInputsFromFiles({
      bundlePath,
      integrationsPath,
      uploadedMediaPath,
      outDir: reportDir,
      generatedAt: "2026-06-11T08:30:00.000Z"
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.exitCode, 1);
    const saved = JSON.parse(await readFile(path.join(reportDir, "postiz-local-input-validation.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(reportDir, "postiz-local-input-validation.ui.json"), "utf8"));
    const markdown = await readFile(path.join(reportDir, "postiz-local-input-validation.md"), "utf8");

    assert.deepEqual(saved.blockingReasons, ["input_secrets"]);
    assert.equal(ui.summary.secretFieldCount, 1);
    assert.match(markdown, /Postiz Local Input Validation/);
    assert.match(markdown, /Input secrets: blocked/);
    assert.doesNotMatch(JSON.stringify(ui), /postiz_live_secret_key|C:\\|uploads\.postiz/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
