import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildReviewBoard,
  buildReviewBoardFromFiles
} from "../tools/build-review-board.mjs";

function productionQueue() {
  return {
    packageType: "social_studio_production_queue",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    safety: {
      noLivePosting: true,
      networkCallsAllowed: false,
      postizBlockedUntilApproval: true
    },
    summary: {
      totalAssets: 3,
      generatedAssets: 1,
      needsReview: 1,
      packetReady: 2,
      publishAllowed: 0
    },
    items: [
      {
        assetId: "cc-rubber-base-demo-2026-06-10-ugc-video-01",
        label: "UGC video",
        contentType: "ugc_video",
        state: "generated_needs_review",
        generated: { mediaPresent: true, currentDraftAssetId: "cc-rubber-base-demo-2026-06-10-draft-001" },
        review: { required: true, status: "needs_review", reviewer: "pending-human-review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false },
        nextAction: "Review the generated MP4/contact sheet and record approve, needs_revision, or reject."
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
        label: "Paid ad video",
        contentType: "paid_ad_video",
        state: "packet_ready",
        generated: { mediaPresent: false, currentDraftAssetId: "" },
        review: { required: true, status: "needs_review", reviewer: "pending-human-review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false },
        nextAction: "Produce this packet, then route the output through human review."
      },
      {
        assetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
        label: "Normal post",
        contentType: "normal_post",
        state: "packet_ready",
        generated: { mediaPresent: false, currentDraftAssetId: "" },
        review: { required: true, status: "needs_review", reviewer: "pending-human-review" },
        postiz: { status: "blocked_until_approved", publishAllowed: false },
        nextAction: "Produce this packet, then route the output through human review."
      }
    ]
  };
}

function reviewPacket() {
  return {
    packageType: "social_studio_review_packet",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    assetId: "cc-rubber-base-demo-2026-06-10-draft-001",
    status: "needs_review",
    review: {
      decisionRequired: true,
      nextAction: "Review the MP4 and contact sheet, then record approve, needs_revision, or reject."
    },
    safety: {
      notLiveConfirmed: true,
      scheduleOrPublishReady: false
    },
    assets: {
      videoUrl: "/social-studio/current/final-1.mp4",
      contactSheetUrl: "/social-studio/current/contact-sheet.jpg"
    }
  };
}

function decisionCommands() {
  return {
    packageType: "social_studio_review_decision_commands",
    campaignId: "cc-rubber-base-demo-2026-06-10",
    status: "needs_review",
    commandOnly: true,
    liveActionsEnabled: false,
    commands: [
      { decision: "approve", label: "Approve", command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=approve" },
      { decision: "needs_revision", label: "Needs revision", command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=needs_revision" },
      { decision: "reject", label: "Reject", command: "node social-studio\\tools\\run-review-decision-cycle.mjs --decision=reject" }
    ]
  };
}

test("builds a review board with decisions only for generated assets", () => {
  const board = buildReviewBoard({
    productionQueue: productionQueue(),
    reviewPacket: reviewPacket(),
    decisionCommands: decisionCommands(),
    generatedAt: "2026-06-10T20:00:00.000Z"
  });

  assert.equal(board.packageType, "social_studio_review_board");
  assert.equal(board.status, "needs_review");
  assert.equal(board.safety.noLivePosting, true);
  assert.equal(board.safety.liveActionsEnabled, false);
  assert.equal(board.summary.decisionRequired, 1);
  assert.equal(board.summary.produceBeforeReview, 2);
  assert.equal(board.summary.publishAllowed, 0);

  const ugc = board.items.find((item) => item.contentType === "ugc_video");
  assert.equal(ugc.reviewAction, "review_decision_required");
  assert.deepEqual(ugc.decisions.map((decision) => decision.decision), ["approve", "needs_revision", "reject"]);
  assert.equal(ugc.media.videoUrl, "/social-studio/current/final-1.mp4");
  assert.equal(ugc.media.contactSheetUrl, "/social-studio/current/contact-sheet.jpg");

  const paid = board.items.find((item) => item.contentType === "paid_ad_video");
  assert.equal(paid.reviewAction, "produce_before_review");
  assert.equal(paid.decisions.length, 0);
  assert.equal(JSON.stringify(board.uiSummary).includes("C:\\"), false);
});

test("carries generated static normal-post image review media into the board", () => {
  const queue = productionQueue();
  queue.summary.generatedAssets = 2;
  queue.summary.needsReview = 2;
  queue.summary.packetReady = 1;
  queue.items[2] = {
    ...queue.items[2],
    state: "generated_needs_review",
    generated: {
      mediaPresent: true,
      currentDraftAssetId: "",
      reviewAssetId: "cc-rubber-base-demo-2026-06-10-normal-post-03",
      mediaType: "image",
      imageUrl: "/social-studio/current/normal-post-03.svg"
    },
    nextAction: "Review the generated static post image and caption, then record a decision."
  };

  const board = buildReviewBoard({
    productionQueue: queue,
    reviewPacket: reviewPacket(),
    decisionCommands: decisionCommands(),
    generatedAt: "2026-06-10T23:30:00.000Z"
  });

  const post = board.items.find((item) => item.contentType === "normal_post");
  assert.equal(board.summary.decisionRequired, 2);
  assert.equal(board.summary.produceBeforeReview, 1);
  assert.equal(post.reviewAction, "review_decision_required");
  assert.equal(post.media.imageUrl, "/social-studio/current/normal-post-03.svg");
  assert.equal(post.media.videoUrl, "");
  assert.equal(post.decisions.length, 3);
  assert.match(post.nextAction, /static post image/i);
  assert.doesNotMatch(post.nextAction, /MP4/i);
  assert.equal(JSON.stringify(board.uiSummary).includes("C:\\"), false);
});

test("carries generated paid-ad video review media into the board", () => {
  const queue = productionQueue();
  queue.summary.generatedAssets = 2;
  queue.summary.needsReview = 2;
  queue.summary.packetReady = 1;
  queue.items[1] = {
    ...queue.items[1],
    state: "generated_needs_review",
    generated: {
      mediaPresent: true,
      currentDraftAssetId: "",
      reviewAssetId: "cc-rubber-base-demo-2026-06-10-paid-ad-video-02",
      mediaType: "video",
      videoUrl: "/social-studio/current/paid-ad-video-02.mp4",
      storyboardUrl: "/social-studio/current/paid-ad-video-02-storyboard.svg"
    },
    nextAction: "Review the generated paid ad video draft and storyboard, then record a decision."
  };

  const board = buildReviewBoard({
    productionQueue: queue,
    reviewPacket: reviewPacket(),
    decisionCommands: decisionCommands(),
    generatedAt: "2026-06-11T00:10:00.000Z"
  });

  const paid = board.items.find((item) => item.contentType === "paid_ad_video");
  assert.equal(board.summary.decisionRequired, 2);
  assert.equal(board.summary.produceBeforeReview, 1);
  assert.equal(paid.reviewAction, "review_decision_required");
  assert.equal(paid.media.videoUrl, "/social-studio/current/paid-ad-video-02.mp4");
  assert.equal(paid.media.imageUrl, "/social-studio/current/paid-ad-video-02-storyboard.svg");
  assert.equal(paid.decisions.length, 3);
  assert.match(paid.nextAction, /paid ad video draft/i);
  assert.doesNotMatch(paid.nextAction, /MP4 and contact sheet/i);
  assert.equal(JSON.stringify(board.uiSummary).includes("C:\\"), false);
});

test("rejects unsafe queues that allow publishing", () => {
  const unsafe = productionQueue();
  unsafe.summary.publishAllowed = 1;
  unsafe.items[0].postiz.publishAllowed = true;

  assert.throws(
    () =>
      buildReviewBoard({
        productionQueue: unsafe,
        reviewPacket: reviewPacket(),
        decisionCommands: decisionCommands()
      }),
    /review-first/i
  );
});

test("writes review board JSON, UI JSON, and Markdown from files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-review-board-"));
  try {
    const queuePath = path.join(tempDir, "production-queue.json");
    const reviewPacketPath = path.join(tempDir, "review-packet.json");
    const commandsPath = path.join(tempDir, "commands.json");
    const outDir = path.join(tempDir, "review-board");
    await writeFile(queuePath, `${JSON.stringify(productionQueue(), null, 2)}\n`);
    await writeFile(reviewPacketPath, `${JSON.stringify(reviewPacket(), null, 2)}\n`);
    await writeFile(commandsPath, `${JSON.stringify(decisionCommands(), null, 2)}\n`);

    const result = await buildReviewBoardFromFiles({
      productionQueuePath: queuePath,
      reviewPacketPath,
      decisionCommandsPath: commandsPath,
      outDir,
      generatedAt: "2026-06-10T20:00:00.000Z"
    });

    assert.equal(result.status, "needs_review");
    const saved = JSON.parse(await readFile(path.join(outDir, "review-board.json"), "utf8"));
    const ui = JSON.parse(await readFile(path.join(outDir, "review-board.ui.json"), "utf8"));
    const markdown = await readFile(path.join(outDir, "review-board.md"), "utf8");
    assert.equal(saved.items.length, 3);
    assert.equal(ui.summary.decisionRequired, 1);
    assert.match(markdown, /review_decision_required/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
