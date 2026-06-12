import React from "react";
import CopyButton from "./CopyButton.jsx";

function statusClass(status) {
  if (status === "complete") return "border-lime-200 bg-lime-50 text-lime-950";
  if (status === "available") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function headlineClass(status) {
  if (status === "complete") return "bg-lime-100 text-lime-950";
  if (status === "ready_for_postiz_dry_run") return "bg-sky-100 text-sky-950";
  return "bg-amber-100 text-amber-950";
}

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MvpFinishPathPanel({ finishPath }) {
  if (!finishPath?.commandOnly) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            MVP Finish Path
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Ordered handoff steps
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(finishPath.status)}`}>
          {formatStatus(finishPath.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-4">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Current: {finishPath.summary.currentStep}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Complete: {finishPath.summary.completeSteps}/{finishPath.summary.totalSteps}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Network calls: {finishPath.networkCallsAllowed ? "on" : "off"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Live actions: {finishPath.liveActionsEnabled ? "on" : "off"}
        </span>
      </div>

      <div className="grid gap-3">
        {finishPath.steps.map((step, index) => (
          <article
            key={step.id}
            className={`grid gap-3 rounded-md border p-3 ${statusClass(step.status)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide opacity-75">
                  Step {index + 1}
                </p>
                <h3 className="font-black">{step.label}</h3>
              </div>
              <p className="rounded-md bg-white/70 px-2 py-1 text-xs font-bold uppercase tracking-wide">
                {step.status}
              </p>
            </div>
            <p className="text-sm leading-5">{step.detail}</p>
            <p className="text-sm font-bold leading-5">{step.action}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {step.preflightChecks?.length ? (
                <div className="grid gap-2 rounded-md border border-white/80 bg-white/70 p-2">
                  <p className="text-xs font-bold uppercase tracking-wide opacity-75">
                    Preflight
                  </p>
                  <ul className="grid gap-1 text-sm leading-5">
                    {step.preflightChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {step.expectedOutputs?.length ? (
                <div className="grid gap-2 rounded-md border border-white/80 bg-white/70 p-2">
                  <p className="text-xs font-bold uppercase tracking-wide opacity-75">
                    Expected outputs
                  </p>
                  <ul className="grid gap-1 text-sm leading-5">
                    {step.expectedOutputs.map((output) => (
                      <li key={output}>{output}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {step.commands?.length ? (
              <div className="grid gap-2">
                {step.commands.map((command) => (
                  <div
                    key={`${step.id}-${command.id}`}
                    className="grid gap-2 rounded-md border border-white/80 bg-white/70 p-2"
                  >
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
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-950">Next: </span>
        {finishPath.nextAction}
      </div>
    </section>
  );
}
