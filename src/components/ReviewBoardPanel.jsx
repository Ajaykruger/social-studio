import React from "react";

function actionClass(action) {
  if (action === "review_decision_required") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function assetUrl(item) {
  return item.videoUrl || item.imageUrl || "";
}

export default function ReviewBoardPanel({ board }) {
  if (!board) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Review Board
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Human decisions
          </h2>
        </div>
        <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Decide: {board.summary.decisionRequired}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Produce: {board.summary.produceBeforeReview}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Live actions: {board.liveActionsEnabled ? "on" : "off"}
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        {board.items.map((item) => (
          <article
            key={item.assetId}
            className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(160px,220px)_1fr_auto] md:items-start"
          >
            <div>
              <h3 className="font-black text-slate-950">{item.label}</h3>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {item.reviewStatus}
              </p>
            </div>
            <p className="text-sm leading-6 text-slate-700">{item.nextAction}</p>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide md:justify-end">
              {assetUrl(item) ? (
                <a
                  href={assetUrl(item)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-white px-2 py-1 text-teal-800 underline decoration-teal-300 underline-offset-2"
                >
                  Open asset
                </a>
              ) : null}
              <span className={`rounded-md border px-2 py-1 ${actionClass(item.reviewAction)}`}>
                {item.reviewAction}
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-slate-700">
                Decisions {item.decisionCount}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
