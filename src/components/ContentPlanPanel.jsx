import React from "react";

function statusClass(asset) {
  if (asset.publishAllowed) return "border-rose-200 bg-rose-50 text-rose-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

export default function ContentPlanPanel({ plan }) {
  if (!plan) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Content Plan
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Campaign asset stack
          </h2>
        </div>
        <div className="grid gap-2 text-sm font-bold sm:grid-cols-2">
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Not live: {plan.noLivePosting ? "yes" : "no"}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Postiz after approval: {plan.postizDraftOnlyAfterApproval ? "yes" : "no"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {plan.assets.map((asset) => (
          <article
            key={asset.assetId}
            className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid gap-1">
              <h3 className="font-black text-slate-950">{asset.label}</h3>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {asset.generator}
              </p>
            </div>
            <p className="text-sm leading-6 text-slate-700">{asset.angle}</p>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                {asset.output}
              </span>
              <span className={`rounded-md border px-2 py-1 ${statusClass(asset)}`}>
                {asset.postizStatus}
              </span>
            </div>
            <div className="grid gap-1 text-sm leading-6 text-slate-700">
              <span>Review: {asset.reviewRequired ? "required" : "not required"}</span>
              <span>Publish: {asset.publishAllowed ? "allowed" : "blocked"}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
