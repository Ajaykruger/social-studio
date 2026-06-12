import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildReviewPacket } from "../tools/build-review-packet.mjs";

function pendingBundle(baseDir) {
  return {
    campaignId: "linux-path-sanitizer",
    assetId: "linux-path-sanitizer-draft-001",
    reviewStatus: {
      status: "needs_review"
    },
    postizHandoff: {
      media: {
        localPath: path.join(baseDir, "final-1.mp4"),
        mediaType: "video"
      },
      caption: "Smooth base for cleaner salon work.",
      hashtags: ["#CrystalClawz"],
      scheduledFor: "",
      status: "needs_review",
      review: {
        approvedBy: "pending-human-review",
        approvedAt: "",
        notLiveConfirmed: true
      }
    },
    moneyprinterTask: {
      crossPostResults: null
    }
  };
}

test("review packet UI summary redacts POSIX local paths from visual review notes", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-posix-paths-"));
  try {
    const mediaPath = path.join(tempDir, "final-1.mp4");
    const contactSheetPath = path.join(tempDir, "contact-sheet.jpg");
    const visualReviewPath = path.join(tempDir, "visual-review.md");
    const linuxLocalPath = "/tmp/social-studio-review-packet-123/final-1.mp4";

    await writeFile(mediaPath, "fake video");
    await writeFile(contactSheetPath, "fake contact sheet");
    await writeFile(
      visualReviewPath,
      [
        "Product visible. Still needs human review.",
        `Reviewed file: ${linuxLocalPath}`,
        linuxLocalPath
      ].join("\n")
    );

    const result = await buildReviewPacket({
      bundle: pendingBundle(tempDir),
      contactSheetPath,
      visualReviewPath,
      outDir: path.join(tempDir, "packet"),
      publicOutDir: path.join(tempDir, "public"),
      publicUrlBase: "/social-studio/linux-path-sanitizer/review",
      generatedAt: "2026-06-12T13:40:00.000Z"
    });

    assert.equal(result.uiSummary.visualReviewSummary.includes("/tmp/"), false);
    assert.equal(result.uiSummary.visualReviewSummary.includes("[local file]"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
