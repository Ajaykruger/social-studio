import React from "react";

function headlineClass(status) {
  if (status === "ready") return "bg-lime-100 text-lime-950";
  return "bg-amber-100 text-amber-950";
}

function formatStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PostizInputKitPanel({ kit }) {
  if (!kit) return null;

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
            Postiz Input Kit
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Real IDs checklist
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${headlineClass(kit.status)}`}>
          {formatStatus(kit.status)}
        </span>
      </div>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-5">
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Platforms: {kit.summary.requiredPlatforms}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Integrations: {kit.summary.readyIntegrations}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Media: {kit.summary.uploadedMediaReady}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Values shown: {kit.secretsInUi ? "yes" : "no"}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-800">
          Input secrets: {kit.validation.secretFieldCount || 0}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <article className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-black text-slate-950">Template files</h3>
          <div className="grid gap-1 text-sm leading-6 text-slate-700">
            <span>{kit.files.integrationsTemplate}</span>
            <span>{kit.files.uploadedMediaTemplate}</span>
          </div>
        </article>
        <article className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <h3 className="font-black">Missing values</h3>
          <div className="grid gap-1 text-sm leading-6">
            <span>
              Platforms:{" "}
              {kit.validation.missingPlatforms.length
                ? kit.validation.missingPlatforms.join(", ")
                : "none"}
            </span>
            <span>
              Uploaded media: {kit.validation.uploadedMediaReady ? "ready" : "needed"}
            </span>
            <span>
              Input secrets: {kit.validation.inputSecretsReady === false ? "remove" : "none"}
            </span>
          </div>
        </article>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(kit.validation.requiredMediaAssets || []).map((asset) => (
          <article key={asset.assetId} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Upload targets
              </p>
              <h3 className="font-black text-slate-950">{asset.label}</h3>
            </div>
            <a className="font-bold text-teal-800 underline" href={asset.assetUrl}>
              Open source asset
            </a>
            <div className="grid gap-1 text-sm leading-6 text-slate-700">
              <span>Media type: {asset.mediaType}</span>
              <span>File: {asset.localInputFile}</span>
              <span>Fields: {asset.requiredFields.join(", ")}</span>
            </div>
          </article>
        ))}
      </div>

      {kit.operatorPreflight ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Operator preflight
              </p>
              <h3 className="font-black text-slate-950">Fields to fill before dry-run</h3>
            </div>
            <span className="rounded-md bg-white px-3 py-2 text-sm font-bold text-slate-800">
              Missing checks: {kit.operatorPreflight.missingChecks}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <h4 className="font-bold text-slate-950">Integrations</h4>
              {(kit.operatorPreflight.integrationChecks || []).map((check) => (
                <div key={check.platform} className="rounded-md bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                  <span className="font-bold text-slate-950">{check.platform}: </span>
                  {check.status}. {check.localInputFile} fields {check.requiredFields.join(", ")}
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <h4 className="font-bold text-slate-950">Uploaded media</h4>
              {(kit.operatorPreflight.mediaChecks || []).map((check) => (
                <div key={check.assetId} className="rounded-md bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                  <span className="font-bold text-slate-950">{check.label}: </span>
                  {check.status}. {check.localInputFile} fields {check.requiredFields.join(", ")}
                </div>
              ))}
            </div>
          </div>
        </article>
      ) : null}

      {kit.operatorEditPlan ? (
        <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
              Operator edit plan
            </p>
            <h3 className="font-black text-slate-950">Files and records to fill</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {kit.operatorEditPlan.files.map((file) => (
              <div key={file.id} className="grid gap-2 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                <h4 className="font-bold text-slate-950">{file.file}</h4>
                <p>{file.purpose}</p>
                <p>
                  <span className="font-bold">Allowed fields: </span>
                  {file.allowedFields.join(", ")}
                </p>
                <div className="grid gap-1">
                  {file.records.map((record) => (
                    <div key={record.key} className="grid gap-1 rounded-md bg-slate-50 px-2 py-1">
                      <span>
                        {record.label}: {record.status}
                      </span>
                      {record.sourceAssetUrl ? (
                        <a className="font-bold text-teal-800 underline" href={record.sourceAssetUrl}>
                          Open reviewed source
                        </a>
                      ) : null}
                      {record.sourceInstruction ? (
                        <span>{record.sourceInstruction}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-1 text-sm leading-6 text-slate-700">
            {kit.operatorEditPlan.forbiddenFields.map((field) => (
              <span key={field}>{field}</span>
            ))}
          </div>
        </article>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-bold text-slate-950">Next: </span>
        {kit.nextAction}
      </div>
    </section>
  );
}
