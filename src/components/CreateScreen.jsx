import React, { useState } from "react";
import {
  createCampaignFromPack,
  generateCreative,
  importProduct
} from "../utils/studioData.js";

const TONES = ["Warm & encouraging", "Bold & direct", "Educational"];

function Field({ label, hint, children }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-950">
      {label}
      {children}
      {hint ? (
        <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-950">
      {message}
    </div>
  );
}

export default function CreateScreen({ onCampaignCreated }) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [product, setProduct] = useState(null);

  const [brief, setBrief] = useState({
    contentType: "reel_and_post",
    audience: "South African nail technicians",
    angle: "",
    approvedBenefit: "",
    cta: "",
    tone: TONES[0]
  });

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [selectedCaption, setSelectedCaption] = useState(0);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");

  function update(field, value) {
    setBrief((current) => ({ ...current, [field]: value }));
  }

  async function handleImport() {
    if (importing) return;
    setImporting(true);
    setError("");
    try {
      const imported = await importProduct(url);
      setProduct(imported);
      setGenerated(null);
      setCreated(null);
    } catch (importError) {
      setError(importError.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleGenerate() {
    if (generating || !product) return;
    setGenerating(true);
    setError("");
    setGenerated(null);
    setCreated(null);
    try {
      const result = await generateCreative(product, brief);
      setGenerated(result);
      setSelectedCaption(0);
    } catch (generateError) {
      setError(generateError.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendToReview() {
    if (sending || !generated) return;
    setSending(true);
    setError("");
    try {
      const result = await createCampaignFromPack({
        product,
        brief,
        pack: generated.pack,
        selectedCaptionIndex: selectedCaption,
        generator: generated.generator
      });
      setCreated(result);
      onCampaignCreated?.(result.campaignId);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSending(false);
    }
  }

  const briefReady = product && brief.approvedBenefit.trim().length >= 3;

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Step 1
          </p>
          <h2 className="text-2xl font-black text-slate-950">Pick a product</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Paste a crystalclawz.co.za product link. The product page is the
            approved source for claims.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
            placeholder="https://crystalclawz.co.za/products/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            inputMode="url"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || url.trim().length < 12}
            className="min-h-12 rounded-md bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {importing ? "Importing..." : "Import product"}
          </button>
        </div>

        {product ? (
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[120px_1fr]">
            {product.images?.[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="aspect-square w-full rounded-md border border-slate-200 bg-white object-cover"
              />
            ) : (
              <div className="grid aspect-square place-items-center rounded-md border border-dashed border-slate-300 text-xs font-bold text-slate-500">
                No image
              </div>
            )}
            <div className="grid gap-1">
              <p className="text-lg font-black text-slate-950">{product.name}</p>
              {product.price ? (
                <p className="text-sm font-bold text-slate-700">{product.price}</p>
              ) : null}
              {product.description ? (
                <p className="text-sm leading-6 text-slate-600">
                  {product.description.slice(0, 220)}
                  {product.description.length > 220 ? "..." : ""}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {product ? (
        <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
              Step 2
            </p>
            <h2 className="text-2xl font-black text-slate-950">Brief</h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => update("contentType", "reel_and_post")}
              className={`min-h-12 rounded-md border px-4 text-sm font-bold transition ${
                brief.contentType === "reel_and_post"
                  ? "border-teal-700 bg-teal-50 text-teal-900"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Reel + post
            </button>
            <button
              type="button"
              onClick={() => update("contentType", "post")}
              className={`min-h-12 rounded-md border px-4 text-sm font-bold transition ${
                brief.contentType === "post"
                  ? "border-teal-700 bg-teal-50 text-teal-900"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Post only
            </button>
          </div>

          <Field
            label="Approved benefit (the one claim this campaign may make)"
            hint='Pick it from the product page wording, e.g. "smooth base". Long-lasting, non-lift, strengthening, repair, and guarantee claims are blocked.'
          >
            <input
              className="min-h-12 rounded-md border border-slate-300 px-3 text-base font-normal"
              value={brief.approvedBenefit}
              onChange={(event) => update("approvedBenefit", event.target.value)}
              placeholder="smooth base"
            />
          </Field>

          {product.proposedClaims?.length ? (
            <div className="grid gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                From the product page (tap to use - using one is your approval)
              </p>
              <div className="flex flex-wrap gap-2">
                {product.proposedClaims.map((claim) => (
                  <button
                    key={claim.text}
                    type="button"
                    onClick={() => update("approvedBenefit", claim.text)}
                    className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-left text-xs leading-5 text-slate-700 hover:border-teal-600"
                  >
                    {claim.text}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Field label="Audience">
            <input
              className="min-h-12 rounded-md border border-slate-300 px-3 text-base font-normal"
              value={brief.audience}
              onChange={(event) => update("audience", event.target.value)}
            />
          </Field>

          <Field label="Angle / pain point (optional)">
            <input
              className="min-h-12 rounded-md border border-slate-300 px-3 text-base font-normal"
              value={brief.angle}
              onChange={(event) => update("angle", event.target.value)}
              placeholder="French work looks messy when the base is uneven"
            />
          </Field>

          <Field label="Call to action (optional)">
            <input
              className="min-h-12 rounded-md border border-slate-300 px-3 text-base font-normal"
              value={brief.cta}
              onChange={(event) => update("cta", event.target.value)}
              placeholder={`Shop ${product.name} at crystalclawz.co.za`}
            />
          </Field>

          <Field label="Tone">
            <select
              className="min-h-12 rounded-md border border-slate-300 px-3 text-base font-normal"
              value={brief.tone}
              onChange={(event) => update("tone", event.target.value)}
            >
              {TONES.map((tone) => (
                <option key={tone}>{tone}</option>
              ))}
            </select>
          </Field>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!briefReady || generating}
            className="min-h-14 rounded-md bg-teal-700 px-5 text-base font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {generating ? "Generating (this can take a minute)..." : "Generate content"}
          </button>
        </div>
      ) : null}

      <ErrorNote message={error} />

      {generated ? (
        <div className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
                Step 3
              </p>
              <h2 className="text-2xl font-black text-slate-950">Review the draft</h2>
            </div>
            <div className="grid justify-items-end gap-1">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-950">
                Claim guard: passed
              </span>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {generated.generator === "claude" ? "AI generated" : "Template generated"}
              </span>
            </div>
          </div>
          {generated.generatorNote ? (
            <p className="rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-950">
              {generated.generatorNote}
            </p>
          ) : null}

          <div className="grid gap-2">
            <h3 className="font-black text-slate-950">Caption (pick one)</h3>
            {generated.pack.captions.map((caption, index) => (
              <label
                key={caption}
                className={`flex items-start gap-3 rounded-md border p-3 text-sm leading-6 ${
                  selectedCaption === index
                    ? "border-teal-600 bg-teal-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="caption"
                  className="mt-1 h-5 w-5 accent-teal-700"
                  checked={selectedCaption === index}
                  onChange={() => setSelectedCaption(index)}
                />
                {caption}
              </label>
            ))}
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {generated.pack.hashtags.join(" ")}
            </p>
          </div>

          <div className="grid gap-2">
            <h3 className="font-black text-slate-950">Hooks</h3>
            <ul className="grid gap-1 text-sm leading-6 text-slate-700">
              {generated.pack.hooks.map((hook) => (
                <li key={hook}>- {hook}</li>
              ))}
            </ul>
          </div>

          {brief.contentType === "reel_and_post" ? (
            <div className="grid gap-2">
              <h3 className="font-black text-slate-950">Reel script</h3>
              <div className="grid gap-2">
                {generated.pack.reelScript.map((scene, index) => (
                  <div
                    key={`${scene.voiceover}-${index}`}
                    className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Scene {index + 1} - {scene.seconds}s
                    </p>
                    <p className="text-slate-700">
                      <span className="font-bold text-slate-950">Visual: </span>
                      {scene.visual}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-bold text-slate-950">Voiceover: </span>
                      {scene.voiceover}
                    </p>
                  </div>
                ))}
              </div>
              <p className="rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-950">
                The reel video itself renders separately (MoneyPrinterTurbo on
                the studio PC). Approval stays blocked until the rendered video
                is attached for review.
              </p>
            </div>
          ) : null}

          {created ? (
            <div className="grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-lg font-black text-emerald-950">
                Sent to review: {created.campaignId}
              </p>
              <p className="text-sm leading-6 text-emerald-950">
                The draft is now in the Review tab waiting for a human
                decision. Nothing is scheduled or published.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSendToReview}
              disabled={sending}
              className="min-h-14 rounded-md bg-slate-950 px-5 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {sending ? "Creating draft..." : "Send to review"}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
