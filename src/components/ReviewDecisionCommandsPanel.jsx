import React from "react";
import CopyButton from "./CopyButton.jsx";

function copyLabel(decision) {
  if (decision === "approve") return "Copy approve command";
  if (decision === "needs_revision") return "Copy revision command";
  if (decision === "reject") return "Copy reject command";
  return "Copy command";
}

function yesNo(value) {
  return value ? "yes" : "no";
}

export default function ReviewDecisionCommandsPanel({ packet }) {
  if (!packet?.commandOnly) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Review Decision
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Approval Action Center
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-800">
          Command only
        </span>
      </div>

      {packet.summary ? (
        <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 md:grid-cols-[1fr_1fr_auto] md:items-center">
          <p>
            <span className="font-bold">Blocked:</span> {packet.summary.blocker}
          </p>
          <p>
            <span className="font-bold">Next:</span> {packet.summary.nextAction}
          </p>
          <span className="w-fit rounded-md bg-white px-3 py-2 font-bold">
            Commands: {packet.summary.commandCount}
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {packet.commands.map((item) => (
          <article
            key={item.decision}
            className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
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
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
              {item.command}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}
