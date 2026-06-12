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

import { appendFile, mkdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import {
  APPROVAL_EVIDENCE_GATES,
  runReviewDecisionCycle
} from "../social-studio/tools/run-review-decision-cycle.mjs";

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

function validateDecisionRequest(body) {
  const decision = String(body?.decision || "").trim();
  if (!DECISIONS.has(decision)) {
    return { error: "decision must be approve, needs_revision, or reject" };
  }

  const reviewer = String(body?.reviewer || "").trim();
  if (reviewer.length < 2 || reviewer === "pending-human-review") {
    return { error: "a real human reviewer name is required" };
  }

  const notes = String(body?.notes || "").trim();
  const gates = Array.isArray(body?.gates) ? body.gates.map(String) : [];

  if (decision === "approve") {
    const missing = APPROVAL_EVIDENCE_GATES.filter(
      (gate) => !gates.includes(gate)
    );
    if (missing.length > 0) {
      return {
        error: `approval requires every evidence gate to be confirmed; missing: ${missing.join("; ")}`
      };
    }
    return {
      decision,
      reviewer,
      notes,
      evidence: APPROVAL_EVIDENCE_GATES.join("; ")
    };
  }

  if (!notes) {
    return { error: `${decision} requires specific notes describing the decision` };
  }
  return { decision, reviewer, notes, evidence: notes };
}

async function appendAuditLog(auditRoot, campaignId, entry) {
  await mkdir(auditRoot, { recursive: true });
  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(path.join(auditRoot, `${campaignId}.decisions.jsonl`), line);
}

export function createDecisionApp({
  workspaceRoot = defaultWorkspaceRoot
} = {}) {
  const paths = workspacePaths(workspaceRoot);
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
      res.json({
        campaignId,
        workflowStatus,
        approvalEvidenceGates: APPROVAL_EVIDENCE_GATES,
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

      const validated = validateDecisionRequest(req.body);
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
        manualPackageDir: path.join(paths.handoffApprovedRoot, campaignId),
        decision: validated.decision,
        reviewer: validated.reviewer,
        evidence: validated.evidence,
        approvedAt: decidedAt,
        notes: validated.notes
      });

      await appendAuditLog(paths.auditRoot, campaignId, {
        at: decidedAt,
        campaignId,
        decision: validated.decision,
        reviewer: validated.reviewer,
        gatesConfirmed:
          validated.decision === "approve" ? APPROVAL_EVIDENCE_GATES : [],
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
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 4810);
  const app = createDecisionApp();
  app.listen(port, host, () => {
    console.log(`decision api listening on http://${host}:${port}`);
    console.log("draft_only=true scheduling=never publishing=never");
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
