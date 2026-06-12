import React from "react";

function headlineClass(status) {
  if (status === "ready") return "bg-lime-100 text-lime-950";
  return "bg-amber-100 text-amber-950";
}

function statusClass(status) {
  if (status === "ready") return "border-lime-200 bg-lime-50 text-lime-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PostizLocalInputValidationPanel({ validation }) {
  if (!validation?.commandOnly) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Postiz Local Input Validation
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Dry-run preflight result
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(validation.status)}`}>
          {formatStatus(validation.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-4">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Ready: {validation.readyForDryRun ? "yes" : "no"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Missing: {validation.summary.missingChecks}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Values shown: {validation.operatorPreflight.valueShown ? "yes" : "no"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Network calls: {validation.networkCallsAllowed ? "on" : "off"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <article className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Blocking reasons</h3>
          <div className="flex flex-wrap gap-2">
            {(validation.blockingReasons || []).map((reason) => (
              <span key={reason} className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-800">
                {formatStatus(reason)}
              </span>
            ))}
          </div>
        </article>
        <article className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Local files</h3>
          <div className="grid gap-1 text-sm leading-6 text-slate-700">
            <span>{validation.files.integrations}</span>
            <span>{validation.files.uploadedMedia}</span>
          </div>
        </article>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <article className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Integrations</h3>
          {(validation.operatorPreflight.integrationChecks || []).map((check) => (
            <div key={check.platform} className={`rounded-md border p-3 text-sm leading-6 ${statusClass(check.status)}`}>
              <span className="font-bold">{check.platform}: </span>
              {check.status}. {check.localInputFile} fields {check.requiredFields.join(", ")}
              <p>Missing fields: {(check.missingFields || []).join(", ") || "none"}</p>
            </div>
          ))}
        </article>
        <article className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Uploaded media</h3>
          {(validation.operatorPreflight.mediaChecks || []).map((check) => (
            <div key={check.assetId} className={`rounded-md border p-3 text-sm leading-6 ${statusClass(check.status)}`}>
              <span className="font-bold">{check.label}: </span>
              {check.status}. {check.localInputFile} fields {check.requiredFields.join(", ")}
              <p>Missing fields: {(check.missingFields || []).join(", ") || "none"}</p>
            </div>
          ))}
        </article>
      </div>

      {validation.operatorEditPlan ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
              Operator edit plan
            </p>
            <h3 className="font-black text-slate-950">Open these local files</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {validation.operatorEditPlan.files.map((file) => (
              <div key={file.id} className="rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                <p className="font-bold text-slate-950">{file.file}</p>
                <p>{file.records.length} records need attention.</p>
                <p>Allowed fields: {file.allowedFields.join(", ")}</p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-950">Next: </span>
        {validation.nextAction}
      </div>
    </section>
  );
}
