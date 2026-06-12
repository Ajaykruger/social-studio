import React from "react";

function formatToken(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function publishClass(asset) {
  if (asset.publishAllowed) return "border-rose-200 bg-rose-50 text-rose-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

export default function BrandClaimLedgerPanel({ ledger }) {
  if (!ledger) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Brand Claim Ledger
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Claims and proof checks
          </h2>
        </div>
        <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Assets: {ledger.summary.totalAssets}
          </span>
          <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-950">
            Claim checks: {ledger.summary.assetsNeedingHumanClaimCheck}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Publish allowed: {ledger.summary.publishAllowed}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {ledger.assets.map((asset) => (
          <article
            key={asset.assetId}
            className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid gap-1">
              <h3 className="font-black text-slate-950">{asset.label}</h3>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {formatToken(asset.contentType)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm font-bold">
              <span className="rounded-md bg-white px-2 py-2 text-slate-700">
                Approved: {asset.approvedBenefitCount}
              </span>
              <span className="rounded-md bg-white px-2 py-2 text-slate-700">
                Blocked: {asset.blockedClaimCount}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
              <span className={`rounded-md border px-2 py-1 ${publishClass(asset)}`}>
                {asset.publishAllowed ? "Publish allowed" : "Publish blocked"}
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                {formatToken(asset.reviewStatus)}
              </span>
            </div>

            <div className="grid gap-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Required visuals
              </p>
              <div className="flex flex-wrap gap-2">
                {asset.requiredVisuals.map((visual) => (
                  <span
                    key={`${asset.assetId}-${visual}`}
                    className="rounded-md bg-teal-50 px-2 py-1 text-xs font-bold uppercase tracking-wide text-teal-900"
                  >
                    {formatToken(visual)}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Brand rules
        </p>
        <ul className="grid gap-1 text-sm leading-6 text-slate-700 md:grid-cols-2">
          {ledger.brandRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
