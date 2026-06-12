import React from "react";

function stateClass(state) {
  if (state === "generated_needs_review") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function ProductionQueuePanel({ queue }) {
  if (!queue) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Production Queue
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Generated and waiting
          </h2>
        </div>
        <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Generated: {queue.summary.generatedAssets}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Queued: {queue.summary.packetReady}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Publish: {queue.summary.publishAllowed}
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        {queue.items.map((item) => (
          <article
            key={item.assetId}
            className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(160px,220px)_1fr_auto] md:items-start"
          >
            <div>
              <h3 className="font-black text-slate-950">{item.label}</h3>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {item.generator}
              </p>
            </div>
            <p className="text-sm leading-6 text-slate-700">{item.nextAction}</p>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide md:justify-end">
              <span className={`rounded-md border px-2 py-1 ${stateClass(item.state)}`}>
                {item.state}
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                Postiz {item.postizStatus}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
