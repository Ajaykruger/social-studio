import React from "react";

export default function SafetyChecklist({ rules }) {
  return (
    <ol className="grid gap-2 text-sm leading-6 text-slate-700">
      {rules.map((rule) => (
        <li key={rule} className="rounded-md bg-rose-50 p-3 text-rose-950">
          {rule}
        </li>
      ))}
    </ol>
  );
}
