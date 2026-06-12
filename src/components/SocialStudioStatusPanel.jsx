import React from "react";

function badgeClass(status) {
  if (status === "ready") return "border-lime-200 bg-lime-50 text-lime-950";
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function headlineClass(status) {
  if (status === "postiz_draft_ready") return "bg-lime-100 text-lime-950";
  if (status === "blocked") return "bg-rose-100 text-rose-950";
  return "bg-amber-100 text-amber-950";
}

export default function SocialStudioStatusPanel({ status }) {
  if (!status) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Social Studio
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Review-first pipeline
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(
            status.status
          )}`}
        >
          {status.statusLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="grid gap-2 text-sm leading-6 text-slate-700">
          <p>
            Campaign: <span className="font-bold">{status.campaignId}</span>
          </p>
          <p>{status.blocker || status.nextAction}</p>
        </div>
        <div className="grid gap-2 text-sm font-bold">
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Not live: {status.noLivePosting ? "yes" : "no"}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Postiz draft ready: {status.postizDraftReady ? "yes" : "no"}
          </span>
        </div>
      </div>

      {status.freshness ? (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
          <p className="font-bold text-slate-950 md:col-span-2">Artifact freshness</p>
          <p>
            Status generated: <span className="font-bold">{status.freshness.generatedAt}</span>
          </p>
          <p>
            Source bundle: <span className="font-bold">{status.freshness.sourceBundle}</span>
          </p>
          <p>
            Source generated: <span className="font-bold">{status.freshness.sourceGeneratedAt || "unknown"}</span>
          </p>
          <p>
            Generated path: <span className="font-bold">{status.freshness.generatedPath}</span>
          </p>
        </div>
      ) : null}

      <ol className="grid gap-2 md:grid-cols-5">
        {status.stages.map((stage) => (
          <li
            key={stage.name}
            className={`grid min-h-28 gap-2 rounded-md border p-3 ${badgeClass(
              stage.status
            )}`}
          >
            <span className="text-sm font-black">{stage.name}</span>
            <span className="text-xs font-bold uppercase tracking-wide">
              {stage.status}
            </span>
            <span className="text-sm leading-5">{stage.label}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-950">Next: </span>
        {status.nextAction}
      </div>
    </section>
  );
}
