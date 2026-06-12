import React from "react";

function packetLabel(packetType) {
  if (packetType === "moneyprinter_video_request") return "MoneyPrinter request";
  if (packetType === "static_post_copy_brief") return "Post copy brief";
  return packetType;
}

export default function ProductionPacketsPanel({ packets }) {
  if (!packets) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Production Packets
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Ready to produce after review
          </h2>
        </div>
        <div className="grid gap-2 text-sm font-bold sm:grid-cols-2">
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Network calls: {packets.networkCallsAllowed ? "allowed" : "off"}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
            Postiz blocked: {packets.postizBlockedUntilApproval ? "yes" : "no"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {packets.assets.map((asset) => (
          <article
            key={asset.assetId}
            className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid gap-1">
              <h3 className="font-black text-slate-950">{asset.label}</h3>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {packetLabel(asset.packetType)}
              </p>
            </div>
            <div className="grid gap-2 text-sm leading-6 text-slate-700">
              <span>Generator: {asset.generator}</span>
              <span>Review: {asset.reviewStatus}</span>
              <span>Postiz: {asset.postizStatus}</span>
              <span>Publish: {asset.publishAllowed ? "allowed" : "blocked"}</span>
            </div>
            {asset.details ? (
              <div className="grid gap-2 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                <span>
                  <span className="font-bold text-slate-950">Platforms: </span>
                  {asset.details.platforms?.join(", ") || "none"}
                </span>
                <span>
                  <span className="font-bold text-slate-950">Formats: </span>
                  {asset.details.formats?.join(", ") || "none"}
                </span>
                <span>
                  <span className="font-bold text-slate-950">Postiz format: </span>
                  {asset.details.postizFormat || "none"}
                </span>
                {asset.details.promptSummary ? (
                  <p>
                    <span className="font-bold text-slate-950">Prompt: </span>
                    {asset.details.promptSummary}
                  </p>
                ) : null}
                {asset.details.captionDraft ? (
                  <p>
                    <span className="font-bold text-slate-950">Caption: </span>
                    {asset.details.captionDraft}
                  </p>
                ) : null}
                {asset.details.designBrief ? (
                  <p>
                    <span className="font-bold text-slate-950">Design brief: </span>
                    {asset.details.designBrief}
                  </p>
                ) : null}
                {asset.details.reviewFocus?.length ? (
                  <p>
                    <span className="font-bold text-slate-950">Review focus: </span>
                    {asset.details.reviewFocus.join("; ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
