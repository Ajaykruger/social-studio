import React from "react";

function statusClass(status) {
  if (status === "generated_needs_review") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "pending_production") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-rose-200 bg-rose-50 text-rose-950";
}

function headlineClass(status) {
  if (status === "generated_review_coverage_ready") return "bg-lime-100 text-lime-950";
  if (status === "partial_production_coverage") return "bg-sky-100 text-sky-950";
  return "bg-amber-100 text-amber-950";
}

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ContentCoverageAuditPanel({ audit }) {
  if (!audit) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Content Coverage Audit
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Planned versus generated
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(audit.status)}`}>
          {formatStatus(audit.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Planned: {audit.summary.plannedContentTypes}/{audit.summary.requiredContentTypes}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Generated: {audit.summary.generatedContentTypes}/{audit.summary.requiredContentTypes}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Pending: {audit.summary.pendingProductionContentTypes}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {audit.items.map((item) => (
          <article
            key={item.contentType}
            className={`grid gap-3 rounded-md border p-3 ${statusClass(item.status)}`}
          >
            <div className="grid gap-1">
              <h3 className="font-black">{item.label}</h3>
              <p className="text-xs font-bold uppercase tracking-wide opacity-75">
                {item.generator}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
              <span className="rounded-md bg-white/70 px-2 py-1">
                {item.status}
              </span>
              <span className="rounded-md bg-white/70 px-2 py-1">
                Postiz {item.postizStatus}
              </span>
            </div>
            <p className="text-sm leading-5">{item.nextAction}</p>
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
