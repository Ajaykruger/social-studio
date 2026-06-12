import React from "react";

export default function ReviewMediaPanel({ packet }) {
  if (!packet) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Current Draft
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Review media
          </h2>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-950">
          {packet.statusLabel}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <video
          className="aspect-[9/16] max-h-[560px] w-full rounded-md bg-slate-950 object-contain"
          controls
          poster={packet.thumbnailUrl || undefined}
          preload="metadata"
          src={packet.videoUrl}
        >
          <track kind="captions" />
        </video>

        <div className="grid gap-3">
          <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
            <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
              Decision required: {packet.decisionRequired ? "yes" : "no"}
            </span>
            <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
              Not live: {packet.notLiveConfirmed ? "yes" : "no"}
            </span>
            <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
              Schedule/publish ready: {packet.scheduleOrPublishReady ? "yes" : "no"}
            </span>
          </div>
          <img
            src={packet.contactSheetUrl}
            alt="Review contact sheet for the current Crystal Clawz draft"
            className="w-full rounded-md border border-slate-200 bg-slate-100"
          />
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            <p>
              <span className="font-bold text-slate-950">Caption: </span>
              {packet.caption}
            </p>
            <p>
              <span className="font-bold text-slate-950">Hashtags: </span>
              {packet.hashtags.join(" ")}
            </p>
            {packet.visualReviewSummary ? (
              <p>
                <span className="font-bold text-slate-950">Review notes: </span>
                {packet.visualReviewSummary}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        <span className="font-bold">Decision required: </span>
        {packet.nextAction}
      </div>
    </section>
  );
}
