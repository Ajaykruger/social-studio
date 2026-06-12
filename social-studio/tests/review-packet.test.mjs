import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildReviewPacket,
  buildReviewPacketFromFiles
} from "../tools/build-review-packet.mjs";

function pendingBundle(baseDir) {
  return {
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    reviewStatus: {
      status: "needs_review",
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
      handoffMode: "manual_upload",
      platforms: ["instagram", "facebook", "tiktok"],
      media: {
        localPath: path.join(baseDir, "final-1.mp4"),
        thumbnailPath: path.join(baseDir, "thumb.jpg"),
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

async function writeSourceFiles(baseDir) {
  const mediaPath = path.join(baseDir, "final-1.mp4");
  const thumbPath = path.join(baseDir, "thumb.jpg");
  const contactSheetPath = path.join(baseDir, "contact_sheet.jpg");
  const visualReviewPath = path.join(baseDir, "visual-review.md");
  await writeFile(mediaPath, "fake video");
  await writeFile(thumbPath, "fake thumb");
  await writeFile(contactSheetPath, "fake contact sheet");
  await writeFile(
    visualReviewPath,
    [
      "Product visible. Still needs human review.",
      `Reviewed file: ${mediaPath}`,
      mediaPath,
      `Contact sheet: ${contactSheetPath}`,
      contactSheetPath
    ].join("\n")
  );
  return { mediaPath, thumbPath, contactSheetPath, visualReviewPath };
}

test("builds a review packet with public URLs and no local path leakage in UI JSON", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-packet-"));
  try {
    const sources = await writeSourceFiles(tempDir);
    const bundle = pendingBundle(tempDir);
    const result = await buildReviewPacket({
      bundle,
      contactSheetPath: sources.contactSheetPath,
      visualReviewPath: sources.visualReviewPath,
      outDir: path.join(tempDir, "packet"),
      publicOutDir: path.join(tempDir, "public"),
      publicUrlBase: "/social-studio/current-review",
      generatedAt: "2026-06-10T14:00:00.000Z"
    });

    assert.equal(result.packet.status, "needs_review");
    assert.equal(result.packet.review.decisionRequired, true);
    assert.equal(result.packet.safety.notLiveConfirmed, true);
    assert.equal(result.uiSummary.videoUrl, "/social-studio/current-review/final-1.mp4");
    assert.equal(result.uiSummary.contactSheetUrl, "/social-studio/current-review/contact-sheet.jpg");
    assert.equal(JSON.stringify(result.uiSummary).includes(tempDir), false);
    assert.equal(JSON.stringify(result.uiSummary).includes("C:\\"), false);
    assert.equal(result.uiSummary.visualReviewSummary.includes(tempDir), false);
    assert.equal(result.uiSummary.visualReviewSummary.includes("[local file]"), false);

    const copiedVideo = await stat(path.join(tempDir, "public", "final-1.mp4"));
    const copiedContactSheet = await stat(path.join(tempDir, "public", "contact-sheet.jpg"));
    assert.equal(copiedVideo.size > 0, true);
    assert.equal(copiedContactSheet.size > 0, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects packets when not-live proof is missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-packet-"));
  try {
    const sources = await writeSourceFiles(tempDir);
    const bundle = pendingBundle(tempDir);
    bundle.postizHandoff.review.notLiveConfirmed = false;

    await assert.rejects(
      () =>
        buildReviewPacket({
          bundle,
          contactSheetPath: sources.contactSheetPath,
          publicOutDir: path.join(tempDir, "public")
        }),
      /notLiveConfirmed/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects packets when required review media is missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-packet-"));
  try {
    const bundle = pendingBundle(tempDir);

    await assert.rejects(
      () =>
        buildReviewPacket({
          bundle,
          contactSheetPath: path.join(tempDir, "missing-contact.jpg"),
          publicOutDir: path.join(tempDir, "public")
        }),
      /review media file is missing/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("writes packet JSON, UI JSON, Markdown, and public assets from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-packet-"));
  try {
    const sources = await writeSourceFiles(tempDir);
    const bundlePath = path.join(tempDir, "draft-bundle.json");
    const outDir = path.join(tempDir, "packet");
    const publicOutDir = path.join(tempDir, "public");
    await writeFile(bundlePath, `${JSON.stringify(pendingBundle(tempDir), null, 2)}\n`);

    const result = await buildReviewPacketFromFiles({
      bundlePath,
      contactSheetPath: sources.contactSheetPath,
      visualReviewPath: sources.visualReviewPath,
      outDir,
      publicOutDir,
      publicUrlBase: "/social-studio/current-review",
      generatedAt: "2026-06-10T14:00:00.000Z"
    });

    assert.equal(result.packetPath, path.join(outDir, "review-packet.json"));
    const ui = JSON.parse(await readFile(path.join(outDir, "review-packet.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "review-packet.md"), "utf8");
    assert.equal(ui.status, "needs_review");
    assert.match(markdown, /Decision needed/);
    assert.equal(JSON.stringify(ui).includes(tempDir), false);
    assert.equal(JSON.stringify(ui).includes("C:\\"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
