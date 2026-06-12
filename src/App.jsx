import React, { useCallback, useEffect, useState } from "react";
import BrandClaimLedgerPanel from "./components/BrandClaimLedgerPanel.jsx";
import ContentCoverageAuditPanel from "./components/ContentCoverageAuditPanel.jsx";
import ContentPlanPanel from "./components/ContentPlanPanel.jsx";
import CreateScreen from "./components/CreateScreen.jsx";
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
  listCampaigns,
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

const TABS = [
  { id: "create", label: "Create" },
  { id: "review", label: "Review" },
  { id: "operator", label: "Operator" }
];

export default function App() {
  const [tab, setTab] = useState("create");
  const [campaignId, setCampaignId] = useState(activeCampaignId());
  const [campaigns, setCampaigns] = useState([]);
  const [artifacts, setArtifacts] = useState(null);
  const [missing, setMissing] = useState([]);
  const [campaignState, setCampaignState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [artifactResult, stateResult, campaignList] = await Promise.all([
        loadStudioArtifacts(campaignId, ARTIFACT_MANIFEST),
        loadCampaignState(campaignId).catch(() => null),
        listCampaigns().catch(() => [])
      ]);
      setArtifacts(artifactResult.data);
      setMissing(artifactResult.missing);
      setCampaignState(stateResult);
      setCampaigns(campaignList);
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

  function handleCampaignCreated(newCampaignId) {
    setCampaignId(newCampaignId);
    setTab("review");
  }

  const data = artifacts || {};

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-3 border-b border-slate-200 pb-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
                Crystal Clawz
              </p>
              <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
                Crystal Clawz Social Studio
              </h1>
              <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                Create campaign drafts, review them, and record a human
                decision. Approval means a manual Postiz draft upload only -
                nothing is scheduled or published from this app.
              </p>
            </div>
            <span className="w-fit rounded-full bg-fuchsia-100 px-3 py-2 text-sm font-bold text-fuchsia-950">
              Review-first
            </span>
          </div>

          <nav className="flex gap-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`min-h-12 flex-1 rounded-md px-4 text-sm font-black transition sm:flex-none sm:px-6 ${
                  tab === item.id
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        {tab === "create" ? (
          <CreateScreen onCampaignCreated={handleCampaignCreated} />
        ) : null}

        {tab !== "create" && campaigns.length > 0 ? (
          <label className="grid gap-1 text-sm font-bold text-slate-950">
            Campaign
            <select
              className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base font-normal"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              {campaigns.map((campaign) => (
                <option key={campaign.campaignId} value={campaign.campaignId}>
                  {campaign.campaignId} - {campaign.statusLabel}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {tab !== "create" && loading ? (
          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-lg font-black text-slate-950">
              Loading campaign...
            </p>
            <p className="text-sm leading-6 text-slate-600">{campaignId}</p>
          </div>
        ) : null}

        {tab !== "create" && loadError ? (
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

        {tab === "review" && !loading && !loadError ? (
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

        {tab === "operator" && missing.length > 0 && !loading ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            <span className="font-bold">Artifacts not generated for this campaign: </span>
            {missing.join(", ")}
          </div>
        ) : null}

        {tab === "operator" && !loading && !loadError ? (
          <div className="grid gap-5">
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
        ) : null}
      </div>
    </main>
  );
}
