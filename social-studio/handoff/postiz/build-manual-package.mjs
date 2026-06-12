import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..", "..");
const defaultWorkspaceRoot = path.resolve(studioRoot, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

export function assertManualDraftHandoff(bundle) {
  const handoff = bundle?.postizHandoff;
  if (!handoff) {
    throw new Error("bundle is missing postizHandoff");
  }
  if (handoff.handoffMode !== "manual_upload") {
    throw new Error("manual package requires handoffMode manual_upload");
  }
  if (!["needs_review", "draft_upload_ready"].includes(handoff.status)) {
    throw new Error("manual package requires needs_review or draft_upload_ready status");
  }
  if (handoff.review?.notLiveConfirmed !== true) {
    throw new Error("manual package requires notLiveConfirmed true");
  }
  if (handoff.status === "needs_review") {
    if (handoff.review?.approvedBy !== "pending-human-review") {
      throw new Error("manual preview package must remain pending human review");
    }
    return true;
  }
  const approvedBy = String(handoff.review?.approvedBy || "").trim();
  const approvedAt = String(handoff.review?.approvedAt || "").trim();
  const approvalEvidence = String(bundle.reviewStatus?.approval?.approvalEvidence || "").trim();
  if (!approvedBy || approvedBy === "pending-human-review" || !approvedAt || !approvalEvidence) {
    throw new Error("draft_upload_ready manual package requires real approval evidence");
  }
  return true;
}

function formatHashtags(hashtags = []) {
  return hashtags.join(" ").trim();
}

function fileNameFromPath(value, fallback) {
  return path.basename(value || fallback);
}

function localPathFromPublicUrl(publicUrl, workspaceRoot) {
  const clean = String(publicUrl || "").trim();
  if (!clean.startsWith("/")) return "";
  return path.join(workspaceRoot, "public", clean.slice(1).replace(/\//g, path.sep));
}

function resolveWorkspacePath(value, workspaceRoot) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (path.isAbsolute(clean)) return clean;
  return path.join(workspaceRoot, clean.replace(/\//g, path.sep));
}

function normalizeReviewAssets(bundle, workspaceRoot) {
  const handoff = bundle.postizHandoff;
  const reviewAssets = Array.isArray(handoff.reviewAssets) ? handoff.reviewAssets : [];
  if (reviewAssets.length > 0) {
    return reviewAssets.map((asset, index) => {
      const localPath =
        asset.localPath || localPathFromPublicUrl(asset.assetUrl, workspaceRoot);
      return {
        assetId: asset.assetId || `${bundle.assetId || "asset"}-${index + 1}`,
        label: asset.label || asset.contentType || `Asset ${index + 1}`,
        contentType: asset.contentType || "asset",
        mediaType: asset.mediaType || handoff.media?.mediaType || "video",
        localPath,
        assetUrl: asset.assetUrl || "",
        supportingAssets: Array.isArray(asset.supportingAssets) ? asset.supportingAssets : []
      };
    });
  }

  return [
    {
      assetId: bundle.assetId,
      label: "Primary asset",
      contentType: "ugc_video",
      mediaType: handoff.media.mediaType,
      localPath: handoff.media.localPath,
      assetUrl: "",
      supportingAssets: []
    }
  ];
}

async function copyAssetToPackage(asset, outDir, index, workspaceRoot) {
  const sourcePath =
    resolveWorkspacePath(asset.localPath, workspaceRoot) ||
    localPathFromPublicUrl(asset.assetUrl, workspaceRoot);
  const fallback = `${String(index + 1).padStart(2, "0")}-${asset.contentType}.${asset.mediaType === "image" ? "svg" : "mp4"}`;
  const fileName = fileNameFromPath(sourcePath, fallback);
  const packagePath = path.join(outDir, "media", fileName);
  await copyFile(sourcePath, packagePath);

  return {
    assetId: asset.assetId,
    label: asset.label,
    contentType: asset.contentType,
    mediaType: asset.mediaType,
    assetUrl: asset.assetUrl,
    mediaFile: `media/${fileName}`,
    supportingAssets: asset.supportingAssets
  };
}

function assetChecklistLines(packageAssets) {
  return packageAssets.map(
    (asset) => `- [ ] ${asset.label} (${asset.contentType}): ${asset.mediaFile}`
  );
}

function approvalSummaryLine(bundle) {
  const summary = bundle.reviewStatus?.approval?.evidenceSummary?.summary || {};
  const covered = Number(summary.coveredGates || 0);
  const total = Number(summary.totalGates || 0);
  return total > 0 ? `- Evidence gates: ${covered}/${total} covered` : "";
}

function reviewChecklist({ isApproved, handoff, bundle, packageAssets }) {
  const assetLines = assetChecklistLines(packageAssets);
  const approvalScope = bundle.reviewStatus?.approval?.scope || {};
  const evidenceSummaryLine = approvalSummaryLine(bundle);
  if (isApproved) {
    return [
      "# Approved Manual Postiz Draft Package",
      "",
      "This package has human approval for manual Postiz draft upload.",
      "",
      "## Assets",
      "",
      ...assetLines,
      "",
      "## Guardrails",
      "",
      "- [ ] Upload each approved media file listed above to Postiz as draft media.",
      "- [ ] Copy the caption and hashtags.",
      "- [ ] Use only the approved platforms.",
      "- [ ] Keep it as a draft in Postiz unless final scheduling is separately approved.",
      "- [ ] Do not publish from this package.",
      "- [ ] Record proof that nothing has gone live.",
      "",
      "## Approval",
      "",
      `- Reviewer: ${handoff.review.approvedBy}`,
      `- Approved at: ${handoff.review.approvedAt}`,
      `- Evidence: ${bundle.reviewStatus?.approval?.approvalEvidence || ""}`,
      evidenceSummaryLine,
      approvalScope.approvedFor === "postiz_draft_upload_only"
        ? "- Approval scope: Postiz draft upload only"
        : ""
    ].filter(Boolean).join("\n");
  }

  return [
    "# Manual Postiz Draft Review",
    "",
    "Do not upload to Postiz until a human reviewer has checked this package.",
    "",
    "## Assets To Review",
    "",
    ...assetLines,
    "",
    "## Checks",
    "",
    "- [ ] Product is visible across the listed assets.",
    "- [ ] Caption is acceptable.",
    "- [ ] Claims are product-page or human-approved.",
    "- [ ] CTA is correct.",
    "- [ ] Platform list is correct.",
    "- [ ] Nothing has been posted live.",
    "",
    "## Decision",
    "",
    "- Reviewer:",
    "- Decision: needs_review",
    "- Notes:"
  ].join("\n");
}

export async function buildManualPostizPackage({
  bundle,
  outDir,
  workspaceRoot = defaultWorkspaceRoot
}) {
  assertManualDraftHandoff(bundle);

  const handoff = bundle.postizHandoff;
  const isApproved = handoff.status === "draft_upload_ready";
  const packageType = isApproved
    ? "postiz_manual_draft_ready"
    : "postiz_manual_upload_preview";
  const mediaPath = resolveWorkspacePath(handoff.media.localPath, workspaceRoot);
  const thumbnailPath = resolveWorkspacePath(handoff.media.thumbnailPath, workspaceRoot);
  const mediaName = fileNameFromPath(mediaPath, "draft-video.mp4");
  const thumbName = fileNameFromPath(thumbnailPath, "thumbnail.jpg");

  await mkdir(path.join(outDir, "media"), { recursive: true });
  await copyFile(mediaPath, path.join(outDir, "media", mediaName));
  if (thumbnailPath) {
    await copyFile(thumbnailPath, path.join(outDir, "media", thumbName));
  }
  const reviewAssets = normalizeReviewAssets(bundle, workspaceRoot);
  const packageAssets = [];
  for (const [index, asset] of reviewAssets.entries()) {
    packageAssets.push(await copyAssetToPackage(asset, outDir, index, workspaceRoot));
  }

  const manifest = {
    campaignId: bundle.campaignId,
    assetId: bundle.assetId,
    packageType,
    postiz: {
      handoffMode: handoff.handoffMode,
      status: handoff.status,
      platforms: handoff.platforms,
      scheduledFor: handoff.scheduledFor || ""
    },
    media: {
      videoFile: `media/${mediaName}`,
      thumbnailFile: thumbnailPath ? `media/${thumbName}` : "",
      mediaType: handoff.media.mediaType,
      aspectRatio: handoff.media.aspectRatio
    },
    assets: packageAssets,
    caption: handoff.caption,
    hashtags: handoff.hashtags,
    review: {
      approvedBy: handoff.review.approvedBy,
      approvedAt: handoff.review.approvedAt,
      notLiveConfirmed: handoff.review.notLiveConfirmed,
      notes: handoff.review.notes,
      approvalEvidenceSummary: bundle.reviewStatus?.approval?.evidenceSummary || null,
      approvalScope: bundle.reviewStatus?.approval?.scope || null
    }
  };

  await writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  await writeFile(path.join(outDir, "caption.txt"), `${handoff.caption}\n`);
  await writeFile(path.join(outDir, "hashtags.txt"), `${formatHashtags(handoff.hashtags)}\n`);
  await writeFile(
    path.join(outDir, "review-checklist.md"),
    reviewChecklist({ isApproved, handoff, bundle, packageAssets })
  );

  return {
    packageDir: outDir,
    status: handoff.status,
    packageType,
    mediaFile: path.join(outDir, "media", mediaName),
    mediaFiles: packageAssets.map((asset) => path.join(outDir, asset.mediaFile))
  };
}

async function main() {
  const bundlePath = readArg(
    "bundle",
    path.join(studioRoot, "generated", "cc-rubber-base-demo-2026-06-10", "draft-bundle.json")
  );
  const outDir = readArg(
    "out-dir",
    path.join(studioRoot, "handoff", "postiz", "manual", "cc-rubber-base-demo-2026-06-10")
  );

  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const result = await buildManualPostizPackage({ bundle, outDir });
  console.log(`package=${result.packageDir}`);
  console.log(`status=${result.status}`);
  console.log(`media=${result.mediaFile}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
