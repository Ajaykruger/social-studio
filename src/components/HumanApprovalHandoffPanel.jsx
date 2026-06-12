import React from "react";
import CopyButton from "./CopyButton.jsx";

function statusClass(status) {
  if (status === "awaiting_human_decision") return "bg-amber-100 text-amber-950";
  return "bg-slate-100 text-slate-800";
}

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function copyLabel(decision) {
  if (decision === "approve") return "Copy approve";
  if (decision === "needs_revision") return "Copy revision";
  if (decision === "reject") return "Copy reject";
  return "Copy";
}

function assetLabel(asset) {
  if (asset.contentType === "paid_ad_video") return "Paid ad";
  if (asset.contentType === "normal_post") return "Post";
  return "UGC";
}

function yesNo(value) {
  return value ? "yes" : "no";
}

export default function HumanApprovalHandoffPanel({ handoff }) {
  if (!handoff?.commandOnly) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Human Approval Handoff
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Review and record a decision
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusClass(handoff.status)}`}>
          {formatStatus(handoff.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-4">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Commands: {handoff.summary.availableDecisionCommands}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Blocked: {handoff.summary.blockedRequirements}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Live actions: {handoff.liveActionsEnabled ? "on" : "off"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Network calls: {handoff.networkCallsAllowed ? "on" : "off"}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Review media</h3>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            <a className="font-bold text-teal-800 underline" href={handoff.media.videoUrl}>
              Open MP4
            </a>
            <a className="font-bold text-teal-800 underline" href={handoff.media.contactSheetUrl}>
              Open contact sheet
            </a>
            <p>{handoff.media.visualReviewSummary}</p>
            <p>
              <span className="font-bold text-slate-950">Caption: </span>
              {handoff.media.caption}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {handoff.media.hashtags.join(" ")}
            </p>
          </div>
        </article>

        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Approval checks</h3>
          <div className="grid gap-2 text-sm font-bold text-slate-800 sm:grid-cols-2">
            <span className="rounded-md bg-white px-3 py-2">
              Not live: {handoff.reviewChecks.notLiveConfirmed ? "yes" : "no"}
            </span>
            <span className="rounded-md bg-white px-3 py-2">
              Publish allowed: {handoff.reviewChecks.publishAllowed}
            </span>
            <span className="rounded-md bg-white px-3 py-2">
              Claim check: {handoff.reviewChecks.claimCheckRequired ? "needed" : "clear"}
            </span>
            <span className="rounded-md bg-white px-3 py-2">
              Rollback proof: {handoff.reviewChecks.rollbackNotLiveProofReady ? "ready" : "missing"}
            </span>
            <span className="rounded-md bg-white px-3 py-2">
              Content types: {handoff.reviewChecks.contentTypes.length}
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-700">
            First blocker: {handoff.summary.firstBlockedRequirement}
          </p>
        </article>
      </div>

      {handoff.decisionIntake ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Decision intake
              </p>
              <h3 className="font-black text-slate-950">Required approval record</h3>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-800">
              Not-live required: {handoff.decisionIntake.notLiveRequired ? "yes" : "no"}
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-700">
            {handoff.decisionIntake.approvalBoundary}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(handoff.decisionIntake.requiredFields || []).map((field) => (
              <div key={field.id} className="rounded-md bg-white px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {field.required ? "Required" : "Optional"}
                </p>
                <p className="font-bold text-slate-950">{field.label}</p>
                {field.allowedValues ? (
                  <p className="text-xs leading-5 text-slate-600">
                    {field.allowedValues.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {handoff.decisionReadiness ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Decision readiness
              </p>
              <h3 className="font-black text-slate-950">Ready to decide</h3>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-800">
              {handoff.decisionReadiness.summary.readyAssets}/
              {handoff.decisionReadiness.summary.totalAssets} assets ready
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(handoff.decisionReadiness.items || []).map((item) => (
              <div key={item.assetId} className="grid gap-2 rounded-md bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-slate-950">{item.label}</p>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {formatStatus(item.status)}
                  </span>
                </div>
                <ul className="grid gap-1 text-sm leading-6 text-slate-700">
                  {(item.checks || []).map((check) => (
                    <li key={`${item.assetId}-${check.id}`}>
                      <span className="font-bold text-slate-950">{check.label}: </span>
                      {check.status}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {handoff.approvalEvidenceSummary ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Approval evidence
              </p>
              <h3 className="font-black text-slate-950">Approve command gates</h3>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-800">
              {handoff.approvalEvidenceSummary.summary.coveredGates}/
              {handoff.approvalEvidenceSummary.summary.totalGates} gates covered
            </span>
          </div>
          <ul className="grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
            {(handoff.approvalEvidenceSummary.gates || []).map((gate) => (
              <li key={gate.label} className="rounded-md bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-bold text-slate-950">{gate.label}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {gate.status}
                  </span>
                </div>
                <p>{gate.evidence}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {(handoff.reviewAssets || []).map((asset) => (
          <article key={asset.assetId} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                {assetLabel(asset)}
              </p>
              <h3 className="font-black text-slate-950">{asset.label}</h3>
            </div>
            <a className="font-bold text-teal-800 underline" href={asset.assetUrl}>
              Open asset
            </a>
            {asset.contactSheetUrl ? (
              <a className="font-bold text-teal-800 underline" href={asset.contactSheetUrl}>
                Open contact sheet
              </a>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
              <span className="rounded-md bg-white px-2 py-1">
                Decisions {asset.decisionCount}
              </span>
              <span className="rounded-md bg-white px-2 py-1">
                Publish {asset.publishAllowed ? "allowed" : "blocked"}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(handoff.approvalChecklist || []).map((item) => (
          <article key={item.assetId} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Required checks
              </p>
              <h3 className="font-black text-slate-950">{item.label}</h3>
            </div>
            <p className="text-sm leading-6 text-slate-700">{item.prompt}</p>
            {item.reviewEvidence?.length ? (
              <div className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Review evidence
                </p>
                <ul className="grid gap-2 text-sm leading-6 text-slate-700">
                  {item.reviewEvidence.map((evidence) => (
                    <li key={`${item.assetId}-${evidence.label}`}>
                      {evidence.url ? (
                        <a className="font-bold text-teal-800 underline" href={evidence.url}>
                          {evidence.label}
                        </a>
                      ) : (
                        <span className="font-bold text-slate-950">{evidence.label}: </span>
                      )}
                      {evidence.summary ? <span>{evidence.summary}</span> : null}
                      {Array.isArray(evidence.checks) && evidence.checks.length ? (
                        <span>{evidence.checks.join("; ")}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ul className="grid gap-2 text-sm leading-6 text-slate-700">
              {item.requiredChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {handoff.decisionCommands.map((item) => (
          <article key={item.decision} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-950">{item.label}</h3>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {item.resultStatus}
                </p>
              </div>
              {item.copyEnabled === false ? (
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Copy disabled
                </span>
              ) : (
                <CopyButton text={item.command} label={copyLabel(item.decision)} />
              )}
            </div>
            {item.noteGuidance ? (
              <div className="rounded-md border border-slate-200 bg-white p-2 text-xs font-bold leading-5 text-slate-700">
                {item.requiresNoteEdit ? "Edit notes before running: " : "Notes: "}
                {item.noteGuidance}
              </div>
            ) : null}
            {item.effect ? (
              <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-700">
                <p className="text-sm font-bold text-slate-950">
                  {item.effect.operatorSummary}
                </p>
                <div className="grid gap-1">
                  <span>Creates approved bundle: {yesNo(item.effect.createsApprovedBundle)}</span>
                  <span>Creates manual Postiz package: {yesNo(item.effect.createsManualPostizPackage)}</span>
                  <span>Keeps Postiz blocked: {yesNo(item.effect.keepsPostizBlocked)}</span>
                  <span>Allows scheduling or publishing: {yesNo(item.effect.allowsSchedulingOrPublishing)}</span>
                </div>
              </div>
            ) : null}
            {item.evidenceChecklist?.length ? (
              <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-700">
                <p className="text-sm font-bold text-slate-950">
                  Evidence checklist
                </p>
                <ul className="grid gap-1">
                  {item.evidenceChecklist.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
              {item.command}
            </pre>
          </article>
        ))}
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        <span className="font-bold">Next: </span>
        {handoff.nextAction}
      </div>
    </section>
  );
}
