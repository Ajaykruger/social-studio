import React from "react";

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-800">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select
        className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 shadow-sm transition focus:border-teal-700"
        value={value?.id}
        onChange={(event) =>
          onChange(options.find((option) => option.id === event.target.value))
        }
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

export default function WorkflowSetupForm({
  product,
  products,
  setProduct,
  videoType,
  videoTypes,
  setVideoType,
  scene,
  scenes,
  setScene,
  avatar,
  avatars,
  setAvatar,
  engine,
  engines,
  setEngine,
  imageGenerator,
  imageGenerators,
  setImageGenerator
}) {
  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Campaign setup</h2>
          <p className="text-sm leading-6 text-slate-600">
            Pick the basics once. The pack will create image prompts first, then
            Flow prompts.
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-900">
          Compact mode
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Product"
          value={product}
          onChange={setProduct}
          options={products}
        />
        <SelectField
          label="Video type"
          value={videoType}
          onChange={setVideoType}
          options={videoTypes}
        />
        <SelectField
          label="Scene"
          value={scene}
          onChange={setScene}
          options={scenes}
        />
        <SelectField
          label="Avatar"
          value={avatar}
          onChange={setAvatar}
          options={avatars}
        />
        <SelectField
          label="Image generator"
          value={imageGenerator}
          onChange={setImageGenerator}
          options={imageGenerators}
        />
        <SelectField
          label="Output pack"
          value={engine}
          onChange={setEngine}
          options={engines}
        />
      </div>
    </section>
  );
}
