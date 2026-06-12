import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applyReviewDecision } from "../tools/record-review-decision.mjs";
import {
  buildPostizDraftPackage,
  buildPostizDraftPackageFromFiles
} from "../handoff/postiz/create-draft-payload.mjs";

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
      platforms: ["instagram", "facebook"],
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
    reviewer: "Andre",
    evidence: fullApprovalEvidence,
    approvedAt: "2026-06-10T12:00:00.000Z",
    notes: "Approved for Postiz draft creation only."
  });
}

function approvedBundleWithReviewAssets() {
  const bundle = approvedBundle();
  bundle.postizHandoff.reviewAssets = [
    {
      assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
      label: "UGC video",
      contentType: "ugc_video",
      mediaType: "video",
      localPath: "C:\\drafts\\final-1.mp4",
      assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
      label: "Paid ad video",
      contentType: "paid_ad_video",
      mediaType: "video",
      localPath: "C:\\drafts\\paid-ad-video-02.mp4",
      assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4"
    },
    {
      assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
      label: "Normal post",
      contentType: "normal_post",
      mediaType: "image",
      localPath: "C:\\drafts\\normal-post-03.svg",
      assetUrl: "/social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg"
    }
  ];
  return bundle;
}

function postizInputs() {
  return {
    apiBaseUrl: "http://localhost:4007/api/public/v1",
    integrations: [
      {
        platform: "instagram",
        id: "postiz-instagram-channel-id",
        settings: {
          __type: "instagram",
          post_type: "reel"
        }
      },
      {
        platform: "facebook",
        id: "postiz-facebook-channel-id",
        settings: {
          __type: "facebook"
        }
      }
    ],
    uploadedMedia: [
      {
        id: "uploaded-media-id",
        path: "https://uploads.postiz.com/final-1.mp4"
      }
    ]
  };
}

function postizInputsForAllAssets() {
  return {
    ...postizInputs(),
    uploadedMedia: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        contentType: "ugc_video",
        id: "uploaded-ugc-video-id",
        path: "https://uploads.postiz.com/final-1.mp4"
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        contentType: "paid_ad_video",
        id: "uploaded-paid-ad-id",
        path: "https://uploads.postiz.com/paid-ad-video-02.mp4"
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        contentType: "normal_post",
        id: "uploaded-normal-post-id",
        path: "https://uploads.postiz.com/normal-post-03.svg"
      }
    ]
  };
}

test("rejects the current needs-review bundle before building a Postiz draft payload", () => {
  assert.throws(
    () => buildPostizDraftPackage({ bundle: pendingBundle(), ...postizInputs() }),
    /approved bundle/i
  );
});

test("builds a dry-run Postiz draft payload for approved content only", () => {
  const result = buildPostizDraftPackage({
    bundle: approvedBundle(),
    generatedAt: "2026-06-10T13:00:00.000Z",
    ...postizInputs()
  });

  assert.equal(result.dryRunOnly, true);
  assert.equal(result.transport.networkCallsAllowed, false);
  assert.equal(result.postizRequest.method, "POST");
  assert.equal(result.postizRequest.url, "http://localhost:4007/api/public/v1/posts");
  assert.equal(result.postizPayload.type, "draft");
  assert.equal(result.postizPayload.date, undefined);
  assert.equal(result.postizPayload.posts.length, 2);
  assert.equal(result.postizPayload.posts[0].integration.id, "postiz-instagram-channel-id");
  assert.equal(result.postizPayload.posts[0].settings.__type, "instagram");
  assert.equal(result.postizPayload.posts[0].value[0].image[0].id, "uploaded-media-id");
  assert.match(result.postizPayload.posts[0].value[0].content, /Smooth base/);
  assert.match(result.postizPayload.posts[0].value[0].content, /#CrystalClawz #NailTechSA/);
  assert.equal(result.uploadPlan.endpoint, "http://localhost:4007/api/public/v1/upload");
  assert.equal(result.safety.notLiveConfirmed, true);
  assert.equal(result.safety.allowsSchedulingOrPublishing, false);
  assert.equal(result.approvalProof.scope.approvedFor, "postiz_draft_upload_only");
  assert.equal(result.approvalProof.scope.allowsSchedulingOrPublishing, false);
  assert.equal(result.approvalProof.evidenceSummary.status, "covered");
  assert.equal(result.approvalProof.evidenceSummary.summary.coveredGates, 6);
});

test("builds a dry-run Postiz draft payload for every approved review asset", () => {
  const result = buildPostizDraftPackage({
    bundle: approvedBundleWithReviewAssets(),
    generatedAt: "2026-06-10T13:00:00.000Z",
    ...postizInputsForAllAssets()
  });

  assert.equal(result.approvedAssets.length, 3);
  assert.equal(result.uploadPlan.assets.length, 3);
  assert.equal(result.postizPayload.posts.length, 2);
  assert.equal(result.postizPayload.posts[0].value.length, 3);
  assert.deepEqual(
    result.postizPayload.posts[0].value.map((value) => value.image[0].id),
    ["uploaded-ugc-video-id", "uploaded-paid-ad-id", "uploaded-normal-post-id"]
  );
  assert.deepEqual(
    result.postizPayload.posts[0].value.map((value) => value.asset.contentType),
    ["ugc_video", "paid_ad_video", "normal_post"]
  );
});

test("requires an uploaded media reference for every approved review asset", () => {
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundleWithReviewAssets(),
        ...postizInputsForAllAssets(),
        uploadedMedia: postizInputsForAllAssets().uploadedMedia.slice(0, 2)
      }),
    /every approved asset/i
  );
});

test("refuses remote Postiz API bases in this dry-run connector", () => {
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        ...postizInputs(),
        apiBaseUrl: "https://api.postiz.com/public/v1"
      }),
    /local Postiz API base/i
  );
});

test("requires uploaded Postiz media references before creating the posts payload", () => {
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        ...postizInputs(),
        uploadedMedia: []
      }),
    /uploaded Postiz media/i
  );
});

test("rejects placeholder Postiz integration and uploaded media values", () => {
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        ...postizInputs(),
        integrations: [
          {
            platform: "instagram",
            id: "replace-with-postiz-instagram-integration-id",
            settings: { __type: "instagram" }
          },
          {
            platform: "facebook",
            id: "postiz-facebook-channel-id",
            settings: { __type: "facebook" }
          }
        ]
      }),
    /placeholder Postiz integration id/i
  );

  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        ...postizInputs(),
        uploadedMedia: [
          {
            id: "replace-with-postiz-uploaded-media-id",
            path: "https://uploads.postiz.com/replace-with-uploaded-media-path.mp4"
          }
        ]
      }),
    /placeholder uploaded Postiz media/i
  );
});

test("rejects Postiz local inputs that contain API keys or tokens", () => {
  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        ...postizInputs(),
        integrations: [
          {
            platform: "instagram",
            id: "postiz-instagram-channel-id",
            settings: {
              __type: "instagram",
              post_type: "reel",
              apiKey: "postiz_live_secret_key_1234567890"
            }
          },
          {
            platform: "facebook",
            id: "postiz-facebook-channel-id",
            settings: { __type: "facebook" }
          }
        ]
      }),
    /Postiz local input secrets/i
  );

  assert.throws(
    () =>
      buildPostizDraftPackage({
        bundle: approvedBundle(),
        ...postizInputs(),
        uploadedMedia: [
          {
            id: "uploaded-media-id",
            path: "https://uploads.postiz.com/final-1.mp4",
            accessToken: "postiz_media_access_token_1234567890"
          }
        ]
      }),
    /Postiz local input secrets/i
  );
});

test("writes a dry-run package from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-draft-"));
  try {
    const input = path.join(tempDir, "approved-bundle.json");
    const output = path.join(tempDir, "postiz-draft.dry-run.json");
    await writeFile(input, `${JSON.stringify(approvedBundle(), null, 2)}\n`);

    const result = await buildPostizDraftPackageFromFiles({
      input,
      output,
      generatedAt: "2026-06-10T13:00:00.000Z",
      ...postizInputs()
    });

    assert.equal(result.output, output);
    const saved = JSON.parse(await readFile(output, "utf8"));
    assert.equal(saved.postizPayload.type, "draft");
    assert.equal(saved.dryRunOnly, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
