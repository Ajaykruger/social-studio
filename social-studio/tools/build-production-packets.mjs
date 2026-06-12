import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertReviewFirstContentPlan(contentPlan) {
  if (contentPlan?.packageType !== "social_studio_content_plan") {
    throw new Error("production packets require a social_studio_content_plan");
  }
  if (contentPlan?.safety?.noLivePosting !== true || contentPlan?.safety?.postizDraftOnlyAfterApproval !== true) {
    throw new Error("production packets require review-first safety flags");
  }
  const assets = Array.isArray(contentPlan.assets) ? contentPlan.assets : [];
  if (!assets.length) {
    throw new Error("production packets require planned assets");
  }
  for (const asset of assets) {
    if (
      asset?.review?.required !== true ||
      asset?.review?.status !== "needs_review" ||
      asset?.postiz?.publishAllowed !== false ||
      asset?.postiz?.status !== "blocked_until_approved"
    ) {
      throw new Error("production packets require every asset to remain review-first");
    }
  }
}

function baseSafety() {
  return {
    noLivePosting: true,
    networkCallsAllowed: false,
    postizBlockedUntilApproval: true,
    scheduleAllowed: false,
    publishAllowed: false,
    secretsRequired: false
  };
}

function cleanWords(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compactSummary(value) {
  const text = cleanWords(value);
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function makeVideoPrompt(asset, contentPlan) {
  const approvedBenefits = asset.claims?.approvedBenefits?.join("; ") || "approved product benefits only";
  const blockedClaims = asset.claims?.blockedClaims?.join("; ") || "unapproved claims";
  const style =
    asset.contentType === "paid_ad_video"
      ? "Make it more direct and ad-ready: clear hook, product visibility, benefit, and CTA."
      : "Make it creator-style and practical: natural hook, product visibility, simple explanation, and CTA.";
  return cleanWords(
    [
      `${asset.label}: ${asset.angle}`,
      `Product: ${contentPlan.product?.name}.`,
      `Audience: ${contentPlan.audience}.`,
      `CTA: ${contentPlan.cta}.`,
      `Approved benefits: ${approvedBenefits}.`,
      `Blocked claims: ${blockedClaims}.`,
      style,
      "Do not invent testimonials, medical claims, lab results, or guaranteed outcomes.",
      "Keep this as a draft for human review before Postiz."
    ].join(" ")
  );
}

function makeMoneyPrinterPacket(asset, contentPlan, requestTemplate) {
  const request = {
    ...clone(requestTemplate),
    video_subject: `${contentPlan.product?.name || "Crystal Clawz product"} - ${asset.label}`,
    video_script_prompt: makeVideoPrompt(asset, contentPlan),
    video_aspect: asset.output?.aspectRatios?.includes("9:16") ? "9:16" : requestTemplate.video_aspect || "9:16",
    video_source: requestTemplate.video_source || "local",
    video_count: 1,
    subtitle_enabled: requestTemplate.subtitle_enabled !== false
  };

  return {
    assetId: asset.assetId,
    contentType: asset.contentType,
    label: asset.label,
    platforms: asset.platforms || [],
    formats: asset.output?.aspectRatios || [],
    postizFormat: asset.output?.postizFormat || "",
    packetType: "moneyprinter_video_request",
    generator: asset.generator?.primary || "MoneyPrinterTurbo",
    execution: {
      mode: "local_manual_submit_after_review",
      apiBasePolicy: "localhost_only",
      networkCallsAllowed: false,
      submitted: false
    },
    moneyprinterRequest: request,
    review: asset.review,
    postiz: {
      status: "blocked_until_approved",
      draftCreationAllowed: false,
      scheduleAllowed: false,
      publishAllowed: false
    }
  };
}

function makeStaticPostPacket(asset, contentPlan) {
  const benefit = asset.claims?.approvedBenefits?.[0] || "salon-ready base";
  const captionDraft = `${contentPlan.product?.name} helps with ${benefit}. ${contentPlan.cta}.`;
  return {
    assetId: asset.assetId,
    contentType: asset.contentType,
    label: asset.label,
    platforms: asset.platforms || [],
    formats: asset.output?.aspectRatios || ["1:1", "4:5"],
    postizFormat: asset.output?.postizFormat || "",
    packetType: "static_post_copy_brief",
    generator: asset.generator?.primary || "Manual or Canva-style post builder",
    execution: {
      mode: "manual_design_then_review",
      networkCallsAllowed: false,
      submitted: false
    },
    staticPost: {
      captionDraft,
      designBrief: `${asset.label}: ${asset.angle}`,
      approvedBenefits: asset.claims?.approvedBenefits || [],
      blockedClaims: asset.claims?.blockedClaims || [],
      suggestedFormats: asset.output?.aspectRatios || ["1:1", "4:5"],
      cta: contentPlan.cta
    },
    review: asset.review,
    postiz: {
      status: "blocked_until_approved",
      draftCreationAllowed: false,
      scheduleAllowed: false,
      publishAllowed: false
    }
  };
}

function buildAssetPacket(asset, contentPlan, requestTemplate) {
  if (asset.generator?.moneyPrinterTurboAllowed) {
    return makeMoneyPrinterPacket(asset, contentPlan, requestTemplate);
  }
  return makeStaticPostPacket(asset, contentPlan);
}

function makeUiSummary(packets) {
  return {
    campaignId: packets.campaignId,
    status: packets.status,
    noLivePosting: packets.safety.noLivePosting,
    networkCallsAllowed: packets.safety.networkCallsAllowed,
    postizBlockedUntilApproval: packets.safety.postizBlockedUntilApproval,
    assets: packets.assets.map((asset) => ({
      assetId: asset.assetId,
      label: asset.label,
      contentType: asset.contentType,
      packetType: asset.packetType,
      generator: asset.generator,
      networkCallsAllowed: asset.execution.networkCallsAllowed,
      reviewStatus: asset.review?.status || "needs_review",
      postizStatus: asset.postiz.status,
      publishAllowed: asset.postiz.publishAllowed,
      details: {
        platforms: asset.platforms || [],
        formats: asset.formats || [],
        postizFormat: asset.postizFormat || "",
        promptSummary: asset.moneyprinterRequest?.video_script_prompt
          ? compactSummary(asset.moneyprinterRequest.video_script_prompt)
          : "",
        captionDraft: asset.staticPost?.captionDraft || "",
        designBrief: asset.staticPost?.designBrief || "",
        reviewFocus: Array.isArray(asset.review?.focus) ? asset.review.focus : []
      }
    }))
  };
}

function makeMarkdown(packets) {
  const lines = [
    "# Crystal Clawz Production Packets",
    "",
    `Generated: ${packets.generatedAt}`,
    `Campaign: ${packets.campaignId}`,
    `Status: ${packets.status}`,
    "",
    "## Safety",
    "",
    "- No network calls are made by this builder.",
    "- Postiz blocked until approval.",
    "- Scheduling and publishing remain disabled.",
    "",
    "## Packets",
    ""
  ];

  for (const asset of packets.assets) {
    lines.push(
      `### ${asset.label}`,
      "",
      `- Asset id: ${asset.assetId}`,
      `- Type: ${asset.packetType}`,
      `- Generator: ${asset.generator}`,
      `- Platforms: ${(asset.platforms || []).join(", ")}`,
      `- Suggested formats: ${(asset.formats || []).join(", ")}`,
      `- Postiz format: ${asset.postizFormat || ""}`,
      `- Postiz: ${asset.postiz.status}`,
      ""
    );
    if (asset.moneyprinterRequest?.video_script_prompt) {
      lines.push(`- Prompt summary: ${compactSummary(asset.moneyprinterRequest.video_script_prompt)}`, "");
    }
    if (asset.staticPost?.captionDraft) {
      lines.push(`- Caption draft: ${asset.staticPost.captionDraft}`, "");
    }
    if (asset.staticPost?.designBrief) {
      lines.push(`- Design brief: ${asset.staticPost.designBrief}`, "");
    }
  }

  return `${lines.join("\n")}\n`;
}

export function buildProductionPackets({
  contentPlan,
  requestTemplate,
  generatedAt = new Date().toISOString()
}) {
  assertReviewFirstContentPlan(contentPlan);
  const packets = {
    packageType: "social_studio_production_packets",
    generatedAt,
    campaignId: contentPlan.campaignId,
    campaignName: contentPlan.campaignName,
    status: "needs_review",
    safety: baseSafety(),
    assets: contentPlan.assets.map((asset) => buildAssetPacket(asset, contentPlan, requestTemplate))
  };
  packets.uiSummary = makeUiSummary(packets);
  packets.markdown = makeMarkdown(packets);
  return packets;
}

async function writeAssetFiles(outDir, packets) {
  for (const asset of packets.assets) {
    if (asset.packetType === "moneyprinter_video_request") {
      await mkdir(path.join(outDir, "moneyprinter"), { recursive: true });
      await writeFile(
        path.join(outDir, "moneyprinter", `${asset.assetId}.request.json`),
        `${JSON.stringify(asset.moneyprinterRequest, null, 2)}\n`
      );
    } else if (asset.packetType === "static_post_copy_brief") {
      await mkdir(path.join(outDir, "static-posts"), { recursive: true });
      await writeFile(
        path.join(outDir, "static-posts", `${asset.assetId}.copy.json`),
        `${JSON.stringify(asset.staticPost, null, 2)}\n`
      );
    }
  }
}

export async function buildProductionPacketsFromFiles({
  contentPlanPath,
  requestTemplatePath,
  outDir,
  generatedAt
}) {
  const packets = buildProductionPackets({
    contentPlan: JSON.parse(await readFile(contentPlanPath, "utf8")),
    requestTemplate: JSON.parse(await readFile(requestTemplatePath, "utf8")),
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "production-packets.json"), `${JSON.stringify(packets, null, 2)}\n`);
  await writeFile(path.join(outDir, "production-packets.ui.json"), `${JSON.stringify(packets.uiSummary, null, 2)}\n`);
  await writeFile(path.join(outDir, "production-packets.md"), packets.markdown);
  await writeAssetFiles(outDir, packets);

  return {
    status: packets.status,
    assetCount: packets.assets.length,
    jsonPath: path.join(outDir, "production-packets.json"),
    uiPath: path.join(outDir, "production-packets.ui.json"),
    markdownPath: path.join(outDir, "production-packets.md")
  };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const result = await buildProductionPacketsFromFiles({
    contentPlanPath: readArg("content-plan", path.join(generatedDir, "content-plan", "content-plan.json")),
    requestTemplatePath: readArg("request", path.join(studioRoot, "connectors", "moneyprinter", "request.example.json")),
    outDir: readArg("out-dir", path.join(generatedDir, "production-packets"))
  });

  console.log(`status=${result.status}`);
  console.log(`asset_count=${result.assetCount}`);
  console.log(`json=${result.jsonPath}`);
  console.log(`ui=${result.uiPath}`);
  console.log(`markdown=${result.markdownPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
