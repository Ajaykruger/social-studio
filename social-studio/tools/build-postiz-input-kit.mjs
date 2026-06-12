import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectPostizInputSecrets } from "../lib/postiz-input-safety.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isPlaceholder(value) {
  return /replace-with|placeholder|todo/i.test(String(value || ""));
}

function safeFileName(value) {
  const fileName = path.basename(String(value || ""));
  return fileName || "";
}

function preparedLocalFileNames(input = {}) {
  if (!input) return null;
  const integrations = safeFileName(input.integrations);
  const uploadedMedia = safeFileName(input.uploadedMedia);
  if (!integrations || !uploadedMedia) return null;
  return { integrations, uploadedMedia };
}

function preparedLocalFileNamesFromPaths({ integrationsPath, uploadedMediaPath }) {
  const files = preparedLocalFileNames({
    integrations: integrationsPath,
    uploadedMedia: uploadedMediaPath
  });
  if (
    files?.integrations === "integrations.local.json" &&
    files?.uploadedMedia === "uploaded-media.local.json"
  ) {
    return files;
  }
  return null;
}

function requiredPlatformsFromBundle(bundle) {
  return unique(bundle?.postizHandoff?.platforms || []);
}

function requiredMediaAssetsFromReviewBoard(reviewBoard) {
  const items = Array.isArray(reviewBoard?.items) ? reviewBoard.items : [];
  return items
    .filter((item) => item?.reviewAction === "review_decision_required")
    .map((item, index) => {
      const media = item.media || {};
      return {
        assetId: item.assetId || `${item.contentType || "asset"}-${index + 1}`,
        label: item.label || item.contentType || `Asset ${index + 1}`,
        contentType: item.contentType || "asset",
        mediaType: media.videoUrl ? "video" : "image",
        assetUrl: media.videoUrl || media.imageUrl || ""
      };
    })
    .filter((asset) => asset.assetUrl);
}

function requiredMediaAssetsFromBundle(bundle, reviewBoard) {
  const reviewAssets = Array.isArray(bundle?.postizHandoff?.reviewAssets)
    ? bundle.postizHandoff.reviewAssets
    : [];
  if (reviewAssets.length > 0) {
    return reviewAssets.map((asset, index) => ({
      assetId: asset.assetId || `${asset.contentType || "asset"}-${index + 1}`,
      label: asset.label || asset.contentType || `Asset ${index + 1}`,
      contentType: asset.contentType || "asset",
      mediaType: asset.mediaType || bundle?.postizHandoff?.media?.mediaType || "video",
      assetUrl: asset.assetUrl || ""
    }));
  }
  const boardAssets = requiredMediaAssetsFromReviewBoard(reviewBoard);
  if (boardAssets.length > 0) return boardAssets;
  return [
    {
      assetId: bundle?.assetId || "primary-asset",
      label: "Primary asset",
      contentType: "ugc_video",
      mediaType: bundle?.postizHandoff?.media?.mediaType || "video",
      assetUrl: ""
    }
  ];
}

function integrationIsReady(integration) {
  return Boolean(
    integration?.platform &&
      integration?.id &&
      !isPlaceholder(integration.id) &&
      integration?.settings?.__type &&
      !isPlaceholder(integration.settings.__type)
  );
}

function missingIntegrationFields(integration) {
  const missing = [];
  if (!integration?.id || isPlaceholder(integration.id)) missing.push("id");
  if (!integration?.settings?.__type || isPlaceholder(integration.settings.__type)) missing.push("settings.__type");
  return missing;
}

function mediaIsReady(media) {
  return Boolean(media?.id && media?.path && !isPlaceholder(media.id) && !isPlaceholder(media.path));
}

function missingMediaFields(media) {
  const missing = [];
  if (!media?.id || isPlaceholder(media.id)) missing.push("id");
  if (!media?.path || isPlaceholder(media.path)) missing.push("path");
  return missing;
}

function mediaForAsset(asset, uploadedMedia, requiredMediaAssets) {
  const mediaRecords = Array.isArray(uploadedMedia) ? uploadedMedia : [];
  if (requiredMediaAssets.length <= 1) return mediaRecords[0] || null;
  return (
    mediaRecords.find(
      (media) =>
        media.assetId === asset.assetId ||
        (media.contentType && media.contentType === asset.contentType)
    ) || null
  );
}

function uploadedMediaReadyCount(uploadedMedia, requiredMediaAssets) {
  const readyMedia = (Array.isArray(uploadedMedia) ? uploadedMedia : []).filter(mediaIsReady);
  if (requiredMediaAssets.length <= 1) return readyMedia.length;

  return requiredMediaAssets.filter((asset) =>
    readyMedia.some(
      (media) =>
        media.assetId === asset.assetId ||
        (media.contentType && media.contentType === asset.contentType)
    )
  ).length;
}

function mediaCheckIsReady(asset, uploadedMedia, requiredMediaAssets) {
  const readyMedia = (Array.isArray(uploadedMedia) ? uploadedMedia : []).filter(mediaIsReady);
  if (requiredMediaAssets.length <= 1) return readyMedia.length > 0;
  return readyMedia.some(
    (media) =>
      media.assetId === asset.assetId ||
      (media.contentType && media.contentType === asset.contentType)
  );
}

function makeOperatorPreflight({
  requiredPlatforms,
  readyPlatforms,
  integrationByPlatform,
  requiredMediaAssets,
  uploadedMedia,
  localFiles,
  status
}) {
  const integrationsFile = localFiles?.integrations || "integrations.local.json";
  const uploadedMediaFile = localFiles?.uploadedMedia || "uploaded-media.local.json";
  const integrationChecks = requiredPlatforms.map((platform) => {
    const missingFields = missingIntegrationFields(integrationByPlatform?.get(platform));
    return {
      platform,
      status: readyPlatforms.includes(platform) ? "ready" : "missing",
      localInputFile: integrationsFile,
      requiredFields: ["id", "settings.__type"],
      missingFields,
      valueShown: false
    };
  });
  const mediaChecks = requiredMediaAssets.map((asset) => {
    const media = mediaForAsset(asset, uploadedMedia, requiredMediaAssets);
    const missingFields = missingMediaFields(media);
    return {
      assetId: asset.assetId,
      label: asset.label,
      contentType: asset.contentType,
      mediaType: asset.mediaType,
      sourceAssetUrl: asset.assetUrl,
      sourceInstruction: "Upload the reviewed source asset to Postiz, then paste the returned media id and path.",
      status: mediaCheckIsReady(asset, uploadedMedia, requiredMediaAssets) ? "ready" : "missing",
      localInputFile: uploadedMediaFile,
      requiredFields: ["id", "path"],
      missingFields,
      valueShown: false
    };
  });
  const missingChecks = [...integrationChecks, ...mediaChecks].filter((check) => check.status !== "ready").length;

  return {
    status: status === "ready" && missingChecks === 0 ? "ready" : status,
    missingChecks,
    valueShown: false,
    integrationChecks,
    mediaChecks
  };
}

function makeOperatorEditPlan(operatorPreflight) {
  const integrationRecords = (operatorPreflight.integrationChecks || [])
    .filter((check) => check.status !== "ready")
    .map((check) => ({
      key: check.platform,
      label: check.platform,
      status: check.status,
      requiredFields: check.requiredFields,
      missingFields: check.missingFields,
      valueShown: false
    }));
  const mediaRecords = (operatorPreflight.mediaChecks || [])
    .filter((check) => check.status !== "ready")
    .map((check) => ({
      key: check.assetId,
      label: check.label,
      contentType: check.contentType,
      mediaType: check.mediaType,
      sourceAssetUrl: check.sourceAssetUrl,
      sourceInstruction: check.sourceInstruction,
      status: check.status,
      requiredFields: check.requiredFields,
      missingFields: check.missingFields,
      valueShown: false
    }));

  return {
    valueShown: false,
    forbiddenFields: [
      "Do not add API keys, access tokens, refresh tokens, cookies, passwords, or secrets.",
      "Do not add scheduling or publishing fields.",
      "Do not remove assetId or contentType from uploaded media records."
    ],
    files: [
      {
        id: "postiz_integrations",
        file: operatorPreflight.integrationChecks?.[0]?.localInputFile || "integrations.local.json",
        purpose: "Fill one real Postiz channel integration record per required platform.",
        allowedFields: ["platform", "id", "settings.__type"],
        records: integrationRecords
      },
      {
        id: "postiz_uploaded_media",
        file: operatorPreflight.mediaChecks?.[0]?.localInputFile || "uploaded-media.local.json",
        purpose: "Fill one real uploaded media reference per approved review asset.",
        allowedFields: ["assetId", "contentType", "id", "path"],
        records: mediaRecords
      }
    ]
  };
}

function templateIntegration(platform, sourceIntegration = {}) {
  return {
    platform,
    id: `TODO_POSTIZ_${platform.toUpperCase()}_INTEGRATION_ID`,
    settings: {
      ...(sourceIntegration.settings || { __type: platform })
    }
  };
}

function templateMedia(bundle, reviewBoard) {
  return requiredMediaAssetsFromBundle(bundle, reviewBoard).map((asset) => ({
    assetId: asset.assetId,
    contentType: asset.contentType,
    label: asset.label,
    id: `TODO_POSTIZ_${asset.contentType.toUpperCase()}_UPLOADED_MEDIA_ID`,
    path:
      asset.mediaType === "video"
        ? `TODO_POSTIZ_${asset.contentType.toUpperCase()}_UPLOADED_MEDIA_MP4_PATH`
        : `TODO_POSTIZ_${asset.contentType.toUpperCase()}_UPLOADED_MEDIA_PATH`
  }));
}

function makeMarkdown(kit) {
  const lines = [
    "# Postiz Input Kit",
    "",
    `Generated: ${kit.generatedAt}`,
    `Campaign: ${kit.campaignId}`,
    `Status: ${kit.status}`,
    "",
    "## Safety",
    "",
    `- Network calls allowed: ${kit.networkCallsAllowed ? "yes" : "no"}`,
    `- Secrets shown in UI: ${kit.secretsInUi ? "yes" : "no"}`,
    `- Secret-like fields found: ${kit.validation.secretFieldCount}`,
    "",
    "## Files",
    "",
    `- Integrations template: ${kit.files.integrationsTemplate}`,
    `- Uploaded media template: ${kit.files.uploadedMediaTemplate}`,
    ...(kit.files.integrationsLocal && kit.files.uploadedMediaLocal
      ? [
          `- Integrations local file: ${kit.files.integrationsLocal}`,
          `- Uploaded media local file: ${kit.files.uploadedMediaLocal}`
        ]
      : []),
    "",
    "## Validation",
    "",
    `- Required platforms: ${kit.summary.requiredPlatforms}`,
    `- Ready integrations: ${kit.summary.readyIntegrations}`,
    `- Uploaded media ready: ${kit.summary.uploadedMediaReady}`,
    "",
    "## Upload Targets",
    ""
  ];

  for (const asset of kit.validation.requiredMediaAssets) {
    lines.push(
      `- ${asset.label}: upload ${asset.mediaType}, then fill ${asset.localInputFile} fields ${asset.requiredFields.join(", ")}.`
    );
  }

  lines.push("", "## Operator Preflight", "");

  for (const check of kit.operatorPreflight.integrationChecks) {
    lines.push(
      `- ${check.platform}: ${check.status}. File: ${check.localInputFile}. Missing fields: ${check.missingFields.join(", ") || "none"}. Fields: ${check.requiredFields.join(", ")}.`
    );
  }

  for (const check of kit.operatorPreflight.mediaChecks) {
    lines.push(
      `- ${check.label}: ${check.status}. File: ${check.localInputFile}. Missing fields: ${check.missingFields.join(", ") || "none"}. Fields: ${check.requiredFields.join(", ")}.`
    );
  }

  lines.push("", "## Operator Edit Plan", "");

  for (const file of kit.operatorEditPlan.files) {
    lines.push(`- ${file.file}: ${file.purpose}`);
    lines.push(`  - Allowed fields: ${file.allowedFields.join(", ")}`);
    for (const record of file.records) {
      lines.push(
        `  - ${record.label}: ${record.status}. Missing fields: ${record.missingFields.join(", ") || "none"}. Fields: ${record.requiredFields.join(", ")}.`
      );
      if (record.sourceAssetUrl) {
        lines.push(`    - Source asset: ${record.sourceAssetUrl}`);
      }
      if (record.sourceInstruction) {
        lines.push(`    - Source instruction: ${record.sourceInstruction}`);
      }
    }
  }

  lines.push(
    "",
    "## Next Action",
    "",
    `- ${kit.nextAction}`,
    ""
  );
  return `${lines.join("\n")}\n`;
}

function makeUiRequiredMediaAssets(requiredMediaAssets) {
  return requiredMediaAssets.map((asset) => ({
    assetId: asset.assetId,
    label: asset.label,
    contentType: asset.contentType,
    mediaType: asset.mediaType,
    assetUrl: asset.assetUrl,
    localInputFile: "uploaded-media.local.json",
    requiredFields: ["id", "path"]
  }));
}

function makeUiSummary(kit) {
  return {
    campaignId: kit.campaignId,
    status: kit.status,
    networkCallsAllowed: kit.networkCallsAllowed,
    secretsInUi: kit.secretsInUi,
    summary: kit.summary,
    validation: {
      missingPlatforms: kit.validation.missingPlatforms,
      requiredMediaAssets: kit.validation.requiredMediaAssets,
      uploadedMediaReady: kit.validation.uploadedMediaReady,
      integrationsReady: kit.validation.integrationsReady,
      inputSecretsReady: kit.validation.inputSecretsReady,
      secretFieldCount: kit.validation.secretFieldCount,
      secretFields: kit.validation.secretFields
    },
    operatorPreflight: kit.operatorPreflight,
    operatorEditPlan: kit.operatorEditPlan,
    files: {
      integrationsTemplate: kit.files.integrationsTemplate,
      uploadedMediaTemplate: kit.files.uploadedMediaTemplate,
      ...(kit.files.integrationsLocal && kit.files.uploadedMediaLocal
        ? {
            integrationsLocal: kit.files.integrationsLocal,
            uploadedMediaLocal: kit.files.uploadedMediaLocal
          }
        : {})
    },
    nextAction: kit.nextAction
  };
}

export function buildPostizInputKit({
  bundle,
  reviewBoard,
  integrations,
  uploadedMedia,
  preparedLocalFiles,
  generatedAt = new Date().toISOString()
}) {
  const requiredPlatforms = requiredPlatformsFromBundle(bundle);
  const requiredMediaAssets = requiredMediaAssetsFromBundle(bundle, reviewBoard);
  const localFiles = preparedLocalFileNames(preparedLocalFiles);
  const integrationByPlatform = new Map(
    (Array.isArray(integrations) ? integrations : []).map((integration) => [integration.platform, integration])
  );
  const readyPlatforms = requiredPlatforms.filter((platform) => integrationIsReady(integrationByPlatform.get(platform)));
  const missingPlatforms = requiredPlatforms.filter((platform) => !readyPlatforms.includes(platform));
  const uploadedMediaReady = uploadedMediaReadyCount(uploadedMedia, requiredMediaAssets);
  const secretFindings = detectPostizInputSecrets({ integrations, uploadedMedia });
  const inputSecretsReady = secretFindings.length === 0;
  const status = !inputSecretsReady
    ? "blocked_by_input_secrets"
    : missingPlatforms.length === 0 && uploadedMediaReady >= requiredMediaAssets.length
      ? "ready"
      : "needs_real_values";
  const nextAction =
    status === "blocked_by_input_secrets"
      ? "Remove API keys, tokens, and secrets from local Postiz input files; keep only integration IDs and uploaded media references."
      : status === "ready"
      ? "Run the Postiz dry-run readiness refresh with the real local input files."
      : localFiles
      ? `Edit ${localFiles.integrations} and ${localFiles.uploadedMedia} with real local Postiz IDs and uploaded media values, then refresh readiness.`
      : "Copy the template files, paste real local Postiz IDs and uploaded media values, then refresh readiness.";
  const operatorPreflight = makeOperatorPreflight({
    requiredPlatforms,
    readyPlatforms,
    integrationByPlatform,
    requiredMediaAssets,
    uploadedMedia,
    localFiles,
    status
  });
  const operatorEditPlan = makeOperatorEditPlan(operatorPreflight);

  const kit = {
    packageType: "social_studio_postiz_input_kit",
    generatedAt,
    campaignId: bundle?.campaignId || "",
    status,
    networkCallsAllowed: false,
    secretsInUi: false,
    summary: {
      requiredPlatforms: requiredPlatforms.length,
      readyIntegrations: readyPlatforms.length,
      requiredMediaAssets: requiredMediaAssets.length,
      uploadedMediaReady
    },
    validation: {
      requiredPlatforms,
      requiredMediaAssets: makeUiRequiredMediaAssets(requiredMediaAssets),
      readyPlatforms,
      missingPlatforms,
      integrationsReady: missingPlatforms.length === 0,
      uploadedMediaReady: uploadedMediaReady >= requiredMediaAssets.length,
      inputSecretsReady,
      secretFieldCount: secretFindings.length,
      secretFields: secretFindings.map((finding) => finding.path)
    },
    operatorPreflight,
    operatorEditPlan,
    files: {
      integrationsTemplate: "integrations.local.template.json",
      uploadedMediaTemplate: "uploaded-media.local.template.json",
      ...(localFiles
        ? {
            integrationsLocal: localFiles.integrations,
            uploadedMediaLocal: localFiles.uploadedMedia
          }
        : {})
    },
    nextAction,
    templates: {
      integrations: requiredPlatforms.map((platform) =>
        templateIntegration(platform, integrationByPlatform.get(platform))
      ),
      uploadedMedia: templateMedia(bundle, reviewBoard)
    }
  };

  kit.uiSummary = makeUiSummary(kit);
  kit.markdown = makeMarkdown(kit);
  return kit;
}

export async function buildPostizInputKitFromFiles({
  bundlePath,
  reviewBoardPath = "",
  integrationsPath,
  uploadedMediaPath,
  outDir,
  generatedAt
}) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const reviewBoard = reviewBoardPath
    ? JSON.parse(await readFile(reviewBoardPath, "utf8"))
    : null;
  const integrations = JSON.parse(await readFile(integrationsPath, "utf8"));
  const uploadedMedia = JSON.parse(await readFile(uploadedMediaPath, "utf8"));
  const kit = buildPostizInputKit({
    bundle,
    reviewBoard,
    integrations,
    uploadedMedia,
    preparedLocalFiles: preparedLocalFileNamesFromPaths({ integrationsPath, uploadedMediaPath }),
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "postiz-input-kit.json");
  const uiPath = path.join(outDir, "postiz-input-kit.ui.json");
  const markdownPath = path.join(outDir, "postiz-input-kit.md");
  const integrationsTemplatePath = path.join(outDir, kit.files.integrationsTemplate);
  const uploadedMediaTemplatePath = path.join(outDir, kit.files.uploadedMediaTemplate);

  await writeFile(jsonPath, `${JSON.stringify(kit, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(kit.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, kit.markdown);
  await writeFile(integrationsTemplatePath, `${JSON.stringify(kit.templates.integrations, null, 2)}\n`);
  await writeFile(uploadedMediaTemplatePath, `${JSON.stringify(kit.templates.uploadedMedia, null, 2)}\n`);

  return {
    status: kit.status,
    jsonPath,
    uiPath,
    markdownPath,
    integrationsTemplatePath,
    uploadedMediaTemplatePath
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildPostizInputKitFromFiles({
    bundlePath: readArg("bundle", path.join(generatedDir, "draft-bundle.json")),
    reviewBoardPath: readArg("review-board", ""),
    integrationsPath: readArg("integrations", path.join(studioRoot, "handoff", "postiz", "api-draft", "integrations.example.json")),
    uploadedMediaPath: readArg("uploaded-media", path.join(studioRoot, "handoff", "postiz", "api-draft", "uploaded-media.example.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "postiz-input-kit"))
  });

  console.log(`status=${result.status}`);
  console.log(`json=${result.jsonPath}`);
  console.log(`ui=${result.uiPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
