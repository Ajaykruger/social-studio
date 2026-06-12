import React, { useCallback, useEffect, useState } from "react";
import BrandClaimLedgerPanel from "./components/BrandClaimLedgerPanel.jsx";
import ContentCoverageAuditPanel from "./components/ContentCoverageAuditPanel.jsx";
import ContentPlanPanel from "./components/ContentPlanPanel.jsx";
import HumanApprovalHandoffPanel from "./components/HumanApprovalHandoffPanel.jsx";
import MvpCompletionAuditPanel from "./components/MvpCompletionAuditPanel.jsx";
import MvpFinishPathPanel from "./components/MvpFinishPathPanel.jsx";
import MvpOperatorPacketPanel from "./components/MvpOperatorPacketPanel.jsx";
import PostizCommandCenterPanel from "./components/PostizCommandCenterPanel.jsx";
import PostizDryRunReadinessPanel from "./components/PostizDryRunReadinessPanel.jsx";
import PostizInputKitPanel from "./components/PostizInputKitPanel.jsx";
import PostizLocalInputValidationPanel from "./components/PostizLocalInputValidationPanel.jsx";
import ProductionPacketsPanel from "./components/ProductionPacketsPanel.jsx";
import ProductionQueuePanel from "./components/ProductionQueuePanel.jsx";
import ReviewBoardPanel from "./components/ReviewBoardPanel.jsx";
import ReviewDecisionCommandsPanel from "./components/ReviewDecisionCommandsPanel.jsx";
import ReviewDecisionScreen from "./components/ReviewDecisionScreen.jsx";
import ReviewMediaPanel from "./components/ReviewMediaPanel.jsx";
import SocialStudioStatusPanel from "./components/SocialStudioStatusPanel.jsx";
import {
  activeCampaignId,
  loadCampaignState,
  loadStudioArtifacts
} from "./utils/studioData.js";

// Campaign artifacts the panels read, fetched at runtime so a new campaign or
// a fresh decision does not require rebuilding the app.
const ARTIFACT_MANIFEST = {
  socialStudioStatus: "workflow-status.ui.json",
  mvpCompletionAudit: "mvp-completion-audit/mvp-completion-audit.ui.json",
  mvpOperatorPacket: "mvp-operator-packet/mvp-operator-packet.ui.json",
  mvpFinishPath: "mvp-finish-path/mvp-finish-path.ui.json",
  humanApprovalHandoff: "human-approval-handoff/human-approval-handoff.ui.json",
  contentPlan: "content-plan/content-plan.ui.json",
  contentCoverageAudit: "content-coverage-audit/content-coverage-audit.ui.json",
  brandClaimLedger: "brand-claim-ledger/brand-claim-ledger.ui.json",
  productionPackets: "production-packets/production-packets.ui.json",
  productionQueue: "production-queue/production-queue.ui.json",
  reviewBoard: "review-board/review-board.ui.json",
  reviewPacket: "review-packet/review-packet.ui.json",
  postizInputKit: "postiz-input-kit/postiz-input-kit.ui.json",
  postizLocalInputValidation: "postiz-input-kit/postiz-local-input-validation.ui.json",
  postizReadiness: "postiz-dry-run-readiness/postiz-dry-run-readiness.ui.json",
  postizCommandCenter: "postiz-command-center/postiz-command-center.ui.json",
  decisionCommands: "review-decision-commands/review-decision-commands.ui.json"
};

export default function App() {
  const campaignId = activeCampaignId();
  const [artifacts, setArtifacts] = useState(null);
  const [missing, setMissing] = useState([]);
  const [campaignState, setCampaignState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [artifactResult, stateResult] = await Promise.all([
        loadStudioArtifacts(campaignId, ARTIFACT_MANIFEST),
        loadCampaignState(campaignId).catch(() => null)
      ]);
      setArtifacts(artifactResult.data);
      setMissing(artifactResult.missing);
      setCampaignState(stateResult);
      if (Object.values(artifactResult.data).every((value) => value === null)) {
        setLoadError(
          "No campaign data could be loaded. Start the local decision server with: npm run serve"
        );
      }
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const data = artifacts || {};

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-2 border-b border-slate-200 pb-5">
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Crystal Clawz
          </p>
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
                Crystal Clawz Social Studio
              </h1>
              <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                Review campaign drafts and record a human decision. Approval
                means a manual Postiz draft upload only - nothing is scheduled
                or published from this app.
              </p>
            </div>
            <span className="w-fit rounded-full bg-fuchsia-100 px-3 py-2 text-sm font-bold text-fuchsia-950">
              Review-first MVP
            </span>
          </div>
        </header>

        {loading ? (
          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-lg font-black text-slate-950">
              Loading campaign...
            </p>
            <p className="text-sm leading-6 text-slate-600">{campaignId}</p>
          </div>
        ) : null}

        {loadError ? (
          <div className="grid gap-2 rounded-md border border-rose-200 bg-rose-50 p-4">
            <p className="font-black text-rose-950">Campaign failed to load</p>
            <p className="text-sm leading-6 text-rose-950">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="w-fit min-h-12 rounded-md bg-rose-700 px-5 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !loadError ? (
          <ReviewDecisionScreen
            campaignId={campaignId}
            workflowStatus={data.socialStudioStatus}
            reviewPacket={data.reviewPacket}
            handoff={data.humanApprovalHandoff}
            ledger={data.brandClaimLedger}
            campaignState={campaignState}
            onDecided={reload}
          />
        ) : null}

        {missing.length > 0 && !loading ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            <span className="font-bold">Some campaign artifacts are missing: </span>
            {missing.join(", ")}
          </div>
        ) : null}

        {!loading && !loadError ? (
          <details className="grid gap-5 rounded-md border border-slate-200 p-4">
            <summary className="cursor-pointer text-lg font-black text-slate-950">
              Operator dashboard (full detail)
            </summary>
            <div className="mt-4 grid gap-5">
              <SocialStudioStatusPanel status={data.socialStudioStatus} />
              <MvpCompletionAuditPanel audit={data.mvpCompletionAudit} />
              <MvpOperatorPacketPanel packet={data.mvpOperatorPacket} />
              <MvpFinishPathPanel finishPath={data.mvpFinishPath} />
              <HumanApprovalHandoffPanel handoff={data.humanApprovalHandoff} />
              <ContentPlanPanel plan={data.contentPlan} />
              <ContentCoverageAuditPanel audit={data.contentCoverageAudit} />
              <BrandClaimLedgerPanel ledger={data.brandClaimLedger} />
              <ProductionPacketsPanel packets={data.productionPackets} />
              <ProductionQueuePanel queue={data.productionQueue} />
              <ReviewBoardPanel board={data.reviewBoard} />
              <ReviewMediaPanel packet={data.reviewPacket} />
              <PostizInputKitPanel kit={data.postizInputKit} />
              <PostizLocalInputValidationPanel validation={data.postizLocalInputValidation} />
              <PostizDryRunReadinessPanel readiness={data.postizReadiness} />
              <PostizCommandCenterPanel center={data.postizCommandCenter} />
              <ReviewDecisionCommandsPanel packet={data.decisionCommands} />
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
