import React from "react";

function statusClass(status) {
  if (status === "ready") return "border-lime-200 bg-lime-50 text-lime-950";
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

export default function PostizDryRunReadinessPanel({ readiness }) {
  if (!readiness) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Postiz Dry-Run Readiness
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Draft handoff gates
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(readiness.status)}`}>
          {formatStatus(readiness.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Dry-run only: {readiness.dryRunOnly ? "yes" : "no"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Network calls: {readiness.networkCallsAllowed ? "on" : "off"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Not live: {readiness.noLivePosting ? "yes" : "no"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {readiness.steps.map((step) => (
          <article
            key={step.id}
            className={`grid min-h-32 gap-2 rounded-md border p-3 ${statusClass(step.status)}`}
          >
            <h3 className="text-sm font-black">{step.label}</h3>
            <p className="text-xs font-bold uppercase tracking-wide">{step.status}</p>
            <p className="text-sm leading-5">{step.detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 md:grid-cols-[1fr_auto] md:items-center">
        <p>
          <span className="font-bold text-slate-950">Next: </span>
          {readiness.nextAction}
        </p>
        <span className="w-fit rounded-md bg-white px-3 py-2 font-bold text-slate-800">
          Ready {readiness.summary.readySteps}/{readiness.summary.totalSteps}
        </span>
      </div>
    </section>
  );
}
