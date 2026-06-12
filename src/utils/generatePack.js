import { SAFETY_RULES } from "./safetyRules.js";
import { assertClaimSafe, findBlockedClaims } from "./claimGuard.js";

const DEFAULT_GENERATED_AT = "2026-06-04T00:00:00.000Z";

const clipBlueprints = [
  {
    duration: "8 seconds",
    action: "Open with the pain point while the product is visible nearby.",
    camera: "Handheld phone feel, slow push-in from the nail desk to the speaker",
    editFocus: "make the opening line more direct"
  },
  {
    duration: "8 seconds",
    action: "Show the frustrating moment or common mistake in a simple way.",
    camera: "Close-up on hands, product, and the nail surface, slightly shaky UGC feel",
    editFocus: "show more of the product"
  },
  {
    duration: "8 seconds",
    action: "Show the product as the practical fix and explain the key step.",
    camera: "Steady side angle with a clear hand movement, natural phone video",
    editFocus: "make the application step clearer"
  },
  {
    duration: "8 seconds",
    action: "Show the result and end with a clear next step.",
    camera: "Clean final close-up, then return to the speaker, casual handheld finish",
    editFocus: "make the final result brighter and neater"
  }
];

function stripTerminalPunctuation(value) {
  return value.replace(/[.!?]+$/g, "").trim();
}

function normaliseBrand(value) {
  return value
    .replace(/crystal\s*clawz/gi, "Crystal Clawz")
    .replace(/crystalclawz/gi, "Crystal Clawz")
    .replace(/rubber[-\s]?based/gi, "Rubber Base");
}

function cleanInput(value) {
  return stripTerminalPunctuation(normaliseBrand(String(value || "").trim()));
}

function lowerFirst(value) {
  if (!value) return "";
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function sentenceCase(value) {
  if (!value) return "";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function sentence(value) {
  const clean = cleanInput(value);
  return clean ? `${sentenceCase(clean)}.` : "";
}

function painPhrase(value) {
  const clean = cleanInput(value)
    .replace(/^the\s+/i, "your ")
    .replace(/^my\s+/i, "your ");
  return lowerFirst(clean || "your set is not lasting");
}

function toneLine(tone) {
  const lines = {
    "Warm & encouraging": "warm, calm, and practical",
    "Bold & direct": "direct, confident, and no-fluff",
    Educational: "clear, practical, and teaching-focused",
    "Hype/sale energy": "upbeat, useful, and still trustworthy"
  };
  return lines[tone] || "warm, direct, and useful";
}

function polishCta(rawCta, product) {
  const clean = cleanInput(rawCta);
  const hasUrl = /crystalclawz\.co\.za/i.test(rawCta || "");
  const lowerClean = clean.toLowerCase();
  const lowerProduct = product.name.toLowerCase();
  const safeFallback = `Shop ${product.name} at Crystal Clawz`;

  if (hasUrl) {
    return `Shop ${product.name} at crystalclawz.co.za`;
  }
  if (!clean) {
    return safeFallback;
  }
  // User-typed CTAs may carry unapproved claims; replace rather than echo them.
  if (findBlockedClaims(clean).length > 0) {
    return safeFallback;
  }
  if (
    lowerClean.includes("crystal clawz") &&
    !lowerClean.includes(lowerProduct)
  ) {
    return safeFallback;
  }
  if (!lowerClean.includes(lowerProduct)) {
    return `${sentenceCase(clean)} with ${product.name}`;
  }
  return sentenceCase(clean);
}

function makeSpokenLines(formState, polished) {
  const { product, videoType, tone } = formState;
  const pain = polished.pain;

  const benefitLine =
    product.benefits.filter(Boolean).slice(0, 2).join(" and ") ||
    "supports clean, practical salon work";

  const baseLines = [
    `If ${pain}, this is where I would start.`,
    "Most lifting issues come from prep, product control, or the layer being too thick.",
    `${product.name} helps because it ${benefitLine}.`,
    `${polished.cta}. Save this for your next set.`
  ];

  if (tone === "Educational") {
    baseLines[0] = `If ${pain}, check the foundation before you blame the colour.`;
    baseLines[2] = `With ${product.name}, the key is thin layers, clean prep, and proper control.`;
  }

  if (tone === "Bold & direct") {
    baseLines[0] = `If ${pain}, do not ignore your prep.`;
    baseLines[3] = `${polished.cta}. Get your prep right before the next set.`;
  }

  if (tone === "Hype/sale energy") {
    baseLines[0] = `If ${pain}, this is your sign to fix it properly.`;
  }

  if (videoType.id === "training-confidence") {
    baseLines[0] = `If ${pain}, you are not failing - you need a clearer method.`;
  }

  return baseLines;
}

function makeClipScript(formState, polished) {
  const { product, scene } = formState;
  const spokenLines = makeSpokenLines(formState, polished);

  return clipBlueprints.map((clip, index) => ({
    clipNumber: index + 1,
    duration: clip.duration,
    action: clip.action,
    spokenLine: spokenLines[index],
    visualNote:
      index === 0
        ? `${scene.visualDescription}. Keep ${product.name} visible without making the shot feel like a hard sell.`
        : index === 1
          ? `Show the problem clearly: ${polished.pain}. Keep the shot simple and realistic.`
          : index === 2
            ? `Show ${product.name} being used neatly with a clear view of the amount and texture.`
            : "Show a clean finished result with the product still visible.",
    referenceAssetNote:
      index === 0
        ? product.referenceAssetHint
        : index === 1
          ? scene.referenceAssetHint
          : index === 2
            ? product.productVisibilityNote
            : "Use the same product, person, and setup so the clip feels continuous."
  }));
}

function makeAssetNames({ product }) {
  return {
    avatar: "@jenn_avatar",
    product: `@${product.id}`,
    scene: "@scene_reference",
    avatarLabel: "Jenn / educator style reference",
    productLabel: `${product.name} product reference`,
    sceneLabel: "Scene reference"
  };
}

function imageToolInstruction(imageGenerator) {
  const instructions = {
    "google-imagen":
      "Create a clean, realistic commercial reference image with natural lighting and clear product visibility.",
    "nano-banana":
      "Create a realistic UGC-style reference image with simple natural detail, not an over-styled studio look.",
    "gemini-image":
      "Create a realistic reference image that can be reused later in Flow / Gemini Agent Mode.",
    "generic-image":
      "Create a realistic reference image suitable for upload into a video generation workflow."
  };
  return instructions[imageGenerator?.id] || instructions["generic-image"];
}

function makeReferenceAssetPrompts(formState, assetNames) {
  const { product, scene, avatar, tone, imageGenerator } = formState;
  const generatorName = imageGenerator?.name || "Any image tool";
  const generatorPromptName = imageGenerator?.promptName || "Image prompt";
  const toolInstruction = imageToolInstruction(imageGenerator);
  const avatarDescription = lowerFirst(avatar.flowAvatarPromptHint);

  return [
    {
      id: "avatar-image",
      title: "Jenn avatar image",
      generator: generatorName,
      promptType: generatorPromptName,
      assetName: assetNames.avatar,
      useIn: `Create this in ${generatorName}, then upload it to Flow as Jenn's avatar reference.`,
      prompt: `${toolInstruction} Vertical 9:16 iPhone-style image of ${avatarDescription}. She looks like a real South African nail educator, ${toneLine(tone)}, natural expression, candid but neat, no celebrity likeness, no brand logos on clothing.`
    },
    {
      id: "product-image",
      title: "Product image",
      generator: generatorName,
      promptType: generatorPromptName,
      assetName: assetNames.product,
      useIn: `Create this in ${generatorName}, then upload it to Flow as the product reference.`,
      prompt: `${toolInstruction} Vertical 9:16 product reference image for ${product.name} on a ${scene.name.toLowerCase()} setup. The product is clear and central, salon lighting, practical UGC style, no competitor branding, no copied packaging style, no fake official label.`
    },
    {
      id: "scene-image",
      title: "Scene image",
      generator: generatorName,
      promptType: generatorPromptName,
      assetName: assetNames.scene,
      useIn: `Create this in ${generatorName}, then upload it to Flow as the scene reference.`,
      prompt: `${toolInstruction} Vertical 9:16 scene reference image of ${scene.visualDescription}. ${scene.lightingNote}. Natural South African salon content feel, tidy but real, no people in frame, leave space for ${product.name}.`
    }
  ];
}

function makeFlowSetupChecklist(assetNames, imageGenerator) {
  const generatorName = imageGenerator?.name || "your image generator";
  return [
    `Create the Jenn avatar, product, and scene images in ${generatorName}`,
    "Download the three generated images",
    "Open Google Flow and create a new project for this campaign",
    `Upload the generated Jenn avatar image as ${assetNames.avatar}`,
    `Upload the generated product image as ${assetNames.product}`,
    `Upload the generated scene image as ${assetNames.scene}`,
    "Switch to Gemini / Agent Mode before generating clips",
    "Turn on confirm before generating so credits are not spent by accident",
    `In each clip prompt, tag ${assetNames.avatar} and ${assetNames.product}`,
    "Generate one clip at a time and keep the same conversation open"
  ];
}

function makeAgentModePrompts(formState, clipScript, assetNames) {
  const { product, scene, avatar, tone } = formState;

  return clipScript.map((clip, index) => ({
    clip: clip.clipNumber,
    title: index === 0 ? "Initial Flow / Gemini prompt" : `Agent Mode follow-up clip ${clip.clipNumber}`,
    prompt:
      index === 0
        ? `Create a vertical UGC video, ${clip.duration}. Use ${assetNames.avatar} as Jenn and ${assetNames.product} as the product reference. She is in a ${scene.name.toLowerCase()} setup: ${scene.visualDescription}. ${clip.action} She speaks directly to the lens with a handheld iPhone feel, soft natural light, slightly candid movement. Spoken line: "${clip.spokenLine}" Keep her style: ${avatar.style} Tone: ${toneLine(tone)}. ${product.productVisibilityNote}.`
        : `Jenn continues in the same Flow conversation. Use ${assetNames.avatar} and ${assetNames.product}. Same woman, same ${scene.name.toLowerCase()}, same handheld UGC style. ${clip.action} Spoken line: "${clip.spokenLine}" Keep continuity from the previous clip and keep ${product.name} recognisable.`,
    editingPrompt: `Keep everything the same, including ${assetNames.avatar}, ${assetNames.product}, the voice, framing, and timing, but ${clipBlueprints[index].editFocus}.`
  }));
}

function makeFallbackPrompts(formState, clipScript, assetNames) {
  const { product, scene, avatar } = formState;

  return clipScript.map((clip, index) => ({
    clip: clip.clipNumber,
    platform: "Seedance-style fallback",
    prompt: [
      `Scene: ${scene.visualDescription}`,
      `Reference assets: use the same Jenn avatar as ${assetNames.avatar}; use ${product.name} as the product reference`,
      `Avatar: ${avatar.style}`,
      `Action: ${clip.action}`,
      `Camera movement: ${clipBlueprints[index].camera}`,
      `Lighting: ${scene.lightingNote}`,
      `Spoken line: ${clip.spokenLine}`,
      `Product visibility: ${product.productVisibilityNote}`,
      "Commercial safety note: use original Crystal Clawz assets only. No celebrity likeness, competitor brand, or implied public figure endorsement."
    ].join("\n")
  }));
}

function makeHooks({ product, videoType, audience }, polished) {
  const pain = polished.pain;
  const who = audience || product.targetAudience;

  return [
    `If ${pain}, watch this before your next set.`,
    `${who}, this ${product.name} tip will save you a lot of frustration.`,
    `Still battling with ${pain}? Start with your foundation.`,
    `${product.name} is not just another product - it is built for everyday salon work.`,
    `${videoType.name} idea: show the problem, show the fix, then show the result.`
  ];
}

function makePolishedInputs(formState) {
  return {
    campaignName: cleanInput(formState.campaignName),
    audience: cleanInput(formState.audience),
    pain: painPhrase(formState.painPoint),
    painOriginal: cleanInput(formState.painPoint),
    cta: polishCta(formState.cta, formState.product)
  };
}

export function generatePack(formState) {
  const polished = makePolishedInputs(formState);
  const clipScript = makeClipScript(formState, polished);
  const assetNames = makeAssetNames(formState);
  const referenceAssetPrompts = makeReferenceAssetPrompts(formState, assetNames);
  const flowSetupChecklist = makeFlowSetupChecklist(
    assetNames,
    formState.imageGenerator
  );
  const agentModePrompts = makeAgentModePrompts(
    formState,
    clipScript,
    assetNames
  );
  const fallbackPrompts = makeFallbackPrompts(formState, clipScript, assetNames);

  const pack = {
    meta: {
      campaignName: polished.campaignName,
      product: formState.product.name,
      videoType: formState.videoType.name,
      scene: formState.scene.name,
      avatar: formState.avatar.name,
      engine: formState.engine.name,
      imageGenerator: formState.imageGenerator?.name || "Any image tool",
      tone: formState.tone,
      cta: polished.cta,
      audience: polished.audience,
      painPoint: sentence(polished.pain),
      generatedAt: formState.generatedAt || DEFAULT_GENERATED_AT
    },
    workflowSummary:
      "Create Jenn avatar, product, and scene images first, upload them into one Google Flow project, tag assets in Gemini Agent Mode, generate one clip at a time, then edit clips conversationally.",
    assetNames,
    referenceAssetPrompts,
    flowSetupChecklist,
    hooks: makeHooks(formState, polished),
    clipScript,
    agentModePrompts,
    fallbackPrompts,
    editingPrompts: [
      `Keep everything the same, including ${assetNames.avatar} and ${assetNames.product}, but make ${formState.product.name} more visible in the first two clips.`,
      "Keep everything exactly the same, but make Jenn's spoken line simpler and more natural for South African nail techs.",
      "Keep everything exactly the same, but change only the background detail or clothing colour requested. Do not change Jenn, the product, voice, or product reference."
    ],
    caption: `${formState.product.name} for nail techs who want clean, salon-ready sets`,
    cta: polished.cta,
    assetChecklist: [
      `${formState.imageGenerator?.name || "Image generator"} Jenn avatar image created and uploaded as ${assetNames.avatar}`,
      `${formState.imageGenerator?.name || "Image generator"} product image created and uploaded as ${assetNames.product}`,
      `${formState.imageGenerator?.name || "Image generator"} scene image created and uploaded as ${assetNames.scene}`,
      "Confirm before generating is enabled in Flow",
      "All clips are generated inside the same Flow project conversation"
    ],
    safetyChecklist: SAFETY_RULES
  };

  // Final boundary check: nothing leaves the generator with a blocked claim,
  // including claims smuggled in through user-typed brief fields.
  assertClaimSafe(pack, "UGC workflow pack");
  return pack;
}
