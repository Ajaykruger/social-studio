import React from "react";
import CopyButton from "./CopyButton.jsx";

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
  if (status === "available") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "complete") return "border-lime-200 bg-lime-50 text-lime-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

export default function MvpOperatorPacketPanel({ packet }) {
  if (!packet?.commandOnly) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            MVP Operator Packet
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            One safe handoff view
          </h2>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-950">
          {formatStatus(packet.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-4">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Current: {packet.summary.currentStep}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Complete: {packet.summary.completeRequirements}/{packet.summary.totalRequirements}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Network calls: {packet.networkCallsAllowed ? "on" : "off"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Live actions: {packet.liveActionsEnabled ? "on" : "off"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Blocked Gates</h3>
          {packet.currentBlockers.map((blocker) => (
            <div key={blocker.id} className="rounded-md bg-white p-2 text-sm leading-5 text-slate-700">
              <p className="font-bold text-slate-950">{blocker.label}</p>
              <p>{blocker.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Operator Files</h3>
          {packet.operatorFiles.map((file) => (
            <div key={file.id} className="rounded-md bg-white p-2 text-sm leading-5 text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-950">{file.label}</p>
                <CopyButton text={file.file} label="Copy" />
              </div>
              <p className="break-all font-mono text-xs">{file.file}</p>
              <p>{file.purpose}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {packet.nextSafeActions.map((action) => (
          <article key={action.id} className={`grid gap-3 rounded-md border p-3 ${statusClass(action.status)}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-black">{action.label}</h3>
              <span className="rounded-md bg-white/70 px-2 py-1 text-xs font-bold uppercase tracking-wide">
                {action.status}
              </span>
            </div>
            <p className="text-sm leading-5">{action.detail}</p>
            <p className="text-sm font-bold leading-5">{action.action}</p>
            {action.commands.map((command) => (
              <div key={command.id} className="grid gap-2 rounded-md border border-white/80 bg-white/70 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black">{command.label}</span>
                  {command.copyEnabled === false ? (
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Copy disabled
                    </span>
                  ) : (
                    <CopyButton text={command.command} label="Copy" />
                  )}
                </div>
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs leading-5 text-slate-700">
                  {command.command}
                </pre>
              </div>
            ))}
          </article>
        ))}
      </div>

      {packet.gatedUpcomingActions?.length ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
              Gated Upcoming Actions
            </p>
            <h3 className="font-black text-slate-950">Visible but not available yet</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {packet.gatedUpcomingActions.map((action) => (
              <div key={action.id} className={`grid gap-3 rounded-md border p-3 ${statusClass(action.status)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-black">{action.label}</h4>
                  <span className="rounded-md bg-white/70 px-2 py-1 text-xs font-bold uppercase tracking-wide">
                    {action.status}
                  </span>
                </div>
                <p className="text-sm leading-5">{action.detail}</p>
                <p className="text-sm font-bold leading-5">Blocked until: {action.blockedUntil}</p>
                {action.commands.map((command) => (
                  <div key={command.id} className="grid gap-2 rounded-md border border-white/80 bg-white/70 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-black">{command.label}</span>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                        Copy disabled
                      </span>
                    </div>
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs leading-5 text-slate-700">
                      {command.command}
                    </pre>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {packet.handoffSnapshot ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
              Readiness Snapshot
            </p>
            <h3 className="font-black text-slate-950">Approval and Postiz handoff</h3>
          </div>
          <div className="grid gap-2 text-sm font-bold sm:grid-cols-2">
            <span className="rounded-md bg-white px-3 py-2 text-slate-800">
              Human decision: {formatStatus(packet.handoffSnapshot.humanDecision.status)} (
              {packet.handoffSnapshot.humanDecision.readyAssets}/
              {packet.handoffSnapshot.humanDecision.totalAssets} assets ready)
            </span>
            <span className="rounded-md bg-white px-3 py-2 text-slate-800">
              Postiz inputs: {formatStatus(packet.handoffSnapshot.postizInputs.status)} (
              {packet.handoffSnapshot.postizInputs.missingChecks} missing checks)
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {(packet.handoffSnapshot.postizInputs.sourceAssets || []).map((asset) => (
              <div key={asset.key} className="grid gap-2 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                <p className="font-bold text-slate-950">{asset.label}</p>
                {asset.sourceAssetUrl ? (
                  <a className="font-bold text-teal-800 underline" href={asset.sourceAssetUrl}>
                    Open reviewed source
                  </a>
                ) : null}
                {asset.sourceInstruction ? <p>{asset.sourceInstruction}</p> : null}
                <p>Values shown: {asset.valueShown ? "yes" : "no"}</p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {packet.postizInputChecklist ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Postiz Input Checklist
              </p>
              <h3 className="font-black text-slate-950">Local IDs and uploaded media refs</h3>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-800">
              Upload refs: {packet.postizInputChecklist.summary.readyMediaAssets}/
              {packet.postizInputChecklist.summary.requiredMediaAssets}
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
            <div className="grid gap-2 rounded-md bg-white p-3">
              <p className="text-sm font-black text-slate-950">Integration slots</p>
              {(packet.postizInputChecklist.integrationSlots || []).map((slot) => (
                <div key={slot.platform} className="rounded-md bg-slate-50 p-2 text-sm leading-6 text-slate-700">
                  <p className="font-bold text-slate-950">{slot.platform}</p>
                  <p>File: {slot.localInputFile}</p>
                  <p>Fields: {slot.requiredFields.join(", ")}</p>
                  <p>Values shown: {slot.valueShown ? "yes" : "no"}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {(packet.postizInputChecklist.mediaUploadRefs || []).map((item) => (
                <div key={item.assetId} className="grid gap-2 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                  <p className="font-bold text-slate-950">{item.label}</p>
                  <p>{formatStatus(item.contentType)}</p>
                  {item.sourceAssetUrl ? (
                    <a className="font-bold text-teal-800 underline" href={item.sourceAssetUrl}>
                      Open upload source
                    </a>
                  ) : null}
                  <p>File: {item.localInputFile}</p>
                  <p>Fields: {item.requiredFields.join(", ")}</p>
                  <p>Values shown: {item.valueShown ? "yes" : "no"}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      ) : null}

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
        <h3 className="font-black text-amber-950">Forbidden Actions</h3>
        <ul className="mt-2 grid gap-1 text-sm leading-6 text-amber-950">
          {packet.forbiddenActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-950">Next: </span>
        {packet.nextAction}
      </div>
    </section>
  );
}
