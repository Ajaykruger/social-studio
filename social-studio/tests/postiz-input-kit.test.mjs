import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildPostizInputKit,
  buildPostizInputKitFromFiles
} from "../tools/build-postiz-input-kit.mjs";

function bundle() {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    postizHandoff: {
      platforms: ["instagram", "facebook", "tiktok"],
      media: {
        mediaType: "video"
      }
    }
  };
}

function bundleWithReviewAssets() {
  const result = bundle();
  result.postizHandoff.reviewAssets = [
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
  ];
  return result;
}

function reviewBoard() {
  return {
    packageType: "social_studio_review_board",
    items: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        label: "UGC video",
        contentType: "ugc_video",
        reviewAction: "review_decision_required",
        media: {
          videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4"
        }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        label: "Paid ad video",
        contentType: "paid_ad_video",
        reviewAction: "review_decision_required",
        media: {
          videoUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4"
        }
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        label: "Normal post",
        contentType: "normal_post",
        reviewAction: "review_decision_required",
        media: {
          imageUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg"
        }
      }
    ]
  };
}

function placeholderIntegrations() {
  return [
    {
      platform: "instagram",
      id: "replace-with-postiz-instagram-integration-id",
      settings: { __type: "instagram", post_type: "reel" }
    },
    {
      platform: "facebook",
      id: "replace-with-postiz-facebook-integration-id",
      settings: { __type: "facebook" }
    },
    {
      platform: "tiktok",
      id: "replace-with-postiz-tiktok-integration-id",
      settings: { __type: "tiktok" }
    }
  ];
}

function realIntegrations() {
  return placeholderIntegrations().map((integration) => ({
    ...integration,
    id: `postiz-${integration.platform}-integration-id`
  }));
}

function placeholderMedia() {
  return [
    {
      id: "replace-with-postiz-uploaded-media-id",
      path: "https://uploads.postiz.com/replace-with-uploaded-media-path.mp4"
    }
  ];
}

function realMedia() {
  return [
    {
      id: "postiz-uploaded-media-id",
      path: "https://uploads.postiz.com/final-1.mp4"
    }
  ];
}

function realMediaForReviewAssets() {
  return bundleWithReviewAssets().postizHandoff.reviewAssets.map((asset) => ({
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
    },
    {
      platform: "facebook",
      id: "postiz-facebook-integration-id",
      settings: { __type: "facebook" }
    },
    {
      platform: "tiktok",
      id: "postiz-tiktok-integration-id",
      settings: { __type: "tiktok" }
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

test("builds a safe Postiz input kit from placeholder values", () => {
  const kit = buildPostizInputKit({
    bundle: bundle(),
    integrations: placeholderIntegrations(),
    uploadedMedia: placeholderMedia(),
    generatedAt: "2026-06-10T19:00:00.000Z"
  });

  assert.equal(kit.packageType, "social_studio_postiz_input_kit");
  assert.equal(kit.status, "needs_real_values");
  assert.equal(kit.networkCallsAllowed, false);
  assert.equal(kit.secretsInUi, false);
  assert.equal(kit.summary.requiredPlatforms, 3);
  assert.equal(kit.summary.readyIntegrations, 0);
  assert.equal(kit.summary.uploadedMediaReady, 0);
  assert.deepEqual(kit.validation.missingPlatforms, ["instagram", "facebook", "tiktok"]);
  assert.match(kit.nextAction, /Copy the template files/i);
  assert.equal(JSON.stringify(kit.uiSummary).includes("replace-with"), false);
  assert.equal(JSON.stringify(kit.uiSummary).includes("C:\\"), false);
});

test("tells operators to edit prepared local files when placeholders remain", () => {
  const kit = buildPostizInputKit({
    bundle: bundleWithReviewAssets(),
    integrations: placeholderIntegrations(),
    uploadedMedia: placeholderMedia(),
    preparedLocalFiles: {
      integrations: "integrations.local.json",
      uploadedMedia: "uploaded-media.local.json"
    },
    generatedAt: "2026-06-10T19:00:00.000Z"
  });

  assert.equal(kit.status, "needs_real_values");
  assert.equal(kit.files.integrationsLocal, "integrations.local.json");
  assert.equal(kit.files.uploadedMediaLocal, "uploaded-media.local.json");
  assert.match(kit.nextAction, /Edit integrations\.local\.json and uploaded-media\.local\.json/i);
  assert.doesNotMatch(kit.nextAction, /Copy the template files/i);
  assert.equal(kit.operatorPreflight.status, "needs_real_values");
  assert.deepEqual(
    kit.operatorPreflight.integrationChecks.map((check) => check.platform),
    ["instagram", "facebook", "tiktok"]
  );
  assert.equal(
    kit.operatorPreflight.integrationChecks.every((check) => check.localInputFile === "integrations.local.json"),
    true
  );
  assert.deepEqual(kit.operatorPreflight.integrationChecks[0].requiredFields, ["id", "settings.__type"]);
  assert.equal(kit.operatorPreflight.mediaChecks.length, 3);
  assert.equal(
    kit.operatorPreflight.mediaChecks.every((check) => check.localInputFile === "uploaded-media.local.json"),
    true
  );
  assert.deepEqual(kit.operatorPreflight.mediaChecks[0].requiredFields, ["id", "path"]);
  assert.match(kit.operatorPreflight.mediaChecks[0].sourceAssetUrl, /final-1\.mp4/);
  assert.match(kit.operatorPreflight.mediaChecks[1].sourceAssetUrl, /paid-ad-video-02\.mp4/);
  assert.match(kit.operatorPreflight.mediaChecks[2].sourceAssetUrl, /normal-post-03\.svg/);
  assert.equal(kit.uiSummary.validation.requiredMediaAssets.length, 3);
  assert.equal(kit.uiSummary.operatorPreflight.mediaChecks.length, 3);
  assert.equal(kit.uiSummary.operatorPreflight.integrationChecks.length, 3);
  assert.deepEqual(
    kit.operatorEditPlan.files.map((file) => file.file),
    ["integrations.local.json", "uploaded-media.local.json"]
  );
  assert.deepEqual(
    kit.operatorEditPlan.files[0].records.map((record) => record.key),
    ["instagram", "facebook", "tiktok"]
  );
  assert.deepEqual(kit.operatorEditPlan.files[0].allowedFields, ["platform", "id", "settings.__type"]);
  assert.deepEqual(
    kit.operatorEditPlan.files[1].records.map((record) => record.key),
    [
      "cc-rubber-base-demo-2026-06-10-ugc-video-01",
      "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
      "cc-rubber-base-demo-2026-06-10-normal-post-03"
    ]
  );
  assert.match(kit.operatorEditPlan.files[1].records[0].sourceAssetUrl, /final-1\.mp4/);
  assert.match(kit.operatorEditPlan.files[1].records[1].sourceAssetUrl, /paid-ad-video-02\.mp4/);
  assert.match(kit.operatorEditPlan.files[1].records[2].sourceAssetUrl, /normal-post-03\.svg/);
  assert.match(kit.operatorEditPlan.files[1].records[0].sourceInstruction, /Upload the reviewed source asset/i);
  assert.deepEqual(kit.operatorEditPlan.files[1].allowedFields, ["assetId", "contentType", "id", "path"]);
  assert.match(kit.operatorEditPlan.forbiddenFields.join("\n"), /api keys/i);
  assert.equal(kit.uiSummary.operatorEditPlan.files.length, 2);
  assert.deepEqual(
    kit.uiSummary.validation.requiredMediaAssets.map((asset) => asset.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );
  assert.equal(
    kit.uiSummary.validation.requiredMediaAssets.every((asset) => /uploaded-media\.local\.json/.test(asset.localInputFile)),
    true
  );
  assert.match(kit.markdown, /Upload Targets/i);
  assert.match(kit.markdown, /Operator Preflight/i);
  assert.match(kit.markdown, /Operator Edit Plan/i);
  assert.match(kit.markdown, /Source asset: \/social-studio\/cc-rubber-base-demo-2026-06-10\/review\/final-1\.mp4/i);
  assert.match(kit.markdown, /Source asset: \/social-studio\/cc-rubber-base-demo-2026-06-10\/review\/normal-post-03\.svg/i);
  assert.match(kit.markdown, /instagram: missing/i);
  assert.match(kit.markdown, /UGC video: missing/i);
  assert.match(kit.markdown, /UGC video/i);
  assert.match(kit.markdown, /Integrations local file: integrations\.local\.json/i);
  assert.match(kit.markdown, /Uploaded media local file: uploaded-media\.local\.json/i);
  assert.equal(JSON.stringify(kit.uiSummary).includes("C:\\"), false);
});

test("marks Postiz input kit ready when all references are real", () => {
  const kit = buildPostizInputKit({
    bundle: bundle(),
    integrations: realIntegrations(),
    uploadedMedia: realMedia(),
    generatedAt: "2026-06-10T19:00:00.000Z"
  });

  assert.equal(kit.status, "ready");
  assert.equal(kit.operatorPreflight.status, "ready");
  assert.equal(
    kit.operatorPreflight.integrationChecks.every((check) => check.status === "ready"),
    true
  );
  assert.equal(
    kit.operatorPreflight.mediaChecks.every((check) => check.status === "ready"),
    true
  );
  assert.equal(kit.summary.readyIntegrations, 3);
  assert.equal(kit.summary.uploadedMediaReady, 1);
  assert.deepEqual(kit.validation.missingPlatforms, []);
  assert.match(kit.nextAction, /Run the Postiz dry-run readiness refresh/i);
});

test("requires uploaded media references for every generated review asset", () => {
  const kit = buildPostizInputKit({
    bundle: bundleWithReviewAssets(),
    integrations: realIntegrations(),
    uploadedMedia: realMediaForReviewAssets().slice(0, 2),
    generatedAt: "2026-06-10T19:00:00.000Z"
  });

  assert.equal(kit.status, "needs_real_values");
  assert.equal(kit.summary.requiredMediaAssets, 3);
  assert.equal(kit.summary.uploadedMediaReady, 2);
  assert.equal(kit.validation.uploadedMediaReady, false);
  assert.equal(kit.templates.uploadedMedia.length, 3);
  assert.deepEqual(
    kit.templates.uploadedMedia.map((media) => media.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );
});

test("uses review board assets for uploaded media templates before approval", () => {
  const kit = buildPostizInputKit({
    bundle: bundle(),
    reviewBoard: reviewBoard(),
    integrations: realIntegrations(),
    uploadedMedia: realMedia(),
    generatedAt: "2026-06-10T19:00:00.000Z"
  });

  assert.equal(kit.status, "needs_real_values");
  assert.equal(kit.summary.requiredMediaAssets, 3);
  assert.equal(kit.summary.uploadedMediaReady, 0);
  assert.equal(kit.templates.uploadedMedia.length, 3);
  assert.deepEqual(
    kit.templates.uploadedMedia.map((media) => media.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );
});

test("blocks local Postiz input files that contain API keys or tokens", () => {
  const kit = buildPostizInputKit({
    bundle: bundle(),
    integrations: secretIntegrations(),
    uploadedMedia: secretMedia(),
    generatedAt: "2026-06-10T19:00:00.000Z"
  });

  assert.equal(kit.status, "blocked_by_input_secrets");
  assert.equal(kit.secretsInUi, false);
  assert.equal(kit.validation.inputSecretsReady, false);
  assert.equal(kit.validation.secretFieldCount, 2);
  assert.match(kit.nextAction, /Remove API keys, tokens, and secrets/i);
  assert.equal(JSON.stringify(kit.uiSummary).includes("postiz_live_secret_key"), false);
  assert.equal(JSON.stringify(kit.uiSummary).includes("postiz_media_access_token"), false);
});

test("writes kit JSON, UI JSON, Markdown, and local templates from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-input-kit-"));
  try {
    const bundlePath = path.join(tempDir, "draft-bundle.json");
    const integrationsPath = path.join(tempDir, "integrations.example.json");
    const uploadedMediaPath = path.join(tempDir, "uploaded-media.example.json");
    const outDir = path.join(tempDir, "postiz-input-kit");

    await writeFile(bundlePath, `${JSON.stringify(bundle(), null, 2)}\n`);
    await writeFile(integrationsPath, `${JSON.stringify(placeholderIntegrations(), null, 2)}\n`);
    await writeFile(uploadedMediaPath, `${JSON.stringify(placeholderMedia(), null, 2)}\n`);

    const result = await buildPostizInputKitFromFiles({
      bundlePath,
      integrationsPath,
      uploadedMediaPath,
      outDir,
      generatedAt: "2026-06-10T19:00:00.000Z"
    });

    assert.equal(result.status, "needs_real_values");
    const saved = JSON.parse(await readFile(path.join(outDir, "postiz-input-kit.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "postiz-input-kit.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "postiz-input-kit.md"), "utf8");
    const integrationsTemplate = JSON.parse(await readFile(path.join(outDir, "integrations.local.template.json"), "utf8"));
    const mediaTemplate = JSON.parse(await readFile(path.join(outDir, "uploaded-media.local.template.json"), "utf8"));

    assert.equal(saved.status, "needs_real_values");
    assert.equal(ui.status, "needs_real_values");
    assert.equal(integrationsTemplate.length, 3);
    assert.equal(mediaTemplate.length, 1);
    assert.match(markdown, /Postiz Input Kit/);
    assert.equal(JSON.stringify(ui).includes("replace-with"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
