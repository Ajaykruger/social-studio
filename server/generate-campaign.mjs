// Claim-guarded creative generation for Crystal Clawz campaigns.
//
// Two generation paths produce the same pack shape:
//   - Claude (claude-opus-4-8, structured output) when ANTHROPIC_API_KEY is set
//   - deterministic templates otherwise (free, offline)
// Both paths are forced through the claim guard: the ONE approved benefit the
// human picked is the only product claim allowed, and the blocked claim
// families (long-lasting, non-lift, chip-proof, strengthening, repair/health,
// guarantees) are rejected no matter which path produced the text.

import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import {
  assertClaimSafe,
  findBlockedClaims,
  findBlockedClaimsInObject
} from "../src/utils/claimGuard.js";
import { assertAllowedProductUrl, slugify } from "./product-import.mjs";

const GENERATION_MODEL = "claude-opus-4-8";

const TONES = {
  "Warm & encouraging": "warm, calm, and practical",
  "Bold & direct": "direct, confident, and no-fluff",
  Educational: "clear, practical, and teaching-focused"
};

function cleanBrief(brief = {}) {
  const approvedBenefit = String(brief.approvedBenefit || "").trim();
  if (approvedBenefit.length < 3) {
    throw new Error("an approved benefit is required before generating");
  }
  const benefitFindings = findBlockedClaims(approvedBenefit);
  if (benefitFindings.length > 0) {
    throw new Error(
      `the approved benefit itself is a blocked claim family (${benefitFindings[0].label}); pick a product-page benefit like "smooth base"`
    );
  }
  return {
    contentType: brief.contentType === "reel_and_post" ? "reel_and_post" : "post",
    audience: String(brief.audience || "South African nail technicians").trim(),
    angle: String(brief.angle || "").trim(),
    approvedBenefit,
    cta: String(brief.cta || "").trim(),
    tone: TONES[brief.tone] ? brief.tone : "Warm & encouraging"
  };
}

// ---------------------------------------------------------------------------
// Template path (offline fallback)
// ---------------------------------------------------------------------------

function generateWithTemplates({ product, brief }) {
  const name = product.name;
  const benefit = brief.approvedBenefit;
  const cta = brief.cta || `Shop ${name} at crystalclawz.co.za`;
  const audience = brief.audience;

  return {
    hooks: [
      `${audience}: this is how ${name} fits into a clean set.`,
      `Watch how ${name} gives a ${benefit} before colour.`,
      `One product, one job: ${benefit}. Here is ${name}.`
    ],
    captions: [
      `${benefit.charAt(0).toUpperCase()}${benefit.slice(1)} for cleaner salon work. ${cta}.`,
      `${name} helps with ${benefit}. ${cta}.`,
      `Start every set with a ${benefit}. ${name} from Crystal Clawz. ${cta}.`
    ],
    hashtags: ["#CrystalClawz", "#NailTechSA", `#${name.replace(/[^A-Za-z0-9]/g, "")}`, "#SalonReady"],
    cta,
    reelScript: [
      { seconds: 3, visual: `${name} bottle close-up on the salon desk, label readable.`, voiceover: `If your base is not working with you, start here.` },
      { seconds: 5, visual: "Prepped natural nail, brush loading product.", voiceover: `${name} is applied in thin, controlled layers.` },
      { seconds: 5, visual: `Smooth application stroke, product self-levelling.`, voiceover: `The job here is one thing: a ${benefit} before your colour or French work.` },
      { seconds: 4, visual: "Finished base coat under the lamp, clean and even.", voiceover: `${cta}.` }
    ],
    normalPost: {
      headline: name,
      body: `${name} helps with ${benefit}.`,
      cta
    }
  };
}

// ---------------------------------------------------------------------------
// Claude path
// ---------------------------------------------------------------------------

const PACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hooks", "captions", "hashtags", "cta", "reelScript", "normalPost"],
  properties: {
    hooks: { type: "array", items: { type: "string" } },
    captions: { type: "array", items: { type: "string" } },
    hashtags: { type: "array", items: { type: "string" } },
    cta: { type: "string" },
    reelScript: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["seconds", "visual", "voiceover"],
        properties: {
          seconds: { type: "integer" },
          visual: { type: "string" },
          voiceover: { type: "string" }
        }
      }
    },
    normalPost: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "body", "cta"],
      properties: {
        headline: { type: "string" },
        body: { type: "string" },
        cta: { type: "string" }
      }
    }
  }
};

function claudeSystemPrompt() {
  return [
    "You write social media content for Crystal Clawz, a South African nail product brand.",
    "Audience: South African nail technicians, salon owners, and students.",
    "Voice: friendly, professional, practical, and clear. No hype, no invented testimonials.",
    "",
    "CLAIM RULES (these override everything else):",
    "- The ONLY product benefit you may state is the approved benefit given in the request, in its own wording.",
    "- NEVER claim: long-lasting or durability, prevents/stops lifting, chip-proof or no-chip, strengthening or stronger nails, repair/heal/nail health or damage prevention, guaranteed or perfect results, or that the product fixes problems.",
    "- You may describe technique (prep, thin layers, control) and what is visible on screen.",
    "- Every caption ends with the call to action.",
    "- Hashtags start with # and contain no spaces.",
    "- Reel script: 4-6 scenes, 15-25 seconds total, voiceover lines spoken-word natural."
  ].join("\n");
}

async function generateWithClaude({ product, brief, apiKey }) {
  const client = new Anthropic({ apiKey });
  const request = [
    `Product: ${product.name}`,
    `Product page (approved claim source): ${product.sourceUrl || "n/a"}`,
    product.description ? `Product page description (reference only, do not copy claims from it): ${product.description.slice(0, 600)}` : "",
    `Approved benefit (the only claim allowed): ${brief.approvedBenefit}`,
    `Audience: ${brief.audience}`,
    brief.angle ? `Angle / pain point: ${brief.angle}` : "",
    `Tone: ${TONES[brief.tone]}`,
    brief.cta ? `Call to action: ${brief.cta}` : `Call to action: Shop ${product.name} at crystalclawz.co.za`,
    `Content needed: ${brief.contentType === "reel_and_post" ? "a vertical reel script plus a static post" : "a static post (still include a reel script for later use)"}`,
    "",
    "Produce 3 hooks, 3 caption options, 4-6 hashtags, the CTA, the reel script, and the static post copy."
  ].filter(Boolean).join("\n");

  const response = await client.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: claudeSystemPrompt(),
    output_config: { format: { type: "json_schema", schema: PACK_SCHEMA } },
    messages: [{ role: "user", content: request }]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude returned no text content");
  }
  return JSON.parse(textBlock.text);
}

// ---------------------------------------------------------------------------
// Public generation entry point
// ---------------------------------------------------------------------------

export async function generateCreativePack({
  product,
  brief,
  apiKey = process.env.ANTHROPIC_API_KEY
}) {
  if (!product?.name) {
    throw new Error("a product (with a name) is required");
  }
  const cleanedBrief = cleanBrief(brief);

  let pack;
  let generator;
  let generatorNote = "";

  if (apiKey) {
    try {
      pack = await generateWithClaude({ product, brief: cleanedBrief, apiKey });
      generator = "claude";
      const findings = findBlockedClaimsInObject(pack);
      if (findings.length > 0) {
        // One retry with the violations spelled out, then fall back.
        generatorNote = `claude draft contained blocked claims (${findings
          .map((finding) => finding.match)
          .join(", ")}); regenerated`;
        pack = await generateWithClaude({
          product,
          brief: {
            ...cleanedBrief,
            angle: `${cleanedBrief.angle} IMPORTANT: your previous draft was rejected for these blocked phrases: ${findings
              .map((finding) => `"${finding.match}"`)
              .join(", ")}. Do not use them or anything similar.`
          },
          apiKey
        });
      }
    } catch (error) {
      generator = "template";
      generatorNote = `claude generation unavailable (${error.message}); used templates`;
      pack = generateWithTemplates({ product, brief: cleanedBrief });
    }
  } else {
    generator = "template";
    pack = generateWithTemplates({ product, brief: cleanedBrief });
  }

  // Hard boundary: nothing leaves generation with a blocked claim.
  assertClaimSafe(pack, "generated creative pack");

  return {
    generator,
    generatorNote,
    model: generator === "claude" ? GENERATION_MODEL : "",
    brief: cleanedBrief,
    product: {
      id: product.id || slugify(product.name),
      name: product.name,
      sourceUrl: product.sourceUrl || "",
      image: product.images?.[0] || ""
    },
    pack
  };
}

// ---------------------------------------------------------------------------
// Campaign writer - turns an accepted pack into review-ready artifacts
// ---------------------------------------------------------------------------

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapSvgText(text, maxChars) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function normalPostSvg({ headline, body, cta, benefit }) {
  const bodyLines = wrapSvgText(body, 44);
  const bodyTspans = bodyLines
    .map(
      (line, index) =>
        `<tspan x="96" dy="${index === 0 ? 0 : 46}">${xmlEscape(line)}</tspan>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="${xmlEscape(headline)} normal post draft">
  <rect width="1080" height="1080" fill="#f8fafc"/>
  <rect x="64" y="64" width="952" height="952" rx="28" fill="#ffffff" stroke="#0f766e" stroke-width="8"/>
  <rect x="96" y="96" width="888" height="156" rx="18" fill="#0f766e"/>
  <text x="138" y="176" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Crystal Clawz</text>
  <text x="138" y="220" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#ccfbf1">Draft for human review</text>
  <text x="96" y="374" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800" fill="#0f172a">${xmlEscape(headline.slice(0, 26))}</text>
  <rect x="96" y="432" width="540" height="104" rx="16" fill="#f0fdfa" stroke="#14b8a6" stroke-width="4"/>
  <text x="130" y="496" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="800" fill="#134e4a">${xmlEscape(benefit.slice(0, 24))}</text>
  <text x="96" y="628" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#334155">${bodyTspans}</text>
  <rect x="96" y="846" width="700" height="86" rx="16" fill="#ec4899"/>
  <text x="130" y="901" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="800" fill="#ffffff">${xmlEscape(cta.slice(0, 44))}</text>
  <text x="96" y="988" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#64748b">Review before Postiz. Scheduling and publishing are off.</text>
</svg>
`;
}

async function nextCampaignId(generatedRoot, productId) {
  const today = new Date().toISOString().slice(0, 10);
  const base = `cc-${productId}-${today}`;
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    try {
      await readFile(path.join(generatedRoot, candidate, "draft-bundle.json"));
    } catch {
      return candidate;
    }
  }
  throw new Error("could not allocate a campaign id");
}

export async function createCampaign({
  workspaceRoot,
  product,
  brief,
  pack,
  selectedCaptionIndex = 0,
  generator = "unknown",
  generatedAt = new Date().toISOString()
}) {
  if (product?.sourceUrl) {
    assertAllowedProductUrl(product.sourceUrl);
  }
  const cleanedBrief = cleanBrief(brief);

  // The pack may have come back from the browser - re-check the boundary.
  assertClaimSafe(pack, "submitted creative pack");
  assertClaimSafe(product?.name || "", "product name");

  const captions = Array.isArray(pack.captions) ? pack.captions : [];
  const caption = String(
    captions[selectedCaptionIndex] || captions[0] || ""
  ).trim();
  if (!caption) {
    throw new Error("a caption is required");
  }
  const hashtags = (pack.hashtags || [])
    .map((tag) => String(tag).trim())
    .filter((tag) => /^#[A-Za-z0-9_]+$/.test(tag))
    .slice(0, 8);

  const generatedRoot = path.join(workspaceRoot, "social-studio", "generated");
  const productId = slugify(product.name);
  const campaignId = await nextCampaignId(generatedRoot, productId);
  const campaignDir = path.join(generatedRoot, campaignId);
  const reviewDir = path.join(
    workspaceRoot,
    "public",
    "social-studio",
    campaignId,
    "review"
  );
  await mkdir(campaignDir, { recursive: true });
  await mkdir(path.join(campaignDir, "review-board"), { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  const includeReel = cleanedBrief.contentType === "reel_and_post";
  const assetId = `${campaignId}-draft-001`;
  const postFileName = "normal-post-01.svg";
  const postPublicUrl = `/social-studio/${campaignId}/review/${postFileName}`;
  const postWorkspacePath = `public/social-studio/${campaignId}/review/${postFileName}`;

  await writeFile(
    path.join(reviewDir, postFileName),
    normalPostSvg({
      headline: pack.normalPost?.headline || product.name,
      body: pack.normalPost?.body || caption,
      cta: pack.normalPost?.cta || pack.cta || "",
      benefit: cleanedBrief.approvedBenefit
    })
  );

  const requiredContentTypes = includeReel
    ? ["ugc_video", "normal_post"]
    : ["normal_post"];

  const bundle = {
    campaignId,
    assetId,
    generatedAt,
    createdBy: "create-screen",
    generator,
    brief: cleanedBrief,
    product: {
      id: productId,
      name: product.name,
      sourceUrl: product.sourceUrl || ""
    },
    creative: {
      hooks: pack.hooks || [],
      captions,
      selectedCaptionIndex,
      reelScript: pack.reelScript || [],
      normalPost: pack.normalPost || null
    },
    reviewStatus: {
      campaignId,
      assetId,
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
      notes:
        "Draft created from the Create screen. Human reviewer must approve for Postiz draft upload only.",
      approval: { approvedBy: "", approvedAt: "", approvalEvidence: "" }
    },
    postizHandoff: {
      campaignId,
      assetId,
      handoffMode: "manual_upload",
      platforms: ["instagram", "facebook", "tiktok"],
      requiredContentTypes,
      media: {
        localPath: postWorkspacePath,
        thumbnailPath: "",
        mediaType: "image",
        aspectRatio: "1:1"
      },
      caption,
      hashtags,
      scheduledFor: "",
      status: "needs_review",
      review: {
        approvedBy: "pending-human-review",
        approvedAt: "",
        notLiveConfirmed: true,
        notes: "Draft only. Do not upload or schedule until approved."
      }
    }
  };

  const reviewBoard = {
    packageType: "social_studio_review_board",
    campaignId,
    status: "needs_review",
    items: [
      {
        assetId: `${campaignId}-normal-post-01`,
        label: "Normal post",
        contentType: "normal_post",
        reviewAction: "review_decision_required",
        media: {
          localPath: "",
          videoUrl: "",
          imageUrl: postPublicUrl,
          contactSheetUrl: ""
        },
        postiz: { publishAllowed: false }
      },
      ...(includeReel
        ? [
            {
              assetId: `${campaignId}-ugc-video-01`,
              label: "Reel",
              contentType: "ugc_video",
              reviewAction: "produce_before_review",
              media: { localPath: "", videoUrl: "", imageUrl: "", contactSheetUrl: "" },
              postiz: { publishAllowed: false }
            }
          ]
        : [])
    ]
  };

  const workflowStatusUi = {
    campaignId,
    status: "needs_review",
    statusLabel: "Needs review",
    freshness: {
      generatedAt,
      sourceGeneratedAt: generatedAt,
      sourceBundle: "draft-bundle.json",
      generatedPath: `social-studio/generated/${campaignId}`
    },
    noLivePosting: true,
    postizDraftReady: false,
    scheduleOrPublishReady: false,
    stages: [
      { name: "Create", status: "ready", label: `Creative pack generated (${generator}).` },
      includeReel
        ? { name: "Reel render", status: "blocked", label: "Reel render is pending. Approval stays blocked until the reel is attached." }
        : null,
      { name: "Review", status: "blocked", label: "Human review is still required." },
      { name: "Postiz", status: "blocked", label: "Postiz stays blocked until approval." }
    ].filter(Boolean),
    blocker: includeReel
      ? "Reel render and human review are required before Postiz draft creation."
      : "Human review approval is required before Postiz draft creation.",
    nextAction: "Review the draft and record approve, needs_revision, or reject."
  };

  const reviewPacketUi = {
    campaignId,
    assetId,
    status: "needs_review",
    statusLabel: "Needs review",
    decisionRequired: true,
    notLiveConfirmed: true,
    scheduleOrPublishReady: false,
    videoUrl: "",
    contactSheetUrl: "",
    thumbnailUrl: "",
    caption,
    hashtags,
    visualReviewSummary: includeReel
      ? "Static post draft is ready below. The reel script is written; its video render is still pending, so approval stays blocked until it is attached."
      : "Static post draft generated from the Create screen.",
    nextAction: "Review the draft, then record approve, needs_revision, or reject.",
    assets: [
      {
        assetId: `${campaignId}-normal-post-01`,
        label: "Normal post",
        contentType: "normal_post",
        assetUrl: postPublicUrl,
        contactSheetUrl: ""
      },
      ...(includeReel
        ? [
            {
              assetId: `${campaignId}-ugc-video-01`,
              label: "Reel (render pending)",
              contentType: "ugc_video",
              assetUrl: "",
              contactSheetUrl: ""
            }
          ]
        : [])
    ]
  };

  await writeFile(
    path.join(campaignDir, "draft-bundle.json"),
    `${JSON.stringify(bundle, null, 2)}\n`
  );
  await writeFile(
    path.join(campaignDir, "review-board", "review-board.json"),
    `${JSON.stringify(reviewBoard, null, 2)}\n`
  );
  await writeFile(
    path.join(campaignDir, "workflow-status.ui.json"),
    `${JSON.stringify(workflowStatusUi, null, 2)}\n`
  );
  await mkdir(path.join(campaignDir, "review-packet"), { recursive: true });
  await writeFile(
    path.join(campaignDir, "review-packet", "review-packet.ui.json"),
    `${JSON.stringify(reviewPacketUi, null, 2)}\n`
  );

  if (includeReel) {
    const reelRequest = {
      video_subject: `${product.name} for ${cleanedBrief.audience}`,
      video_script: (pack.reelScript || [])
        .map((scene) => scene.voiceover)
        .join(" "),
      video_aspect: "9:16",
      video_source: "local",
      video_count: 1,
      video_clip_duration: 5,
      voice_name: "",
      subtitle_enabled: true,
      note: "Submit to local MoneyPrinterTurbo with social-studio/connectors/moneyprinter/submit-moneyprinter-draft.mjs, then attach the rendered MP4 to this campaign's review board."
    };
    await writeFile(
      path.join(campaignDir, "moneyprinter-request.json"),
      `${JSON.stringify(reelRequest, null, 2)}\n`
    );
  }

  const auditDir = path.join(workspaceRoot, "social-studio", "audit");
  await mkdir(auditDir, { recursive: true });
  await appendFile(
    path.join(auditDir, `${campaignId}.decisions.jsonl`),
    `${JSON.stringify({
      at: generatedAt,
      campaignId,
      event: "campaign_created",
      generator,
      contentType: cleanedBrief.contentType,
      approvedBenefit: cleanedBrief.approvedBenefit,
      productSourceUrl: product.sourceUrl || "",
      allowsSchedulingOrPublishing: false
    })}\n`
  );

  return {
    campaignId,
    includeReel,
    postUrl: postPublicUrl,
    requiredContentTypes
  };
}
