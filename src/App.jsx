import React, { useMemo, useRef, useState } from "react";
import BrandClaimLedgerPanel from "./components/BrandClaimLedgerPanel.jsx";
import CampaignBriefForm from "./components/CampaignBriefForm.jsx";
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
import ReferenceAssetNote from "./components/ReferenceAssetNote.jsx";
import ReviewBoardPanel from "./components/ReviewBoardPanel.jsx";
import ReviewDecisionCommandsPanel from "./components/ReviewDecisionCommandsPanel.jsx";
import ReviewMediaPanel from "./components/ReviewMediaPanel.jsx";
import SocialStudioStatusPanel from "./components/SocialStudioStatusPanel.jsx";
import WorkflowSetupForm from "./components/WorkflowSetupForm.jsx";
import OutputPanel from "./components/OutputPanel.jsx";
import { generatePack } from "./utils/generatePack.js";
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
import products from "./data/products.json";
import videoTypes from "./data/videoTypes.json";
import scenes from "./data/scenes.json";
import avatars from "./data/avatars.json";
import engines from "./data/engines.json";
import imageGenerators from "./data/imageGenerators.json";

const initialBrief = {
  campaignName: "",
  audience: "Nail techs struggling with lifting",
  painPoint: "",
  cta: "",
  tone: "Warm & encouraging"
};

export default function App() {
  const [brief, setBrief] = useState(initialBrief);
  const [product, setProduct] = useState(products[0]);
  const [videoType, setVideoType] = useState(videoTypes[0]);
  const [scene, setScene] = useState(scenes[0]);
  const [avatar, setAvatar] = useState(avatars[0]);
  const [engine, setEngine] = useState(engines[1]);
  const [imageGenerator, setImageGenerator] = useState(imageGenerators[0]);
  const [pack, setPack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const outputRef = useRef(null);

  const isReady = useMemo(
    () =>
      Boolean(
        brief.campaignName.trim() &&
          brief.audience.trim() &&
          brief.painPoint.trim() &&
          brief.cta.trim() &&
          brief.tone &&
          product &&
          videoType &&
          scene &&
          avatar &&
          engine &&
          imageGenerator
      ),
    [brief, product, videoType, scene, avatar, engine, imageGenerator]
  );

  function buildFormState() {
    return {
      ...brief,
      campaignName: brief.campaignName.trim(),
      audience: brief.audience.trim(),
      painPoint: brief.painPoint.trim(),
      cta: brief.cta.trim(),
      product,
      videoType,
      scene,
      avatar,
      engine,
      imageGenerator
    };
  }

  function handleGenerate() {
    if (!isReady || isLoading) return;
    setIsLoading(true);
    window.setTimeout(() => {
      setPack(generatePack(buildFormState()));
      setIsLoading(false);
      window.setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }, 800);
  }

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
                Crystal UGC Studio
              </h1>
              <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                Build Jenn's reference images, Flow setup, Agent Mode prompts,
                edits, and fallback prompts in one pack.
              </p>
            </div>
            <span className="w-fit rounded-full bg-fuchsia-100 px-3 py-2 text-sm font-bold text-fuchsia-950">
              Local MVP
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

        <section className="grid gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
              Stage 1
            </p>
            <h2 className="text-2xl font-black text-slate-950">Brief</h2>
          </div>
          <CampaignBriefForm value={brief} onChange={setBrief} />
          <WorkflowSetupForm
            product={product}
            products={products}
            setProduct={setProduct}
            videoType={videoType}
            videoTypes={videoTypes}
            setVideoType={setVideoType}
            scene={scene}
            scenes={scenes}
            setScene={setScene}
            avatar={avatar}
            avatars={avatars}
            setAvatar={setAvatar}
            engine={engine}
            engines={engines}
            setEngine={setEngine}
            imageGenerator={imageGenerator}
            imageGenerators={imageGenerators}
            setImageGenerator={setImageGenerator}
          />
          <ReferenceAssetNote
            product={product}
            scene={scene}
            avatar={avatar}
            imageGenerator={imageGenerator}
          />
        </section>

        <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Stage 2
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950">Generate</h2>
            <button
              type="button"
              disabled={!isReady || isLoading}
              onClick={handleGenerate}
              className="min-h-12 rounded-md bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {isLoading ? "Building..." : "Build UGC Workflow Pack"}
            </button>
          </div>
          {!isReady ? (
            <p className="text-sm leading-6 text-slate-600">
              Fill in the brief fields above to build your UGC workflow pack.
            </p>
          ) : null}
        </section>

        <section ref={outputRef} className="grid gap-5">
          {pack ? (
            <>
              <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
                Stage 3
              </p>
              <OutputPanel pack={pack} outputMode={engine.id} />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
