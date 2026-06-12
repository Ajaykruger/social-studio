import React from "react";
import CopyButton from "./CopyButton.jsx";

function statusClass(status) {
  if (status === "ready") return "border-lime-200 bg-lime-50 text-lime-950";
  if (status === "available") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function headlineClass(status) {
  if (status === "ready_for_dry_run" || status === "dry_run_ready") {
    return "bg-lime-100 text-lime-950";
  }
  return "bg-amber-100 text-amber-950";
}

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PostizCommandCenterPanel({ center }) {
  if (!center?.commandOnly) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Postiz Command Center
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Copy safe handoff commands
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(center.status)}`}>
          {formatStatus(center.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Command only: {center.commandOnly ? "yes" : "no"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Network calls: {center.networkCallsAllowed ? "on" : "off"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Live actions: {center.liveActionsEnabled ? "on" : "off"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(center.prerequisiteChecklist || []).map((item) => (
          <article
            key={item.id}
            className={`grid gap-2 rounded-md border p-3 ${statusClass(item.status)}`}
          >
            <p className="text-xs font-bold uppercase tracking-wide">Prerequisites</p>
            <h3 className="font-black">{item.label}</h3>
            <p className="text-sm font-bold">{item.status}</p>
            <p className="text-sm leading-6">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {center.commands.map((item) => (
          <article
            key={item.id}
            className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-black text-slate-950">{item.label}</h3>
                <p className={`mt-1 w-fit rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-wide ${statusClass(item.status)}`}>
                  {item.status}
                </p>
              </div>
              {item.copyEnabled === false ? (
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Copy disabled
                </span>
              ) : (
                <CopyButton text={item.command} label="Copy" />
              )}
            </div>
            <p className="text-sm leading-6 text-slate-700">{item.guardrail}</p>
            <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-700">
              <p>
                <span className="font-bold text-slate-950">Requires: </span>
                {item.requires?.length ? item.requires.join(", ") : "none"}
              </p>
              <p>
                <span className="font-bold text-slate-950">Writes: </span>
                {item.writes?.length ? item.writes.join(", ") : "none"}
              </p>
              <div>
                <p className="font-bold text-slate-950">Never:</p>
                <ul className="mt-1 grid gap-1">
                  {(item.never || []).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
              {item.command}
            </pre>
          </article>
        ))}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-950">Next: </span>
        {center.nextAction}
      </div>
    </section>
  );
}
