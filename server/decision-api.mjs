// Crystal Clawz Social Studio decision API.
//
// This server exposes the existing guarded review-decision tools to the
// browser so the reviewer can record a decision without a terminal. It adds
// NO new capability: every decision still runs through
// runReviewDecisionCycle with the same reviewer, evidence-gate, and
// draft-only checks. It makes no network calls to Postiz or anywhere else.
//
// Binding is localhost-only by default. On a VPS it must sit behind an
// authenticated proxy (Cloudflare Access / Tailscale) before HOST is changed.

import { appendFile, mkdir, readdir, readFile, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import {
  runReviewDecisionCycle
} from "../social-studio/tools/run-review-decision-cycle.mjs";
import { approvalEvidenceRequirementsFor } from "../social-studio/tools/record-review-decision.mjs";
import { importProductFromUrl } from "./product-import.mjs";
import { createCampaign, generateCreativePack } from "./generate-campaign.mjs";
import { attachRenderedReel } from "./attach-reel.mjs";
import { loadDotEnv } from "./env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkspaceRoot = path.resolve(__dirname, "..");

const DECISIONS = new Set(["approve", "needs_revision", "reject"]);
const CAMPAIGN_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function workspacePaths(workspaceRoot) {
  const studioRoot = path.join(workspaceRoot, "social-studio");
  return {
    studioRoot,
    generatedRoot: path.join(studioRoot, "generated"),
    auditRoot: path.join(studioRoot, "audit"),
    handoffApprovedRoot: path.join(studioRoot, "handoff", "postiz", "approved"),
    publicRoot: path.join(workspaceRoot, "public"),
    distRoot: path.join(workspaceRoot, "dist")
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function requireValidCampaignId(campaignId) {
  const clean = String(campaignId || "").trim();
  if (!CAMPAIGN_ID_PATTERN.test(clean)) {
    const error = new Error("invalid campaign id");
    error.statusCode = 400;
    throw error;
  }
  return clean;
}

function normalizeReviewers(reviewers) {
  const values = Array.isArray(reviewers)
    ? reviewers
    : String(reviewers || "").split(",");
  return values.map((reviewer) => String(reviewer).trim()).filter(Boolean);
}

function reviewerAllowed(reviewer, reviewers) {
  if (reviewers.length === 0) return true;
  const normalized = reviewer.toLowerCase();
  return reviewers.some((allowed) => allowed.toLowerCase() === normalized);
}

function validateDecisionRequest(body, requiredGates, reviewers = []) {
  const decision = String(body?.decision || "").trim();
  if (!DECISIONS.has(decision)) {
    return { error: "decision must be approve, needs_revision, or reject" };
  }

  const reviewer = String(body?.reviewer || "").trim();
  if (reviewer.length < 2 || reviewer === "pending-human-review") {
    return { error: "a real human reviewer name is required" };
  }
  if (!reviewerAllowed(reviewer, reviewers)) {
    return { error: `reviewer is not allowed for this studio: ${reviewer}` };
  }

  const notes = String(body?.notes || "").trim();
  const gates = Array.isArray(body?.gates) ? body.gates.map(String) : [];

  if (decision === "approve") {
    const missing = requiredGates.filter((gate) => !gates.includes(gate));
    if (missing.length > 0) {
      return {
        error: `approval requires every evidence gate to be confirmed; missing: ${missing.join("; ")}`
      };
    }
    return {
      decision,
      reviewer,
      notes,
      gates: requiredGates,
      evidence: requiredGates.join("; ")
    };
  }

  if (!notes) {
    return { error: `${decision} requires specific notes describing the decision` };
  }
  return { decision, reviewer, notes, gates: [], evidence: notes };
}

async function appendAuditLog(auditRoot, campaignId, entry) {
  await mkdir(auditRoot, { recursive: true });
  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(path.join(auditRoot, `${campaignId}.decisions.jsonl`), line);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function refreshReviewPacketFromWorkflow(campaignDir) {
  const packetPath = path.join(campaignDir, "review-packet", "review-packet.ui.json");
  const workflowPath = path.join(campaignDir, "workflow-status.ui.json");
  const packet = await readJsonIfExists(packetPath);
  if (!packet) return false;

  const workflow = await readJsonIfExists(workflowPath);
  if (!workflow) return false;

  await writeJson(packetPath, {
    ...packet,
    status: workflow.status,
    statusLabel: workflow.statusLabel,
    decisionRequired: false,
    nextAction: workflow.nextAction
  });
  return true;
}

async function decidedFor(campaignDir) {
  return (
    (await fileExists(path.join(campaignDir, "approved-bundle.json"))) ||
    (await fileExists(path.join(campaignDir, "revision-bundle.json"))) ||
    (await fileExists(path.join(campaignDir, "rejected-bundle.json")))
  );
}

function contentTypesFor(bundle) {
  const declared = bundle?.postizHandoff?.requiredContentTypes;
  return Array.isArray(declared) ? declared.map(String).filter(Boolean) : [];
}

export function createDecisionApp({
  workspaceRoot = defaultWorkspaceRoot,
  reviewers = process.env.STUDIO_REVIEWERS
} = {}) {
  const paths = workspacePaths(workspaceRoot);
  const reviewerAllowlist = normalizeReviewers(reviewers);
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      draftOnly: true,
      schedulingOrPublishing: "never",
      networkCallsToPostiz: false
    });
  });

  app.get("/api/campaigns/:campaignId/state", async (req, res) => {
    try {
      const campaignId = requireValidCampaignId(req.params.campaignId);
      const campaignDir = path.join(paths.generatedRoot, campaignId);
      if (!(await fileExists(campaignDir))) {
        res.status(404).json({ error: "campaign not found" });
        return;
      }

      const workflowStatus = await readJsonIfExists(
        path.join(campaignDir, "workflow-status.ui.json")
      );
      const bundle = await readJsonIfExists(
        path.join(campaignDir, "draft-bundle.json")
      );
      res.json({
        campaignId,
        workflowStatus,
        approvalEvidenceGates: approvalEvidenceRequirementsFor(bundle).map(
          (requirement) => requirement.label
        ),
        bundles: {
          draft: await fileExists(path.join(campaignDir, "draft-bundle.json")),
          approved: await fileExists(path.join(campaignDir, "approved-bundle.json")),
          revision: await fileExists(path.join(campaignDir, "revision-bundle.json")),
          rejected: await fileExists(path.join(campaignDir, "rejected-bundle.json"))
        },
        boundary: {
          approvalMeans: "manual Postiz draft upload only",
          scheduling: false,
          publishing: false
        }
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/campaigns/:campaignId/decision", async (req, res) => {
    try {
      const campaignId = requireValidCampaignId(req.params.campaignId);
      const campaignDir = path.join(paths.generatedRoot, campaignId);
      const draftBundlePath = path.join(campaignDir, "draft-bundle.json");
      if (!(await fileExists(draftBundlePath))) {
        res.status(404).json({ error: "campaign draft bundle not found" });
        return;
      }

      const bundle = await readJsonIfExists(draftBundlePath);
      const requiredGates = approvalEvidenceRequirementsFor(bundle).map(
        (requirement) => requirement.label
      );
      const validated = validateDecisionRequest(req.body, requiredGates, reviewerAllowlist);
      if (validated.error) {
        res.status(400).json({ error: validated.error });
        return;
      }

      // Overwrite protection: an existing approval is evidence and must not
      // be silently replaced from a browser button.
      const approvedBundlePath = path.join(campaignDir, "approved-bundle.json");
      if (validated.decision === "approve" && (await fileExists(approvedBundlePath))) {
        res.status(409).json({
          error:
            "an approved bundle already exists for this campaign; remove it deliberately before re-approving"
        });
        return;
      }

      const decidedAt = new Date().toISOString();
      const result = await runReviewDecisionCycle({
        input: draftBundlePath,
        outDir: campaignDir,
        workspaceRoot,
        manualPackageDir: path.join(paths.handoffApprovedRoot, campaignId),
        decision: validated.decision,
        reviewer: validated.reviewer,
        evidence: validated.evidence,
        approvedAt: decidedAt,
        notes: validated.notes
      });

      await refreshReviewPacketFromWorkflow(campaignDir);

      await appendAuditLog(paths.auditRoot, campaignId, {
        at: decidedAt,
        campaignId,
        decision: validated.decision,
        reviewer: validated.reviewer,
        gatesConfirmed: validated.gates,
        notes: validated.notes,
        resultStatus: result.status,
        bundlePath: path.relative(workspaceRoot, result.bundlePath),
        manualPackagePath: result.manualPackagePath
          ? path.relative(workspaceRoot, result.manualPackagePath)
          : "",
        allowsSchedulingOrPublishing: false
      });

      res.json({
        ok: true,
        campaignId,
        decision: validated.decision,
        reviewer: validated.reviewer,
        decidedAt,
        status: result.status,
        manualPackageReady: Boolean(result.manualPackagePath),
        boundary: "Postiz draft upload only. No scheduling. No publishing."
      });
    } catch (error) {
      res.status(error.statusCode || 422).json({ error: error.message });
    }
  });

  app.post("/api/campaigns/:campaignId/attach-reel", async (req, res) => {
    try {
      const campaignId = requireValidCampaignId(req.params.campaignId);
      const result = await attachRenderedReel({
        workspaceRoot,
        campaignId,
        filePath: req.body?.filePath
      });
      res.json(result);
    } catch (error) {
      res.status(error.statusCode || 422).json({ error: error.message });
    }
  });

  app.post("/api/campaigns/:campaignId/archive", async (req, res) => {
    try {
      const campaignId = requireValidCampaignId(req.params.campaignId);
      const campaignDir = path.join(paths.generatedRoot, campaignId);
      if (!(await fileExists(campaignDir))) {
        res.status(404).json({ error: "campaign not found" });
        return;
      }

      const archivedAt = new Date().toISOString();
      await writeFile(path.join(campaignDir, "archived.flag"), `${archivedAt}\n`);
      await appendAuditLog(paths.auditRoot, campaignId, {
        at: archivedAt,
        campaignId,
        event: "campaign_archived",
        archived: true,
        allowsSchedulingOrPublishing: false
      });

      res.json({ ok: true, campaignId, archived: true });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/campaigns", async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === "1";
      let entries = [];
      try {
        entries = await readdir(paths.generatedRoot, { withFileTypes: true });
      } catch {
        entries = [];
      }
      const campaigns = [];
      for (const entry of entries) {
        if (!entry.isDirectory() || !CAMPAIGN_ID_PATTERN.test(entry.name)) continue;
        const campaignDir = path.join(paths.generatedRoot, entry.name);
        const archived = await fileExists(path.join(campaignDir, "archived.flag"));
        if (archived && !includeArchived) continue;
        const status = await readJsonIfExists(
          path.join(campaignDir, "workflow-status.ui.json")
        );
        const bundle = await readJsonIfExists(
          path.join(campaignDir, "draft-bundle.json")
        );
        campaigns.push({
          campaignId: entry.name,
          status: status?.status || "unknown",
          statusLabel: status?.statusLabel || "Unknown",
          generatedAt: status?.freshness?.generatedAt || "",
          contentTypes: contentTypesFor(bundle),
          decided: await decidedFor(campaignDir),
          archived
        });
      }
      campaigns.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
      res.json({ campaigns });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Create mode -------------------------------------------------------
  // Import is allowlisted to crystalclawz.co.za. Generation is claim-guarded
  // on the server regardless of what the browser sends. Creating a campaign
  // only ever produces a needs_review draft - the same human approval gates
  // apply to generated content as to everything else.

  app.post("/api/import-product", async (req, res) => {
    try {
      const product = await importProductFromUrl(req.body?.url);
      res.json({ product });
    } catch (error) {
      res.status(422).json({ error: error.message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const result = await generateCreativePack({
        product: req.body?.product,
        brief: req.body?.brief
      });
      res.json(result);
    } catch (error) {
      res.status(422).json({ error: error.message });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const result = await createCampaign({
        workspaceRoot,
        product: req.body?.product,
        brief: req.body?.brief,
        pack: req.body?.pack,
        selectedCaptionIndex: Number(req.body?.selectedCaptionIndex) || 0,
        generator: String(req.body?.generator || "unknown")
      });
      res.json({
        ok: true,
        ...result,
        status: "needs_review",
        boundary: "Draft created for human review only. Nothing is scheduled or published."
      });
    } catch (error) {
      res.status(422).json({ error: error.message });
    }
  });

  // Campaign artifacts for the UI. Local-only operator value files are never
  // served, even though they contain no secrets by policy.
  app.use("/studio-data", (req, res, next) => {
    if (/\.local\.json$/i.test(req.path)) {
      res.status(403).json({ error: "local-only input files are not served" });
      return;
    }
    next();
  });
  app.use("/studio-data", express.static(paths.generatedRoot));

  // Production static hosting: built app + review media.
  app.use(express.static(paths.distRoot));
  app.use(express.static(paths.publicRoot));
  app.get(/^\/(?!api\/|studio-data\/).*/, async (req, res, next) => {
    const indexPath = path.join(paths.distRoot, "index.html");
    if (await fileExists(indexPath)) {
      res.sendFile(indexPath);
      return;
    }
    next();
  });

  return app;
}

async function main() {
  loadDotEnv(defaultWorkspaceRoot);
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 4810);
  const app = createDecisionApp();
  app.listen(port, host, () => {
    console.log(`decision api listening on http://${host}:${port}`);
    console.log("draft_only=true scheduling=never publishing=never");
    console.log(
      process.env.ANTHROPIC_API_KEY
        ? "generation=claude (ANTHROPIC_API_KEY found)"
        : "generation=templates (set ANTHROPIC_API_KEY in .env for AI generation)"
    );
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
