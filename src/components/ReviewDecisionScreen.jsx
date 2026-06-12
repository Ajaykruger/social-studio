import React, { useMemo, useState } from "react";
import { submitDecision } from "../utils/studioData.js";

function statusPill(status) {
  if (status === "needs_review") return "bg-amber-100 text-amber-950";
  if (status === "needs_revision") return "bg-orange-100 text-orange-950";
  if (status === "rejected") return "bg-rose-100 text-rose-950";
  if (String(status || "").startsWith("approved")) {
    return "bg-emerald-100 text-emerald-950";
  }
  return "bg-slate-100 text-slate-800";
}

function formatStatus(status) {
  return String(status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MediaPreview({ asset }) {
  const [failed, setFailed] = useState(false);

  if (failed || !asset.assetUrl) {
    return (
      <div className="grid aspect-square place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm font-bold text-slate-500">
        Media not available
        {asset.assetUrl ? (
          <span className="break-all text-xs font-normal">{asset.assetUrl}</span>
        ) : null}
      </div>
    );
  }

  if (/\.mp4($|\?)/i.test(asset.assetUrl)) {
    return (
      <video
        className="aspect-[9/16] max-h-96 w-full rounded-md bg-slate-950 object-contain"
        controls
        playsInline
        preload="metadata"
        src={asset.assetUrl}
        onError={() => setFailed(true)}
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    <img
      src={asset.assetUrl}
      alt={`${asset.label} draft`}
      className="w-full rounded-md border border-slate-200 bg-white"
      onError={() => setFailed(true)}
    />
  );
}

function AssetCard({ asset }) {
  return (
    <article className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-slate-950">{asset.label}</h3>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          Draft
        </span>
      </div>
      <MediaPreview asset={asset} />
      {asset.contactSheetUrl ? (
        <a
          className="text-sm font-bold text-teal-800 underline"
          href={asset.contactSheetUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open contact sheet
        </a>
      ) : null}
    </article>
  );
}

export default function ReviewDecisionScreen({
  campaignId,
  workflowStatus,
  reviewPacket,
  handoff,
  ledger,
  campaignState,
  onDecided
}) {
  const [mode, setMode] = useState("");
  const [reviewer, setReviewer] = useState("Jen");
  const [checkedGates, setCheckedGates] = useState([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const gates = campaignState?.approvalEvidenceGates || [];
  const status = workflowStatus?.status || "unknown";
  const alreadyApproved = Boolean(campaignState?.bundles?.approved);
  const decisionOpen = !alreadyApproved && !result;

  const assets = useMemo(() => {
    if (reviewPacket?.assets?.length) return reviewPacket.assets;
    const reviewAssets = handoff?.reviewAssets || [];
    if (reviewAssets.length > 0) return reviewAssets;
    if (reviewPacket?.videoUrl) {
      return [
        {
          assetId: "primary",
          label: "UGC video",
          assetUrl: reviewPacket.videoUrl,
          contactSheetUrl: reviewPacket.contactSheetUrl
        }
      ];
    }
    return [];
  }, [handoff, reviewPacket]);

  const allGatesChecked =
    gates.length > 0 && gates.every((gate) => checkedGates.includes(gate));
  const notesReady = notes.trim().length >= 10;
  const reviewerReady = reviewer.trim().length >= 2;

  function toggleGate(gate) {
    setCheckedGates((current) =>
      current.includes(gate)
        ? current.filter((item) => item !== gate)
        : [...current, gate]
    );
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        decision: mode,
        reviewer: reviewer.trim(),
        notes: notes.trim(),
        gates: mode === "approve" ? checkedGates : []
      };
      const response = await submitDecision(campaignId, payload);
      setResult(response);
      onDecided?.(response);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    reviewerReady &&
    (mode === "approve" ? allGatesChecked : notesReady) &&
    !submitting;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Campaign review
          </p>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusPill(status)}`}>
            {formatStatus(status)}
          </span>
        </div>
        <h2 className="text-2xl font-black text-slate-950">{campaignId}</h2>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-950">
          Approval creates a manual Postiz draft package only. Nothing is
          scheduled. Nothing is published. Posting live always needs a separate
          approval later.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <AssetCard key={asset.assetId || asset.label} asset={asset} />
        ))}
        {assets.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">
            No review assets found for this campaign yet.
          </p>
        ) : null}
      </div>

      {reviewPacket ? (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          <p>
            <span className="font-bold text-slate-950">Caption: </span>
            {reviewPacket.caption}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {(reviewPacket.hashtags || []).join(" ")}
          </p>
          {reviewPacket.visualReviewSummary ? (
            <p>{reviewPacket.visualReviewSummary}</p>
          ) : null}
        </div>
      ) : null}

      {ledger?.brandRules?.length ? (
        <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">
            Brand and claim rules ({ledger.brandRules.length})
          </summary>
          <ul className="mt-2 grid gap-1 text-sm leading-6 text-slate-700">
            {ledger.brandRules.map((rule) => (
              <li key={rule}>- {rule}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {result ? (
        <div className="grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-lg font-black text-emerald-950">
            Decision recorded: {formatStatus(result.decision)}
          </p>
          <p className="text-sm leading-6 text-emerald-950">
            Status is now {formatStatus(result.status)}.{" "}
            {result.decision === "approve"
              ? "An approved draft package was created for manual Postiz upload. Nothing has been posted."
              : "Postiz stays blocked for this campaign."}
          </p>
        </div>
      ) : null}

      {alreadyApproved && !result ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold leading-6 text-emerald-950">
          This campaign already has a recorded approval. Re-approving from the
          app is blocked to protect the existing approval evidence.
        </div>
      ) : null}

      {decisionOpen ? (
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-slate-950">
            Reviewer
            <input
              className="min-h-12 rounded-md border border-slate-300 px-3 text-base font-normal"
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value)}
              placeholder="Your name"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setMode("approve")}
              className={`min-h-14 rounded-md px-4 text-base font-black text-white transition ${
                mode === "approve" ? "bg-emerald-700 ring-4 ring-emerald-200" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setMode("needs_revision")}
              className={`min-h-14 rounded-md px-4 text-base font-black text-white transition ${
                mode === "needs_revision" ? "bg-amber-600 ring-4 ring-amber-200" : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              Needs changes
            </button>
            <button
              type="button"
              onClick={() => setMode("reject")}
              className={`min-h-14 rounded-md px-4 text-base font-black text-white transition ${
                mode === "reject" ? "bg-rose-700 ring-4 ring-rose-200" : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              Reject
            </button>
          </div>

          {mode === "approve" ? (
            <div className="grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-bold text-emerald-950">
                Confirm each check. Approval means Postiz draft upload only.
              </p>
              {gates.map((gate) => (
                <label
                  key={gate}
                  className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm leading-6 text-slate-800"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-emerald-700"
                    checked={checkedGates.includes(gate)}
                    onChange={() => toggleGate(gate)}
                  />
                  {gate}
                </label>
              ))}
              <textarea
                className="min-h-20 rounded-md border border-slate-300 p-3 text-base"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes"
              />
            </div>
          ) : null}

          {mode === "needs_revision" || mode === "reject" ? (
            <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-950">
                {mode === "needs_revision"
                  ? "Describe exactly what must change before this can be approved."
                  : "Describe why this campaign should not continue to Postiz."}
              </p>
              <textarea
                className="min-h-28 rounded-md border border-slate-300 p-3 text-base"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Be specific - this is recorded as the decision evidence."
              />
              {!notesReady && notes ? (
                <p className="text-xs font-bold text-rose-700">
                  Please write at least a full sentence.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-950">
              {error}
            </div>
          ) : null}

          {mode ? (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="min-h-14 rounded-md bg-slate-950 px-5 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {submitting
                ? "Recording decision..."
                : `Confirm: ${formatStatus(mode)}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
