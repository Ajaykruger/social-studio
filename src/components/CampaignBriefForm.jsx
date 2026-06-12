import React from "react";

const tones = [
  "Warm & encouraging",
  "Bold & direct",
  "Educational",
  "Hype/sale energy"
];

const audiencePresets = [
  "Nail techs struggling with lifting",
  "Beginner nail techs",
  "Salon owners training their team",
  "Nail techs who want better retention",
  "Students learning product control"
];

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-800">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function CampaignBriefForm({ value, onChange }) {
  function update(field, nextValue) {
    onChange({ ...value, [field]: nextValue });
  }

  const inputClass =
    "min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-teal-700";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Campaign name">
        <input
          className={inputClass}
          value={value.campaignName}
          onChange={(event) => update("campaignName", event.target.value)}
          placeholder="e.g. Rubber Base lifting fix"
        />
      </Field>

      <Field label="Target audience">
        <select
          className={inputClass}
          value={value.audience}
          onChange={(event) => update("audience", event.target.value)}
        >
          {audiencePresets.map((audience) => (
            <option key={audience} value={audience}>
              {audience}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Key pain point">
        <input
          className={inputClass}
          value={value.painPoint}
          onChange={(event) => update("painPoint", event.target.value)}
          placeholder="e.g. my gel keeps popping off after 3 days"
        />
      </Field>

      <Field label="CTA">
        <input
          className={inputClass}
          value={value.cta}
          onChange={(event) => update("cta", event.target.value)}
          placeholder="e.g. Shop Rubber Base Gel at crystalclawz.co.za"
        />
      </Field>

      <Field label="Tone">
        <select
          className={inputClass}
          value={value.tone}
          onChange={(event) => update("tone", event.target.value)}
        >
          {tones.map((tone) => (
            <option key={tone} value={tone}>
              {tone}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
