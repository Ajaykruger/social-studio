import React from "react";

export default function ReferenceAssetNote({
  product,
  scene,
  avatar,
  imageGenerator
}) {
  if (!product || !scene || !avatar) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
        Choose a product, scene, and avatar to see Jenn's reference asset list.
      </div>
    );
  }

  return (
    <section className="rounded-md border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-base font-bold text-slate-950">
        Reference Assets (before opening Flow)
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        First create these with {imageGenerator?.name || "your image tool"},
        then upload them into one Flow project:
      </p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-800">
        <li>Avatar image for {avatar.name}</li>
        <li>Product image for {product.name}</li>
        <li>Scene image for {scene.name}</li>
      </ul>
      <p className="mt-3 text-sm font-semibold text-amber-900">
        The generated pack gives copy-ready image prompts and @ names for Flow.
      </p>
    </section>
  );
}
