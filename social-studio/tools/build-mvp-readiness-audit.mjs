import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function gate(status, label, evidence = "") {
  return { status, label, evidence };
}

function isSafeDryRun(pkg) {
  const posts = Array.isArray(pkg?.postizPayload?.posts) ? pkg.postizPayload.posts : [];
  const hasPlaceholderValues = posts.some((post) => {
    if (/replace-with|placeholder/i.test(String(post?.integration?.id || ""))) {
      return true;
    }
    const values = Array.isArray(post?.value) ? post.value : [];
    return values.some((value) => {
      const images = Array.isArray(value?.image) ? value.image : [];
      return images.some(
        (image) =>
          /replace-with|placeholder/i.test(String(image?.id || "")) ||
          /replace-with|placeholder/i.test(String(image?.path || ""))
      );
    });
  });

  return (
    pkg?.packageType === "postiz_api_draft_dry_run" &&
    pkg?.dryRunOnly === true &&
    pkg?.transport?.networkCallsAllowed === false &&
    pkg?.postizPayload?.type === "draft" &&
    pkg?.safety?.notLiveConfirmed === true &&
    posts.length > 0 &&
    !hasPlaceholderValues
  );
}

function contentPlanIsReady(contentPlan) {
  const requiredTypes = ["ugc_video", "paid_ad_video", "normal_post"];
  const assets = Array.isArray(contentPlan?.assets) ? contentPlan.assets : [];
  const types = new Set(assets.map((asset) => asset.contentType));
  const requiredTypesPresent = requiredTypes.every((type) => types.has(type));
  const assetsRemainReviewFirst =
    assets.length > 0 &&
    assets.every(
      (asset) =>
        asset?.review?.required === true &&
        asset?.review?.status === "needs_review" &&
        asset?.postiz?.publishAllowed === false
    );

  return (
    contentPlan?.packageType === "social_studio_content_plan" &&
    contentPlan?.safety?.noLivePosting === true &&
    contentPlan?.safety?.postizDraftOnlyAfterApproval === true &&
    requiredTypesPresent &&
    assetsRemainReviewFirst
  );
}

function brandClaimLedgerIsReady(brandClaimLedger) {
  const assets = Array.isArray(brandClaimLedger?.assets) ? brandClaimLedger.assets : [];
  const hasRequiredTypes = ["ugc_video", "paid_ad_video", "normal_post"].every((type) =>
    assets.some((asset) => asset.contentType === type)
  );
  const assetsRemainSafe =
    assets.length > 0 &&
    assets.every(
      (asset) =>
        asset?.review?.status === "needs_review" &&
        asset?.postiz?.status === "blocked_until_approved" &&
        asset?.postiz?.publishAllowed === false &&
        asset?.reviewChecks?.notLive === true &&
        Array.isArray(asset?.claimRules?.approvedBenefits) &&
        asset.claimRules.approvedBenefits.length > 0 &&
        Array.isArray(asset?.claimRules?.blockedClaims) &&
        asset.claimRules.blockedClaims.length > 0 &&
        Boolean(asset?.claimRules?.sourceRef)
    );

  return (
    brandClaimLedger?.packageType === "social_studio_brand_claim_ledger" &&
    brandClaimLedger?.safety?.noLivePosting === true &&
    brandClaimLedger?.safety?.postizBlockedUntilApproval === true &&
    brandClaimLedger?.summary?.publishAllowed === 0 &&
    Array.isArray(brandClaimLedger?.brandRules) &&
    brandClaimLedger.brandRules.length > 0 &&
    hasRequiredTypes &&
    assetsRemainSafe
  );
}

function productionPacketsAreReady(productionPackets) {
  const requiredTypes = ["ugc_video", "paid_ad_video", "normal_post"];
  const assets = Array.isArray(productionPackets?.assets) ? productionPackets.assets : [];
  const types = new Set(assets.map((asset) => asset.contentType));
  const requiredTypesPresent = requiredTypes.every((type) => types.has(type));
  const packetsRemainSafe =
    assets.length > 0 &&
    assets.every(
      (asset) =>
        asset?.execution?.networkCallsAllowed === false &&
        asset?.review?.status === "needs_review" &&
        asset?.postiz?.status === "blocked_until_approved" &&
        asset?.postiz?.publishAllowed === false
    );
  const hasExpectedPacketKinds =
    assets.some((asset) => asset.contentType === "ugc_video" && asset.packetType === "moneyprinter_video_request") &&
    assets.some((asset) => asset.contentType === "paid_ad_video" && asset.packetType === "moneyprinter_video_request") &&
    assets.some((asset) => asset.contentType === "normal_post" && asset.packetType === "static_post_copy_brief");

  return (
    productionPackets?.packageType === "social_studio_production_packets" &&
    productionPackets?.safety?.noLivePosting === true &&
    productionPackets?.safety?.networkCallsAllowed === false &&
    productionPackets?.safety?.postizBlockedUntilApproval === true &&
    requiredTypesPresent &&
    packetsRemainSafe &&
    hasExpectedPacketKinds
  );
}

function productionQueueIsReady(productionQueue) {
  const items = Array.isArray(productionQueue?.items) ? productionQueue.items : [];
  const hasRequiredTypes = ["ugc_video", "paid_ad_video", "normal_post"].every((type) =>
    items.some((item) => item.contentType === type)
  );
  const queueRemainsSafe =
    items.length > 0 &&
    items.every(
      (item) =>
        ["generated_needs_review", "packet_ready"].includes(item?.state) &&
        item?.review?.status === "needs_review" &&
        item?.postiz?.status === "blocked_until_approved" &&
        item?.postiz?.publishAllowed === false
    );

  return (
    productionQueue?.packageType === "social_studio_production_queue" &&
    productionQueue?.safety?.noLivePosting === true &&
    productionQueue?.safety?.networkCallsAllowed === false &&
    productionQueue?.safety?.postizBlockedUntilApproval === true &&
    productionQueue?.summary?.publishAllowed === 0 &&
    hasRequiredTypes &&
    queueRemainsSafe
  );
}

function reviewBoardIsReady(reviewBoard) {
  const items = Array.isArray(reviewBoard?.items) ? reviewBoard.items : [];
  const generatedReviewItems = items.filter((item) => item.reviewAction === "review_decision_required");
  const boardRemainsSafe =
    items.length > 0 &&
    items.every(
      (item) =>
        item?.review?.status === "needs_review" &&
        item?.postiz?.status === "blocked_until_approved" &&
        item?.postiz?.publishAllowed === false
    );

  return (
    reviewBoard?.packageType === "social_studio_review_board" &&
    reviewBoard?.safety?.noLivePosting === true &&
    reviewBoard?.safety?.liveActionsEnabled === false &&
    reviewBoard?.safety?.postizBlockedUntilApproval === true &&
    reviewBoard?.summary?.publishAllowed === 0 &&
    generatedReviewItems.length > 0 &&
    generatedReviewItems.every((item) => Array.isArray(item.decisions) && item.decisions.length === 3) &&
    boardRemainsSafe
  );
}

function buildGates({
  workflowStatus,
  reviewPacket,
  manualManifest,
  contentPlan,
  brandClaimLedger,
  productionPackets,
  productionQueue,
  reviewBoard,
  postizDryRunPackage,
  verification
}) {
  const approved =
    workflowStatus?.overall?.status === "approved_waiting_postiz_dry_run" ||
    workflowStatus?.overall?.status === "postiz_draft_ready";
  const dryRunReady = isSafeDryRun(postizDryRunPackage);
  const readyContentPlan = contentPlanIsReady(contentPlan);
  const readyBrandClaimLedger = brandClaimLedgerIsReady(brandClaimLedger);
  const readyProductionPackets = productionPacketsAreReady(productionPackets);
  const readyProductionQueue = productionQueueIsReady(productionQueue);
  const readyReviewBoard = reviewBoardIsReady(reviewBoard);

  return {
    planAndBrand: gate(
      workflowStatus?.artifacts?.brandContext ? "ready" : "blocked",
      workflowStatus?.artifacts?.brandContext
        ? "MVP plan and brand context are present."
        : "MVP plan or brand context is missing."
    ),
    contentPlan: gate(
      readyContentPlan ? "ready" : "blocked",
      readyContentPlan
        ? "UGC video, paid ad video, and normal post assets are planned behind review gates."
        : "Content plan for UGC video, paid ad video, and normal post assets is missing or unsafe."
    ),
    brandClaimLedger: gate(
      readyBrandClaimLedger ? "ready" : "blocked",
      readyBrandClaimLedger
        ? "Brand rules, claim sources, blocked claims, and required visuals are attached to every asset."
        : "Brand claim ledger is missing or unsafe."
    ),
    productionPackets: gate(
      readyProductionPackets ? "ready" : "blocked",
      readyProductionPackets
        ? "Per-asset production packets exist for UGC video, paid ad video, and normal post."
        : "Per-asset production packets are missing or unsafe."
    ),
    productionQueue: gate(
      readyProductionQueue ? "ready" : "blocked",
      readyProductionQueue
        ? "Production queue maps generated and pending assets without allowing publishing."
        : "Production queue is missing or unsafe."
    ),
    reviewBoard: gate(
      readyReviewBoard ? "ready" : "blocked",
      readyReviewBoard
        ? "Review board exposes human decisions only for generated assets."
        : "Review board is missing or unsafe."
    ),
    moneyprinterDraft: gate(
      workflowStatus?.artifacts?.moneyprinterVideo ? "ready" : "blocked",
      workflowStatus?.artifacts?.moneyprinterVideo
        ? "MoneyPrinterTurbo draft video is present."
        : "MoneyPrinterTurbo draft video is missing."
    ),
    reviewPacket: gate(
      reviewPacket?.safety?.notLiveConfirmed === true && Boolean(reviewPacket?.assets?.videoUrl)
        ? "ready"
        : "blocked",
      "Review packet and media are available."
    ),
    humanApproval: gate(
      approved ? "ready" : "blocked",
      approved ? "Human approval has been recorded." : "Human approval is still required."
    ),
    manualPostizHandoff: gate(
      manualManifest?.postiz?.handoffMode === "manual_upload" &&
        manualManifest?.review?.notLiveConfirmed === true
        ? "ready"
        : "blocked",
      manualManifest?.postiz?.status === "draft_upload_ready"
        ? "Approved manual Postiz draft package exists."
        : "Manual Postiz preview package exists but is not approved."
    ),
    postizApiDryRun: gate(
      dryRunReady ? "ready" : "blocked",
      dryRunReady
        ? "Postiz API draft dry-run package is ready and network calls are disabled."
        : "Postiz API draft dry-run package is missing or not safe."
    ),
    noLivePosting: gate(
      workflowStatus?.safety?.noLivePosting === true &&
        reviewPacket?.safety?.scheduleOrPublishReady === false &&
        workflowStatus?.readiness?.canScheduleOrPublish === false
        ? "ready"
        : "blocked",
      "No live posting, scheduling, or publishing has been enabled."
    ),
    verification: gate(
      verification?.testsPassing &&
        verification?.buildPassing &&
        verification?.secretScanPassing &&
        verification?.pathLeakScanPassing
        ? "ready"
        : "blocked",
      "Tests, build, secret scan, and UI path-leak scan must pass."
    ),
    finalPublish: gate(
      "not_in_scope",
      "Publishing is intentionally outside this draft-only MVP."
    )
  };
}

function deriveOverall(gates, workflowStatus) {
  if (gates.humanApproval.status === "blocked") {
    return "blocked_by_human_review";
  }
  if (gates.postizApiDryRun.status === "blocked") {
    return "approved_waiting_postiz_dry_run";
  }
  const allDraftGatesReady = [
    gates.planAndBrand,
    gates.contentPlan,
    gates.brandClaimLedger,
    gates.productionPackets,
    gates.productionQueue,
    gates.reviewBoard,
    gates.moneyprinterDraft,
    gates.reviewPacket,
    gates.humanApproval,
    gates.manualPostizHandoff,
    gates.postizApiDryRun,
    gates.noLivePosting,
    gates.verification
  ].every((item) => item.status === "ready");

  if (allDraftGatesReady && workflowStatus?.overall?.status === "postiz_draft_ready") {
    return "draft_mvp_ready";
  }
  return "blocked";
}

function nextActionsFor(overallStatus, workflowStatus) {
  if (overallStatus === "blocked_by_human_review") {
    return [
      "Complete human review of the MP4/contact sheet and record approve, needs_revision, or reject.",
      "Keep Postiz draft creation blocked until approval evidence exists."
    ];
  }
  if (overallStatus === "approved_waiting_postiz_dry_run") {
    return [
      "Upload approved media to local Postiz and capture the returned media id/path.",
      "Build the Postiz API draft dry-run package without allowing network calls."
    ];
  }
  if (overallStatus === "draft_mvp_ready") {
    return [
      "The draft-only MVP is ready for a separately approved Postiz draft creation step.",
      "Do not schedule or publish without a separate approval."
    ];
  }
  return workflowStatus?.nextActions?.length
    ? workflowStatus.nextActions
    : ["Inspect blocked gates and fix the first missing artifact."];
}

function makeMarkdown(audit) {
  const lines = [
    "# Crystal Clawz Social Studio MVP Readiness Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    `Campaign: ${audit.campaignId}`,
    `Overall status: ${audit.overall.status}`,
    `MVP complete: ${audit.overall.mvpComplete ? "yes" : "no"}`,
    "",
    "## Gates",
    ""
  ];

  for (const [name, item] of Object.entries(audit.gates)) {
    lines.push(`- ${name}: ${item.status} - ${item.label}`);
  }

  lines.push("", "## Next Actions", "");
  for (const action of audit.nextActions) {
    lines.push(`- ${action}`);
  }

  return `${lines.join("\n")}\n`;
}

export function buildMvpReadinessAudit({
  workflowStatus,
  reviewPacket,
  manualManifest,
  contentPlan = null,
  brandClaimLedger = null,
  productionPackets = null,
  productionQueue = null,
  reviewBoard = null,
  postizDryRunPackage = null,
  verification = {},
  generatedAt = new Date().toISOString()
}) {
  const gates = buildGates({
    workflowStatus,
    reviewPacket,
    manualManifest,
    contentPlan,
    brandClaimLedger,
    productionPackets,
    productionQueue,
    reviewBoard,
    postizDryRunPackage,
    verification
  });
  const overallStatus = deriveOverall(gates, workflowStatus);
  const audit = {
    packageType: "social_studio_mvp_readiness_audit",
    generatedAt,
    campaignId: workflowStatus?.campaignId || "",
    assetId: workflowStatus?.assetId || "",
    overall: {
      status: overallStatus,
      mvpComplete: overallStatus === "draft_mvp_ready",
      scope: "draft_only_review_first_mvp"
    },
    gates,
    nextActions: nextActionsFor(overallStatus, workflowStatus)
  };
  audit.markdown = makeMarkdown(audit);
  return audit;
}

async function exists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  return (await exists(filePath)) ? readJson(filePath) : null;
}

export async function buildMvpReadinessAuditFromFiles({
  workflowStatusPath,
  reviewPacketPath,
  manualManifestPath,
  contentPlanPath = "",
  brandClaimLedgerPath = "",
  productionPacketsPath = "",
  productionQueuePath = "",
  reviewBoardPath = "",
  postizDryRunPath = "",
  jsonOut,
  markdownOut,
  verification,
  generatedAt
}) {
  const audit = buildMvpReadinessAudit({
    workflowStatus: await readJson(workflowStatusPath),
    reviewPacket: await readJson(reviewPacketPath),
    manualManifest: await readJson(manualManifestPath),
    contentPlan: await readJsonIfExists(contentPlanPath),
    brandClaimLedger: await readJsonIfExists(brandClaimLedgerPath),
    productionPackets: await readJsonIfExists(productionPacketsPath),
    productionQueue: await readJsonIfExists(productionQueuePath),
    reviewBoard: await readJsonIfExists(reviewBoardPath),
    postizDryRunPackage: await readJsonIfExists(postizDryRunPath),
    verification,
    generatedAt
  });

  await mkdir(path.dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(markdownOut, audit.markdown);
  return { jsonOut, markdownOut, status: audit.overall.status };
}

function verificationFromArgs() {
  const yes = (name) => readArg(name, "false") === "true";
  return {
    testsPassing: yes("tests-passing"),
    buildPassing: yes("build-passing"),
    secretScanPassing: yes("secret-scan-passing"),
    pathLeakScanPassing: yes("path-leak-scan-passing")
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildMvpReadinessAuditFromFiles({
    workflowStatusPath: readArg("workflow-status", path.join(generatedDir, "workflow-status.json")),
    reviewPacketPath: readArg("review-packet", path.join(generatedDir, "review-packet", "review-packet.json")),
    manualManifestPath: readArg(
      "manual-manifest",
      path.join(studioRoot, "handoff", "postiz", "manual", campaignId, "manifest.json")
    ),
    contentPlanPath: readArg("content-plan", path.join(generatedDir, "content-plan", "content-plan.json")),
    brandClaimLedgerPath: readArg("brand-claim-ledger", path.join(generatedDir, "brand-claim-ledger", "brand-claim-ledger.json")),
    productionPacketsPath: readArg("production-packets", path.join(generatedDir, "production-packets", "production-packets.json")),
    productionQueuePath: readArg("production-queue", path.join(generatedDir, "production-queue", "production-queue.json")),
    reviewBoardPath: readArg("review-board", path.join(generatedDir, "review-board", "review-board.json")),
    postizDryRunPath: readArg("postiz-dry-run", path.join(generatedDir, "postiz-draft.dry-run.json")),
    jsonOut: readArg("json-out", path.join(generatedDir, "mvp-readiness-audit.json")),
    markdownOut: readArg("markdown-out", path.join(generatedDir, "mvp-readiness-audit.md")),
    verification: verificationFromArgs()
  });

  console.log(`json=${result.jsonOut}`);
  console.log(`markdown=${result.markdownOut}`);
  console.log(`status=${result.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
