import React from "react";
import CopyButton from "./CopyButton.jsx";

function PromptBlock({ title, text, label }) {
  if (!text) return null;

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-950">{title}</h4>
        <CopyButton text={text} label={label} />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {text}
      </p>
    </div>
  );
}

export default function ClipCard({
  clip,
  agentPrompt,
  fallbackPrompt,
  outputMode
}) {
  const showAgent = outputMode !== "fallback-only";
  const showFallback = outputMode !== "flow-agent-mode";

  return (
    <article className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-950">
          Clip {clip.clipNumber}
        </h3>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-900">
          {clip.duration}
        </span>
      </div>

      <div className="grid gap-3 text-sm leading-6 text-slate-700">
        <p>
          <strong className="text-slate-950">Action:</strong> {clip.action}
        </p>
        <p className="rounded-md bg-teal-50 p-3 text-base font-semibold text-teal-950">
          "{clip.spokenLine}"
        </p>
        <p>
          <strong className="text-slate-950">Visual note:</strong>{" "}
          {clip.visualNote}
        </p>
        <p>
          <strong className="text-slate-950">Reference asset note:</strong>{" "}
          {clip.referenceAssetNote}
        </p>
      </div>

      {showAgent ? (
        <PromptBlock
          title={agentPrompt.title}
          text={agentPrompt.prompt}
          label="Copy Agent Prompt"
        />
      ) : null}

      {showAgent ? (
        <PromptBlock
          title="Flow edit prompt"
          text={agentPrompt.editingPrompt}
          label="Copy Edit"
        />
      ) : null}

      {showFallback ? (
        <PromptBlock
          title="Seedance-style fallback"
          text={fallbackPrompt.prompt}
          label="Copy Fallback"
        />
      ) : null}
    </article>
  );
}
