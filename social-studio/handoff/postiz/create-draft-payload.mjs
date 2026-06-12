import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoPostizInputSecrets } from "../../lib/postiz-input-safety.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_API_BASE_URL = "http://localhost:4007/api/public/v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireText(value, label) {
  const clean = String(value || "").trim();
  if (!clean) {
    throw new Error(`${label} is required`);
  }
  return clean;
}

function isPlaceholder(value) {
  return /replace-with|placeholder/i.test(String(value || ""));
}

function normalizeLocalApiBase(apiBaseUrl = DEFAULT_API_BASE_URL) {
  const clean = requireText(apiBaseUrl, "Postiz API base URL").replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error("Postiz API base URL must be a valid URL");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error("dry-run connector requires a local Postiz API base URL");
  }
  return clean;
}

function assertApprovedBundle(bundle) {
  const reviewStatus = bundle?.reviewStatus || {};
  const handoff = bundle?.postizHandoff || {};
  const review = handoff.review || {};
  const approval = reviewStatus.approval || {};
  const approvalScope = approval.scope || {};
  const evidenceSummary = approval.evidenceSummary || {};

  if (reviewStatus.status !== "approved" || handoff.status !== "draft_upload_ready") {
    throw new Error("an approved bundle is required before creating a Postiz draft payload");
  }
  if (review.approvedBy === "pending-human-review") {
    throw new Error("an approved bundle must name a real human reviewer");
  }
  requireText(review.approvedBy, "human approval reviewer");
  requireText(review.approvedAt, "human approval timestamp");
  if (review.notLiveConfirmed !== true) {
    throw new Error("approved bundle must confirm the content is not live");
  }
  if (String(handoff.scheduledFor || "").trim()) {
    throw new Error("Postiz draft payload does not accept scheduledFor; create drafts only in this connector");
  }
  if (
    approvalScope.approvedFor !== "postiz_draft_upload_only" ||
    approvalScope.allowsSchedulingOrPublishing !== false
  ) {
    throw new Error("approved bundle must be scoped to Postiz draft upload only");
  }
  if (evidenceSummary.status !== "covered") {
    throw new Error("approved bundle must include covered approval evidence summary");
  }

  const checks = reviewStatus.checks || {};
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failedChecks.length) {
    throw new Error(`approved bundle still has failed checks: ${failedChecks.join(", ")}`);
  }

  requireText(handoff.caption, "Postiz caption");
  if (!Array.isArray(handoff.platforms) || handoff.platforms.length === 0) {
    throw new Error("Postiz platforms are required");
  }
  return handoff;
}

function normalizeUploadedMedia(uploadedMedia) {
  if (!Array.isArray(uploadedMedia) || uploadedMedia.length === 0) {
    throw new Error("uploaded Postiz media references are required before creating a posts payload");
  }

  return uploadedMedia.map((media, index) => {
    const id = requireText(media?.id, `uploaded Postiz media ${index + 1} id`);
    const mediaPath = requireText(media?.path, `uploaded Postiz media ${index + 1} path`);
    if (isPlaceholder(id) || isPlaceholder(mediaPath)) {
      throw new Error("placeholder uploaded Postiz media reference is not allowed");
    }
    return {
      id,
      path: mediaPath,
      assetId: String(media?.assetId || "").trim(),
      contentType: String(media?.contentType || "").trim()
    };
  });
}

function normalizeApprovedAssets(bundle, handoff) {
  const reviewAssets = Array.isArray(handoff.reviewAssets) ? handoff.reviewAssets : [];
  if (reviewAssets.length > 0) {
    return reviewAssets.map((asset, index) => ({
      assetId: requireText(asset.assetId || `${bundle.assetId}-${index + 1}`, `approved asset ${index + 1} id`),
      label: String(asset.label || asset.contentType || `Asset ${index + 1}`).trim(),
      contentType: requireText(asset.contentType, `approved asset ${index + 1} content type`),
      mediaType: requireText(asset.mediaType || handoff.media?.mediaType, `approved asset ${index + 1} media type`),
      localPath: String(asset.localPath || "").trim(),
      assetUrl: String(asset.assetUrl || "").trim()
    }));
  }

  return [
    {
      assetId: bundle.assetId,
      label: "Primary asset",
      contentType: "ugc_video",
      mediaType: handoff.media?.mediaType || "video",
      localPath: handoff.media?.localPath || "",
      assetUrl: ""
    }
  ];
}

function mediaForAsset(mediaRefs, asset, approvedAssets) {
  if (approvedAssets.length === 1) {
    return mediaRefs;
  }

  const matches = mediaRefs.filter(
    (media) =>
      media.assetId === asset.assetId ||
      (media.contentType && media.contentType === asset.contentType)
  );
  if (matches.length === 0) {
    throw new Error(`uploaded Postiz media is required for every approved asset; missing ${asset.contentType}`);
  }
  return matches;
}

function integrationForPlatform(integrations, platform) {
  return integrations.find((integration) => integration.platform === platform);
}

function normalizeIntegrations(integrations, platforms) {
  if (!Array.isArray(integrations) || integrations.length === 0) {
    throw new Error("Postiz integration mapping is required");
  }

  return platforms.map((platform) => {
    const integration = integrationForPlatform(integrations, platform);
    if (!integration) {
      throw new Error(`missing Postiz integration for platform ${platform}`);
    }

    const settings = integration.settings || {};
    const integrationId = requireText(integration.id, `Postiz integration id for ${platform}`);
    if (isPlaceholder(integrationId)) {
      throw new Error(`placeholder Postiz integration id is not allowed for ${platform}`);
    }
    requireText(settings.__type, `Postiz settings.__type for ${platform}`);

    return {
      platform,
      id: integrationId,
      settings: clone(settings)
    };
  });
}

function contentForPost(handoff) {
  const hashtags = Array.isArray(handoff.hashtags) ? handoff.hashtags.join(" ").trim() : "";
  return [handoff.caption.trim(), hashtags].filter(Boolean).join("\n\n");
}

export function buildPostizDraftPackage({
  bundle,
  integrations,
  uploadedMedia,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  generatedAt = new Date().toISOString()
}) {
  const safeApiBaseUrl = normalizeLocalApiBase(apiBaseUrl);
  const handoff = assertApprovedBundle(bundle);
  assertNoPostizInputSecrets({ integrations, uploadedMedia });
  const mediaRefs = normalizeUploadedMedia(uploadedMedia);
  const integrationRefs = normalizeIntegrations(integrations, handoff.platforms);
  const approvedAssets = normalizeApprovedAssets(bundle, handoff);
  const content = contentForPost(handoff);

  const posts = integrationRefs.map((integration) => ({
    integration: {
      id: integration.id
    },
    value: approvedAssets.map((asset) => ({
        asset: {
          assetId: asset.assetId,
          label: asset.label,
          contentType: asset.contentType,
          mediaType: asset.mediaType
        },
        content,
        image: clone(mediaForAsset(mediaRefs, asset, approvedAssets))
      })),
    settings: integration.settings
  }));

  const uploadEndpoint = `${safeApiBaseUrl}/upload`;
  const postsEndpoint = `${safeApiBaseUrl}/posts`;

  return {
    packageType: "postiz_api_draft_dry_run",
    generatedAt,
    campaignId: bundle.campaignId,
    assetId: bundle.assetId,
    approvedAssets: approvedAssets.map((asset) => ({
      assetId: asset.assetId,
      label: asset.label,
      contentType: asset.contentType,
      mediaType: asset.mediaType
    })),
    dryRunOnly: true,
    transport: {
      apiBaseUrl: safeApiBaseUrl,
      networkCallsAllowed: false,
      reason: "Dry-run package only. Do not call Postiz from this connector."
    },
    uploadPlan: {
      method: "POST",
      endpoint: uploadEndpoint,
      contentType: "multipart/form-data",
      localFile: handoff.media?.localPath || "",
      thumbnailFile: handoff.media?.thumbnailPath || "",
      assets: approvedAssets.map((asset) => ({
        assetId: asset.assetId,
        label: asset.label,
        contentType: asset.contentType,
        mediaType: asset.mediaType,
        localFile: asset.localPath,
        assetUrl: asset.assetUrl
      })),
      note: "Upload media in Postiz first, then use the returned id/path as uploadedMedia."
    },
    postizRequest: {
      method: "POST",
      url: postsEndpoint,
      headers: {
        Authorization: "<POSTIZ_API_KEY>",
        "Content-Type": "application/json"
      }
    },
    postizPayload: {
      type: "draft",
      shortLink: false,
      tags: [],
      posts
    },
    safety: {
      reviewStatus: bundle.reviewStatus.status,
      postizStatus: handoff.status,
      approvedBy: handoff.review.approvedBy,
      approvedAt: handoff.review.approvedAt,
      notLiveConfirmed: handoff.review.notLiveConfirmed,
      scheduledFor: handoff.scheduledFor || "",
      allowsSchedulingOrPublishing: false
    },
    approvalProof: {
      scope: clone(bundle.reviewStatus.approval.scope),
      evidenceSummary: clone(bundle.reviewStatus.approval.evidenceSummary)
    }
  };
}

export async function buildPostizDraftPackageFromFiles({
  input,
  output,
  integrations,
  uploadedMedia,
  apiBaseUrl,
  generatedAt
}) {
  const bundle = JSON.parse(await readFile(input, "utf8"));
  const result = buildPostizDraftPackage({
    bundle,
    integrations,
    uploadedMedia,
    apiBaseUrl,
    generatedAt
  });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  return { output, packageType: result.packageType };
}

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function readJsonArg(name) {
  const filePath = readArg(name);
  if (!filePath) {
    throw new Error(`--${name}=<json-file> is required`);
  }
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const input = readArg(
    "input",
    path.join(studioRoot, "generated", "cc-rubber-base-demo-2026-06-10", "approved-bundle.json")
  );
  const output = readArg(
    "output",
    path.join(studioRoot, "generated", "cc-rubber-base-demo-2026-06-10", "postiz-draft.dry-run.json")
  );
  const result = await buildPostizDraftPackageFromFiles({
    input,
    output,
    integrations: await readJsonArg("integrations"),
    uploadedMedia: await readJsonArg("uploaded-media"),
    apiBaseUrl: readArg("api-base-url", DEFAULT_API_BASE_URL)
  });

  console.log(`output=${result.output}`);
  console.log(`package_type=${result.packageType}`);
  console.log("dry_run_only=true");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
