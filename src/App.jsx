import React from "react";
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
import ReviewMediaPanel from "./components/ReviewMediaPanel.jsx";
import SocialStudioStatusPanel from "./components/SocialStudioStatusPanel.jsx";
import brandClaimLedger from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/brand-claim-ledger/brand-claim-ledger.ui.json";
import contentCoverageAudit from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/content-coverage-audit/content-coverage-audit.ui.json";
import contentPlan from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/content-plan/content-plan.ui.json";
import decisionCommands from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/review-decision-commands/review-decision-commands.ui.json";
import humanApprovalHandoff from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/human-approval-handoff/human-approval-handoff.ui.json";
import mvpCompletionAudit from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/mvp-completion-audit/mvp-completion-audit.ui.json";
import mvpFinishPath from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/mvp-finish-path/mvp-finish-path.ui.json";
import mvpOperatorPacket from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/mvp-operator-packet/mvp-operator-packet.ui.json";
import postizCommandCenter from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-command-center/postiz-command-center.ui.json";
import postizInputKit from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/postiz-input-kit.ui.json";
import postizLocalInputValidation from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/postiz-local-input-validation.ui.json";
import postizReadiness from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-dry-run-readiness/postiz-dry-run-readiness.ui.json";
import productionPackets from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/production-packets/production-packets.ui.json";
import productionQueue from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/production-queue/production-queue.ui.json";
import reviewBoard from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/review-board/review-board.ui.json";
import reviewPacket from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/review-packet/review-packet.ui.json";
import socialStudioStatus from "../social-studio/generated/cc-rubber-base-demo-2026-06-10/workflow-status.ui.json";

export default function App() {
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

        <SocialStudioStatusPanel status={socialStudioStatus} />
        <MvpCompletionAuditPanel audit={mvpCompletionAudit} />
        <MvpOperatorPacketPanel packet={mvpOperatorPacket} />
        <MvpFinishPathPanel finishPath={mvpFinishPath} />
        <HumanApprovalHandoffPanel handoff={humanApprovalHandoff} />
        <ContentPlanPanel plan={contentPlan} />
        <ContentCoverageAuditPanel audit={contentCoverageAudit} />
        <BrandClaimLedgerPanel ledger={brandClaimLedger} />
        <ProductionPacketsPanel packets={productionPackets} />
        <ProductionQueuePanel queue={productionQueue} />
        <ReviewBoardPanel board={reviewBoard} />
        <ReviewMediaPanel packet={reviewPacket} />
        <PostizInputKitPanel kit={postizInputKit} />
        <PostizLocalInputValidationPanel validation={postizLocalInputValidation} />
        <PostizDryRunReadinessPanel readiness={postizReadiness} />
        <PostizCommandCenterPanel center={postizCommandCenter} />
        <ReviewDecisionCommandsPanel packet={decisionCommands} />
      </div>
    </main>
  );
}
