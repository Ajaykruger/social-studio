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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function commandSetIsSafe(decisionCommands) {
  return Boolean(decisionCommands?.commandOnly === true && decisionCommands?.liveActionsEnabled === false);
}

function statusFor({ reviewPacket, decisionCommands }) {
  if (
    reviewPacket?.decisionRequired === true &&
    reviewPacket?.notLiveConfirmed === true &&
    reviewPacket?.scheduleOrPublishReady === false &&
    decisionCommands?.status === "needs_review" &&
    commandSetIsSafe(decisionCommands)
  ) {
    return "awaiting_human_decision";
  }
  return "blocked";
}

function summarizeBlockedRequirement(completionAudit) {
  return (completionAudit?.requirements || []).find((requirement) => requirement.status === "blocked") || null;
}

function makeDecisionCommands(decisionCommands) {
  return (decisionCommands?.commands || []).map((command) => ({
    decision: command.decision,
    label: command.label,
    resultStatus: command.resultStatus,
    effect: command.effect || null,
    evidenceChecklist: Array.isArray(command.evidenceChecklist) ? command.evidenceChecklist : [],
    requiresNoteEdit: command.requiresNoteEdit === true,
    copyEnabled: command.copyEnabled !== false,
    noteGuidance: command.noteGuidance || "",
    command: command.command
  }));
}

function requirementIsComplete(completionAudit, id) {
  return (completionAudit?.requirements || []).some(
    (requirement) => requirement.id === id && requirement.status === "complete"
  );
}

function makeReviewChecks({ reviewPacket, brandClaimLedger, decisionCommands }) {
  const brandAssets = Array.isArray(brandClaimLedger?.assets) ? brandClaimLedger.assets : [];
  const contentTypes = Array.from(new Set(brandAssets.map((asset) => asset.contentType).filter(Boolean)));
  return {
    notLiveConfirmed: reviewPacket?.notLiveConfirmed === true,
    scheduleOrPublishReady: reviewPacket?.scheduleOrPublishReady === true,
    publishAllowed: Number(brandClaimLedger?.summary?.publishAllowed || 0),
    claimCheckRequired: Number(brandClaimLedger?.summary?.assetsNeedingHumanClaimCheck || 0) > 0,
    brandRules: Array.isArray(brandClaimLedger?.brandRules) ? brandClaimLedger.brandRules.length : 0,
    contentTypes,
    decisionCommandsReady: commandSetIsSafe(decisionCommands)
  };
}

function makeMedia(reviewPacket) {
  return {
    videoUrl: reviewPacket?.videoUrl || "",
    contactSheetUrl: reviewPacket?.contactSheetUrl || "",
    thumbnailUrl: reviewPacket?.thumbnailUrl || "",
    caption: reviewPacket?.caption || "",
    hashtags: Array.isArray(reviewPacket?.hashtags) ? reviewPacket.hashtags : [],
    visualReviewSummary: reviewPacket?.visualReviewSummary || ""
  };
}

function makeReviewAssets({ reviewBoard, reviewPacket }) {
  const boardItems = Array.isArray(reviewBoard?.items) ? reviewBoard.items : [];
  const reviewAssets = boardItems
    .filter((item) => item.reviewAction === "review_decision_required")
    .map((item) => ({
      assetId: item.assetId,
      label: item.label,
      contentType: item.contentType,
      assetUrl: item.videoUrl || item.imageUrl || "",
      videoUrl: item.videoUrl || "",
      imageUrl: item.imageUrl || "",
      contactSheetUrl: item.contactSheetUrl || "",
      decisionCount: Number(item.decisionCount || 0),
      publishAllowed: Boolean(item.publishAllowed)
    }))
    .filter((item) => item.assetUrl);

  if (reviewAssets.length > 0) {
    return reviewAssets;
  }

  return reviewPacket?.videoUrl
    ? [
        {
          assetId: reviewPacket.assetId || "",
          label: "UGC video",
          contentType: "ugc_video",
          assetUrl: reviewPacket.videoUrl,
          videoUrl: reviewPacket.videoUrl,
          imageUrl: "",
          contactSheetUrl: reviewPacket.contactSheetUrl || "",
          decisionCount: 3,
          publishAllowed: false
        }
      ]
    : [];
}

function packetByAssetId(productionPackets) {
  return new Map(
    (Array.isArray(productionPackets?.assets) ? productionPackets.assets : [])
      .filter((asset) => asset?.assetId)
      .map((asset) => [asset.assetId, asset])
  );
}

function evidenceLabelForImage(asset) {
  return asset.contentType === "paid_ad_video" ? "Storyboard" : "Image";
}

function compactSummary(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function makeReviewEvidence(asset, packet = null) {
  const evidence = [];
  if (asset.videoUrl) {
    evidence.push({ type: "media", label: "Video", url: asset.videoUrl });
  }
  if (asset.contactSheetUrl) {
    evidence.push({ type: "media", label: "Contact sheet", url: asset.contactSheetUrl });
  }
  if (asset.imageUrl) {
    evidence.push({ type: "media", label: evidenceLabelForImage(asset), url: asset.imageUrl });
  }
  if (packet?.moneyprinterRequest?.video_script_prompt) {
    evidence.push({
      type: "prompt",
      label: "MoneyPrinter prompt",
      summary: compactSummary(packet.moneyprinterRequest.video_script_prompt)
    });
  }
  if (packet?.staticPost?.captionDraft) {
    evidence.push({
      type: "copy",
      label: "Caption draft",
      summary: compactSummary(packet.staticPost.captionDraft)
    });
  }
  if (packet?.staticPost?.designBrief) {
    evidence.push({
      type: "brief",
      label: "Design brief",
      summary: compactSummary(packet.staticPost.designBrief)
    });
  }
  if (Array.isArray(packet?.review?.focus) && packet.review.focus.length > 0) {
    evidence.push({
      type: "checklist",
      label: "Review focus",
      checks: packet.review.focus
    });
  }
  return evidence;
}

function makeApprovalChecklist(reviewAssets, productionPackets = null) {
  const packetsByAsset = packetByAssetId(productionPackets);
  return reviewAssets.map((asset) => ({
    assetId: asset.assetId,
    label: asset.label,
    contentType: asset.contentType,
    assetUrl: asset.assetUrl,
    prompt: `Approve or request changes for ${asset.label}.`,
    reviewEvidence: makeReviewEvidence(asset, packetsByAsset.get(asset.assetId)),
    requiredChecks: [
      "Open and review the asset.",
      "Confirm asset is not live or scheduled.",
      "Confirm only approved brand and product claims are used.",
      "Confirm the right decision command will be copied."
    ]
  }));
}

function readyCheck(id, label, ready) {
  return {
    id,
    label,
    status: ready ? "ready" : "blocked"
  };
}

function makeDecisionReadiness({ approvalChecklist, reviewChecks }) {
  const items = approvalChecklist.map((item) => {
    const checks = [
      readyCheck("review_media", "Review media", Boolean(item.assetUrl)),
      readyCheck("review_evidence", "Review evidence", Array.isArray(item.reviewEvidence) && item.reviewEvidence.length > 0),
      readyCheck("decision_commands", "Decision commands", Boolean(reviewChecks.decisionCommandsReady)),
      readyCheck("publish_blocked", "Publish blocked", Number(reviewChecks.publishAllowed || 0) === 0),
      readyCheck("not_live_proof", "Not-live proof", Boolean(reviewChecks.notLiveConfirmed && reviewChecks.rollbackNotLiveProofReady))
    ];
    const blockedChecks = checks.filter((check) => check.status !== "ready");
    return {
      assetId: item.assetId,
      label: item.label,
      contentType: item.contentType,
      status: blockedChecks.length === 0 ? "ready" : "blocked",
      checks
    };
  });
  const readyAssets = items.filter((item) => item.status === "ready").length;
  return {
    status: readyAssets === items.length && items.length > 0 ? "ready_for_human_decision" : "blocked",
    summary: {
      totalAssets: items.length,
      readyAssets,
      blockedAssets: items.length - readyAssets
    },
    items
  };
}

function makeApprovalEvidenceSummary({ approvalChecklist, reviewChecks, decisionCommands, decisionIntake }) {
  const approveCommand = (decisionCommands?.commands || []).find((command) => command.decision === "approve");
  const checklist = Array.isArray(approveCommand?.evidenceChecklist) ? approveCommand.evidenceChecklist : [];
  const assetsByType = new Map(approvalChecklist.map((item) => [item.contentType, item]));
  const approveEffect = approveCommand?.effect || {};

  const coverage = {
    "UGC video evidence reviewed": {
      ready: Boolean(assetsByType.get("ugc_video")?.assetUrl && assetsByType.get("ugc_video")?.reviewEvidence?.length),
      evidence: "UGC video review media and evidence are present."
    },
    "Paid ad video evidence reviewed": {
      ready: Boolean(
        assetsByType.get("paid_ad_video")?.assetUrl && assetsByType.get("paid_ad_video")?.reviewEvidence?.length
      ),
      evidence: "Paid ad video review media and evidence are present."
    },
    "Normal post evidence reviewed": {
      ready: Boolean(assetsByType.get("normal_post")?.assetUrl && assetsByType.get("normal_post")?.reviewEvidence?.length),
      evidence: "Normal post review media and evidence are present."
    },
    "Artifact freshness checked": {
      ready: Boolean(reviewChecks.decisionCommandsReady),
      evidence: "Current copy-only decision commands are available in the generated handoff."
    },
    "Rollback and not-live proof reviewed": {
      ready: Boolean(reviewChecks.notLiveConfirmed && reviewChecks.rollbackNotLiveProofReady),
      evidence: "Rollback and not-live proof is complete and the review packet confirms nothing is live."
    },
    "Approved for Postiz draft upload only": {
      ready: Boolean(
        approveEffect.createsApprovedBundle === true &&
          approveEffect.createsManualPostizPackage === true &&
          approveEffect.allowsSchedulingOrPublishing === false &&
          decisionIntake?.approvalBoundary?.toLowerCase().includes("draft upload only")
      ),
      evidence: "Approve command is scoped to Postiz draft upload only and does not allow scheduling or publishing."
    }
  };

  const gates = checklist.map((label) => {
    const gate = coverage[label] || { ready: false, evidence: "No generated evidence is mapped for this approval gate." };
    return {
      label,
      status: gate.ready ? "covered" : "blocked",
      evidence: gate.evidence
    };
  });
  const coveredGates = gates.filter((gate) => gate.status === "covered").length;
  return {
    status: gates.length > 0 && coveredGates === gates.length ? "ready" : "blocked",
    summary: {
      totalGates: gates.length,
      coveredGates,
      blockedGates: gates.length - coveredGates
    },
    gates
  };
}

function makeDecisionIntake() {
  return {
    validDecisions: ["approve", "needs_revision", "reject"],
    notLiveRequired: true,
    approvalBoundary: "Approval here means Postiz draft upload only. Scheduling or publishing needs separate approval.",
    requiredFields: [
      {
        id: "decision",
        label: "Decision",
        required: true,
        allowedValues: ["approve", "needs_revision", "reject"]
      },
      {
        id: "reviewer",
        label: "Reviewer name",
        required: true,
        example: "Andre"
      },
      {
        id: "evidence",
        label: "Evidence reviewed",
        required: true,
        example: "Reviewed all generated assets in the local app and confirmed rollback/not-live proof."
      },
      {
        id: "notes",
        label: "Decision notes",
        required: true,
        example: "Approved for Postiz draft upload only. Do not publish without separate approval."
      }
    ]
  };
}

function makeSummary({ status, decisionCommands, completionAudit, firstBlockedRequirement }) {
  const commands = Array.isArray(decisionCommands?.commands) ? decisionCommands.commands : [];
  return {
    status,
    availableDecisionCommands: commands.length,
    completeRequirements: Number(completionAudit?.summary?.completeRequirements || 0),
    blockedRequirements: Number(completionAudit?.summary?.blockedRequirements || 0),
    firstBlockedRequirement: firstBlockedRequirement?.label || "Human review decision",
    liveActionsEnabled: false
  };
}

function nextActionFor(status, firstBlockedRequirement, reviewAssets) {
  if (status === "awaiting_human_decision") {
    return reviewAssets.length > 1
      ? "Review all generated assets, then copy approve or edit notes before running needs_revision or reject."
      : "Review the MP4 and contact sheet, then copy approve or edit notes before running needs_revision or reject.";
  }
  if (firstBlockedRequirement?.id) {
    return `Resolve blocked requirement: ${firstBlockedRequirement.label}.`;
  }
  return "Restore the review packet and copy-only decision commands before continuing.";
}

function makeUiSummary(handoff) {
  return {
    campaignId: handoff.campaignId,
    assetId: handoff.assetId,
    status: handoff.status,
    commandOnly: handoff.commandOnly,
    networkCallsAllowed: handoff.networkCallsAllowed,
    liveActionsEnabled: handoff.liveActionsEnabled,
    scheduleOrPublishReady: handoff.scheduleOrPublishReady,
    summary: handoff.summary,
    media: handoff.media,
    reviewAssets: handoff.reviewAssets,
    approvalChecklist: handoff.approvalChecklist,
    approvalEvidenceSummary: handoff.approvalEvidenceSummary,
    decisionReadiness: handoff.decisionReadiness,
    decisionIntake: handoff.decisionIntake,
    reviewChecks: handoff.reviewChecks,
    decisionCommands: handoff.decisionCommands,
    nextAction: handoff.nextAction
  };
}

function makeMarkdown(handoff) {
  const lines = [
    "# Human Approval Handoff",
    "",
    `Generated: ${handoff.generatedAt}`,
    `Campaign: ${handoff.campaignId}`,
    `Status: ${handoff.status}`,
    "",
    "## Review Media",
    "",
    `- Video: ${handoff.media.videoUrl}`,
    `- Contact sheet: ${handoff.media.contactSheetUrl}`,
    `- Caption: ${handoff.media.caption}`,
    "",
    "## Review Assets",
    ""
  ];

  for (const asset of handoff.reviewAssets) {
    lines.push(`- ${asset.label}: ${asset.assetUrl}`);
  }

  lines.push("", "## Decision Readiness", "");

  for (const item of handoff.decisionReadiness.items) {
    lines.push(`### ${item.label}`, "", `- Status: ${item.status}`, "");
    for (const check of item.checks) {
      lines.push(`- ${check.label}: ${check.status}`);
    }
    lines.push("");
  }

  lines.push("", "## Approval Evidence Summary", "");

  for (const gate of handoff.approvalEvidenceSummary.gates) {
    lines.push(`- ${gate.label}: ${gate.status} - ${gate.evidence}`);
  }

  lines.push("", "## Per-Asset Approval Checklist", "");

  for (const item of handoff.approvalChecklist) {
    lines.push(`### ${item.label}`, "", item.prompt, "");
    lines.push("Review Evidence:");
    for (const evidence of item.reviewEvidence || []) {
      if (evidence.url) {
        lines.push(`- ${evidence.label}: ${evidence.url}`);
      } else if (evidence.summary) {
        lines.push(`- ${evidence.label}: ${evidence.summary}`);
      } else if (Array.isArray(evidence.checks)) {
        lines.push(`- ${evidence.label}: ${evidence.checks.join("; ")}`);
      }
    }
    lines.push("", "Required Checks:");
    for (const check of item.requiredChecks) {
      lines.push(`- ${check}`);
    }
    lines.push("");
  }

  lines.push(
    "",
    "## Decision Intake",
    "",
    `- Approval boundary: ${handoff.decisionIntake.approvalBoundary}`,
    `- Not-live confirmation required: ${handoff.decisionIntake.notLiveRequired ? "yes" : "no"}`,
    `- Valid decisions: ${handoff.decisionIntake.validDecisions.join(", ")}`,
    ""
  );

  for (const field of handoff.decisionIntake.requiredFields) {
    lines.push(`- ${field.label}: ${field.required ? "required" : "optional"}`);
  }

  lines.push(
    "",
    "## Safety",
    "",
    `- Command only: ${handoff.commandOnly ? "yes" : "no"}`,
    `- Network calls allowed: ${handoff.networkCallsAllowed ? "yes" : "no"}`,
    `- Live actions enabled: ${handoff.liveActionsEnabled ? "yes" : "no"}`,
    `- Schedule or publish ready: ${handoff.scheduleOrPublishReady ? "yes" : "no"}`,
    `- Rollback and not-live proof: ${handoff.reviewChecks.rollbackNotLiveProofReady ? "ready" : "missing"}`,
    "",
    "## Decision Commands",
    ""
  );

  for (const command of handoff.decisionCommands) {
    lines.push(`### ${command.label}`, "");
    if (command.noteGuidance) {
      lines.push(`- Notes: ${command.noteGuidance}`);
    }
    if (command.effect) {
      lines.push(
        `- ${command.effect.operatorSummary || ""}`,
        `- Creates approved bundle: ${command.effect.createsApprovedBundle ? "yes" : "no"}`,
        `- Creates manual Postiz package: ${command.effect.createsManualPostizPackage ? "yes" : "no"}`,
        `- Keeps Postiz blocked: ${command.effect.keepsPostizBlocked ? "yes" : "no"}`,
        `- Allows scheduling or publishing: ${command.effect.allowsSchedulingOrPublishing ? "yes" : "no"}`,
        command.copyEnabled ? "- Copy: enabled" : "- Copy disabled until notes are edited"
      );
    }
    if (command.evidenceChecklist.length > 0) {
      lines.push("", "Evidence checklist:");
      for (const check of command.evidenceChecklist) {
        lines.push(`- ${check}`);
      }
    }
    lines.push("", "```powershell", command.command, "```", "");
  }

  lines.push("## Next Action", "", `- ${handoff.nextAction}`, "");
  return `${lines.join("\n")}\n`;
}

export function buildHumanApprovalHandoff({
  reviewPacket,
  decisionCommands,
  brandClaimLedger,
  completionAudit,
  reviewBoard = null,
  productionPackets = null,
  generatedAt = new Date().toISOString()
}) {
  const status = statusFor({ reviewPacket, decisionCommands });
  const firstBlockedRequirement = summarizeBlockedRequirement(completionAudit);
  const reviewAssets = makeReviewAssets({ reviewBoard, reviewPacket });
  const approvalChecklist = makeApprovalChecklist(reviewAssets, productionPackets);
  const decisionIntake = makeDecisionIntake();
  const reviewChecks = {
    ...makeReviewChecks({ reviewPacket, brandClaimLedger, decisionCommands }),
    rollbackNotLiveProofReady: requirementIsComplete(completionAudit, "rollback_not_live_proof")
  };
  const decisionReadiness = makeDecisionReadiness({ approvalChecklist, reviewChecks });
  const approvalEvidenceSummary = makeApprovalEvidenceSummary({
    approvalChecklist,
    reviewChecks,
    decisionCommands,
    decisionIntake
  });
  const handoff = {
    packageType: "social_studio_human_approval_handoff",
    generatedAt,
    campaignId:
      reviewPacket?.campaignId ||
      decisionCommands?.campaignId ||
      brandClaimLedger?.campaignId ||
      completionAudit?.campaignId ||
      "",
    assetId: reviewPacket?.assetId || decisionCommands?.assetId || "",
    status,
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    scheduleOrPublishReady: false,
    summary: makeSummary({ status, decisionCommands, completionAudit, firstBlockedRequirement }),
    media: makeMedia(reviewPacket),
    reviewAssets,
    approvalChecklist,
    approvalEvidenceSummary,
    decisionReadiness,
    decisionIntake,
    reviewChecks,
    decisionCommands: makeDecisionCommands(decisionCommands),
    nextAction: nextActionFor(status, firstBlockedRequirement, reviewAssets)
  };

  handoff.uiSummary = makeUiSummary(handoff);
  handoff.markdown = makeMarkdown(handoff);
  return handoff;
}

export async function buildHumanApprovalHandoffFromFiles({
  reviewPacketPath,
  decisionCommandsPath,
  brandClaimLedgerPath,
  completionAuditPath,
  reviewBoardPath = "",
  productionPacketsPath = "",
  outDir,
  generatedAt
}) {
  const handoff = buildHumanApprovalHandoff({
    reviewPacket: await readJson(reviewPacketPath),
    decisionCommands: await readJson(decisionCommandsPath),
    brandClaimLedger: await readJson(brandClaimLedgerPath),
    completionAudit: await readJson(completionAuditPath),
    reviewBoard: reviewBoardPath ? await readJson(reviewBoardPath) : null,
    productionPackets: productionPacketsPath ? await readJson(productionPacketsPath) : null,
    generatedAt
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "human-approval-handoff.json");
  const uiPath = path.join(outDir, "human-approval-handoff.ui.json");
  const markdownPath = path.join(outDir, "human-approval-handoff.md");
  await writeFile(jsonPath, `${JSON.stringify(handoff, null, 2)}\n`);
  await writeFile(uiPath, `${JSON.stringify(handoff.uiSummary, null, 2)}\n`);
  await writeFile(markdownPath, handoff.markdown);
  return { status: handoff.status, jsonPath, uiPath, markdownPath };
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const generatedDir = path.join(studioRoot, "generated", campaignId);
  const outDir = readArg("out-dir", path.join(generatedDir, "human-approval-handoff"));
  const result = await buildHumanApprovalHandoffFromFiles({
    reviewPacketPath: readArg("review-packet", path.join(generatedDir, "review-packet", "review-packet.ui.json")),
    decisionCommandsPath: readArg(
      "decision-commands",
      path.join(generatedDir, "review-decision-commands", "review-decision-commands.ui.json")
    ),
    brandClaimLedgerPath: readArg(
      "brand-claim-ledger",
      path.join(generatedDir, "brand-claim-ledger", "brand-claim-ledger.ui.json")
    ),
    completionAuditPath: readArg(
      "completion-audit",
      path.join(generatedDir, "mvp-completion-audit", "mvp-completion-audit.ui.json")
    ),
    reviewBoardPath: readArg("review-board", path.join(generatedDir, "review-board", "review-board.ui.json")),
    productionPacketsPath: readArg(
      "production-packets",
      path.join(generatedDir, "production-packets", "production-packets.json")
    ),
    outDir
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
