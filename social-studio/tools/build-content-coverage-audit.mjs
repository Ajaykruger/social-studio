import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

const DEFAULT_REQUIRED_CONTENT_TYPES = ["ugc_video", "paid_ad_video", "normal_post"];

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function labelFor(contentType) {
  return {
    ugc_video: "UGC video",
    paid_ad_video: "Paid ad video",
    normal_post: "Normal post"
  }[contentType] || contentType.replaceAll("_", " ");
}

function assertReviewFirst({ contentPlan, productionQueue }) {
  if (contentPlan?.noLivePosting !== true || productionQueue?.noLivePosting !== true) {
    throw new Error("content coverage audit requires no-live-posting review-first state");
  }
  if (Number(productionQueue?.summary?.publishAllowed || 0) > 0) {
    throw new Error("content coverage audit refuses publish-enabled queue items");
  }
  const unsafePlan = (contentPlan?.assets || []).find((asset) => asset.publishAllowed === true);
  const unsafeQueue = (productionQueue?.items || []).find((item) => item.publishAllowed === true);
  if (unsafePlan || unsafeQueue) {
    throw new Error("content coverage audit refuses publish-enabled queue items");
  }
}

function itemStatus({ planAsset, queueItem }) {
  if (!planAsset) return "missing_from_plan";
  if (!queueItem) return "missing_from_queue";
  if (queueItem.state === "generated_needs_review" && queueItem.mediaPresent === true) {
    return "generated_needs_review";
  }
  return "pending_production";
}

function formatLabelList(labels) {
  const normalized = labels.map((label) => String(label || "").toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return "assets";
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")}, and ${normalized.at(-1)}`;
}

function nextActionFor({ generatedItems, pendingItems, missingItems }) {
  if (missingItems.length > 0) {
    return "Add missing UGC, paid ad, and normal post entries before treating coverage as complete.";
  }
  if (pendingItems.length > 0) {
    const generatedLabel = formatLabelList(generatedItems.map((item) => item.label));
    const pendingLabel = formatLabelList(pendingItems.map((item) => item.label));
    const packetWord = pendingItems.length === 1 ? "packet" : "packets";
    return `Review the generated ${generatedLabel}, then produce the pending ${pendingLabel} ${packetWord} through human review.`;
  }
  if (generatedItems.length > 0) {
    return "Review all generated assets and record approve, needs_revision, or reject decisions.";
  }
  return "Produce the required content packets through the review-first workflow.";
}

function statusFor({ generatedCount, requiredCount, missingCount }) {
  if (missingCount > 0) return "missing_required_coverage";
  if (generatedCount === requiredCount) return "generated_review_coverage_ready";
  return "partial_production_coverage";
}

function makeUiSummary(audit) {
  return {
    campaignId: audit.campaignId,
    status: audit.status,
    noLivePosting: audit.noLivePosting,
    networkCallsAllowed: audit.networkCallsAllowed,
    publishAllowed: audit.publishAllowed,
    summary: audit.summary,
    nextAction: audit.nextAction,
    items: audit.items
  };
}

function makeMarkdown(audit) {
  const lines = [
    "# Content Coverage Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    `Campaign: ${audit.campaignId}`,
    `Status: ${audit.status}`,
    "",
    "## Summary",
    "",
    `- Required content types: ${audit.summary.requiredContentTypes}`,
    `- Planned content types: ${audit.summary.plannedContentTypes}`,
    `- Packet-ready content types: ${audit.summary.packetReadyContentTypes}`,
    `- Generated content types: ${audit.summary.generatedContentTypes}`,
    `- Pending production content types: ${audit.summary.pendingProductionContentTypes}`,
    "",
    "## Items",
    ""
  ];

  for (const item of audit.items) {
    lines.push(`- ${item.label}: ${item.status} - ${item.nextAction}`);
  }

  lines.push("", "## Next Action", "", `- ${audit.nextAction}`, "");
  return `${lines.join("\n")}\n`;
}

export function buildContentCoverageAudit({
  contentPlan,
  productionQueue,
  requiredContentTypes = DEFAULT_REQUIRED_CONTENT_TYPES,
  generatedAt = new Date().toISOString()
}) {
  assertReviewFirst({ contentPlan, productionQueue });

  const plannedByType = new Map((contentPlan?.assets || []).map((asset) => [asset.contentType, asset]));
  const queuedByType = new Map((productionQueue?.items || []).map((item) => [item.contentType, item]));
  const items = requiredContentTypes.map((contentType) => {
    const planAsset = plannedByType.get(contentType);
    const queueItem = queuedByType.get(contentType);
    const status = itemStatus({ planAsset, queueItem });
    return {
      contentType,
      label: planAsset?.label || queueItem?.label || labelFor(contentType),
      status,
      planned: Boolean(planAsset),
      packetReady: Boolean(queueItem),
      generated: status === "generated_needs_review",
      generator: planAsset?.generator || queueItem?.generator || "",
      output: planAsset?.output || "",
      postizStatus: queueItem?.postizStatus || planAsset?.postizStatus || "blocked_until_approved",
      publishAllowed: Boolean(queueItem?.publishAllowed || planAsset?.publishAllowed),
      nextAction:
        status === "generated_needs_review"
          ? "Review the generated asset and record approve, needs_revision, or reject."
          : status === "pending_production"
            ? "Produce this packet, then route the output through human review."
            : "Restore this required content type in the plan and production queue."
    };
  });

  const generatedCount = items.filter((item) => item.generated).length;
  const missingCount = items.filter((item) => !item.planned || !item.packetReady).length;
  const pendingCount = items.filter((item) => item.planned && item.packetReady && !item.generated).length;
  const generatedItems = items.filter((item) => item.generated);
  const pendingItems = items.filter((item) => item.planned && item.packetReady && !item.generated);
  const missingItems = items.filter((item) => !item.planned || !item.packetReady);
  const audit = {
    packageType: "social_studio_content_coverage_audit",
    generatedAt,
    campaignId: contentPlan?.campaignId || productionQueue?.campaignId || "",
    status: statusFor({
      generatedCount,
      requiredCount: requiredContentTypes.length,
      missingCount
    }),
    noLivePosting: true,
    networkCallsAllowed: false,
    publishAllowed: 0,
    summary: {
      requiredContentTypes: requiredContentTypes.length,
      plannedContentTypes: items.filter((item) => item.planned).length,
      packetReadyContentTypes: items.filter((item) => item.packetReady).length,
      generatedContentTypes: generatedCount,
      pendingProductionContentTypes: pendingCount,
      missingContentTypes: missingCount
    },
    items,
    nextAction: nextActionFor({ generatedItems, pendingItems, missingItems })
  };

  audit.uiSummary = makeUiSummary(audit);
  audit.markdown = makeMarkdown(audit);
  return audit;
}

export async function buildContentCoverageAuditFromFiles({
  contentPlanPath,
  productionQueuePath,
  outDir,
  generatedAt
}) {
  const audit = buildContentCoverageAudit({
    contentPlan: await readJson(contentPlanPath),
    productionQueue: await readJson(productionQueuePath),
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "content-coverage-audit.json");
  const uiPath = path.join(outDir, "content-coverage-audit.ui.json");
  const markdownPath = path.join(outDir, "content-coverage-audit.md");
  await writeFile(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(audit.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, audit.markdown);

  return {
    status: audit.status,
    jsonPath,
    uiPath,
    markdownPath
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildContentCoverageAuditFromFiles({
    contentPlanPath: readArg("content-plan", path.join(generatedDir, "content-plan", "content-plan.ui.json")),
    productionQueuePath: readArg("production-queue", path.join(generatedDir, "production-queue", "production-queue.ui.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "content-coverage-audit"))
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
