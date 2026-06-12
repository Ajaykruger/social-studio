import React from "react";
import ClipCard from "./ClipCard.jsx";
import CopyButton from "./CopyButton.jsx";
import SafetyChecklist from "./SafetyChecklist.jsx";
import { downloadPack } from "../utils/exportJson.js";

function TextSection({ title, text, copyLabel = "Copy" }) {
  return (
    <section className="grid gap-3 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        <CopyButton text={text} label={copyLabel} />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {text}
      </p>
    </section>
  );
}

function ListSection({ title, items, copyLabel = "Copy" }) {
  const text = items.join("\n");

  return (
    <section className="grid gap-3 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        <CopyButton text={text} label={copyLabel} />
      </div>
      <ul className="grid gap-2 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-white p-3 shadow-sm">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AssetPromptSection({ prompts }) {
  return (
    <section className="grid gap-3 border-t border-slate-200 pt-5">
      <div>
        <h3 className="text-lg font-bold text-slate-950">
          1. Reference Image Prompts
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Copy these into the selected image generator first. Upload the
          generated images into Flow using the shown @ names.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {prompts.map((asset) => (
          <article
            key={asset.id}
            className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-950">{asset.title}</h4>
                <p className="text-sm font-bold text-amber-900">
                  Upload as {asset.assetName}
                </p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {asset.promptType}
                </p>
              </div>
              <CopyButton text={asset.prompt} label="Copy Image Prompt" />
            </div>
            <p className="text-sm leading-6 text-slate-700">{asset.useIn}</p>
            <p className="text-sm leading-6 text-slate-700">{asset.prompt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function OutputPanel({ pack, outputMode }) {
  if (!pack) return null;

  return (
    <section className="grid gap-5 pb-24" id="output-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Your UGC workflow pack
          </p>
          <h2 className="text-2xl font-black text-slate-950">
            {pack.meta.campaignName}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {pack.workflowSummary}
          </p>
        </div>
        <span className="rounded-full bg-lime-100 px-3 py-1 text-sm font-bold text-lime-950">
          {pack.clipScript.length} Flow clips ready
        </span>
      </div>

      <AssetPromptSection prompts={pack.referenceAssetPrompts} />
      <ListSection
        title="2. Flow Project Setup"
        items={pack.flowSetupChecklist}
        copyLabel="Copy Setup"
      />

      <section className="grid gap-4 border-t border-slate-200 pt-5">
        <div>
          <h3 className="text-lg font-bold text-slate-950">
            3. Clip-by-Clip Agent Mode Prompts
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Generate one clip at a time inside the same Flow conversation. Keep
            using the @ asset names.
          </p>
        </div>
        {pack.clipScript.map((clip) => (
          <ClipCard
            key={clip.clipNumber}
            clip={clip}
            agentPrompt={pack.agentModePrompts.find(
              (prompt) => prompt.clip === clip.clipNumber
            )}
            fallbackPrompt={pack.fallbackPrompts.find(
              (prompt) => prompt.clip === clip.clipNumber
            )}
            outputMode={outputMode}
          />
        ))}
      </section>

      <ListSection
        title="4. Flow Conversational Edits"
        items={pack.editingPrompts}
        copyLabel="Copy Edits"
      />
      <ListSection title="Hooks" items={pack.hooks} copyLabel="Copy Hooks" />
      <TextSection title="Caption" text={pack.caption} copyLabel="Copy Caption" />
      <TextSection title="CTA" text={pack.cta} copyLabel="Copy CTA" />
      <ListSection
        title="Final Asset Checklist"
        items={pack.assetChecklist}
        copyLabel="Copy List"
      />

      <section className="grid gap-3 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-950">Safety Checklist</h3>
          <CopyButton
            text={pack.safetyChecklist.join("\n")}
            label="Copy List"
          />
        </div>
        <SafetyChecklist rules={pack.safetyChecklist} />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
        <div className="mx-auto flex max-w-6xl justify-end">
          <button
            type="button"
            onClick={() => downloadPack(pack)}
            className="min-h-12 rounded-md bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Export Full Pack as JSON
          </button>
        </div>
      </div>
    </section>
  );
}
