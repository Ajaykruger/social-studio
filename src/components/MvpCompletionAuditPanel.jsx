import React from "react";

function statusClass(status) {
  if (status === "complete") return "border-lime-200 bg-lime-50 text-lime-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function headlineClass(status) {
  if (status === "complete") return "bg-lime-100 text-lime-950";
  return "bg-amber-100 text-amber-950";
}

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MvpCompletionAuditPanel({ audit }) {
  if (!audit) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            MVP Completion Audit
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Whole-goal finish line
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(audit.status)}`}>
          {formatStatus(audit.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Complete: {audit.summary.completeRequirements}/{audit.summary.totalRequirements}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Blocked: {audit.summary.blockedRequirements}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          MVP complete: {audit.mvpComplete ? "yes" : "no"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {audit.requirements.map((item) => (
          <article
            key={item.id}
            className={`grid gap-2 rounded-md border p-3 ${statusClass(item.status)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-black">{item.label}</h3>
              <p className="rounded-md bg-white/70 px-2 py-1 text-xs font-bold uppercase tracking-wide">
                {item.status}
              </p>
            </div>
            <p className="text-sm leading-5">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-950">Next: </span>
        {audit.nextAction}
      </div>
    </section>
  );
}
