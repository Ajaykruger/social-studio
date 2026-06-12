import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findBlockedClaims,
  findBlockedClaimsInObject
} from "../../src/utils/claimGuard.js";
import { generatePack } from "../../src/utils/generatePack.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "src", "data");

async function readJson(name) {
  return JSON.parse(await readFile(path.join(dataDir, name), "utf8"));
}

const TONES = [
  "Warm & encouraging",
  "Bold & direct",
  "Educational",
  "Hype/sale energy"
];

async function loadFormDefaults() {
  const [products, videoTypes, scenes, avatars, engines, imageGenerators] =
    await Promise.all([
      readJson("products.json"),
      readJson("videoTypes.json"),
      readJson("scenes.json"),
      readJson("avatars.json"),
      readJson("engines.json"),
      readJson("imageGenerators.json")
    ]);
  return { products, videoTypes, scenes, avatars, engines, imageGenerators };
}

function makeFormState(data, overrides = {}) {
  return {
    campaignName: "Rubber base demo",
    audience: "Nail techs struggling with lifting",
    painPoint: "my gel keeps coming loose at the cuticle",
    cta: "Shop Crystal Clawz French Rubber Base",
    tone: "Warm & encouraging",
    product: data.products[0],
    videoType: data.videoTypes[0],
    scene: data.scenes[0],
    avatar: data.avatars[0],
    engine: data.engines[0],
    imageGenerator: data.imageGenerators[0],
    ...overrides
  };
}

test("claim guard flags every blocked claim family", () => {
  const samples = [
    ["long-lasting wear you can trust", "durability"],
    ["this base lasts longer than anything else", "durability"],
    ["prevents lifting between fills", "non_lift"],
    ["non-lift formula", "non_lift"],
    ["never chips, even after weeks", "no_chip"],
    ["chip-proof colour", "no_chip"],
    ["strengthens natural nails", "strengthening"],
    ["adds strength to every overlay", "strengthening"],
    ["repairs damaged nails fast", "repair_health"],
    ["supports nail health", "repair_health"],
    ["guaranteed salon-perfect results", "guarantee"],
    ["works for every client", "guarantee"],
    ["it fixes a real salon problem", "outcome_fix"]
  ];

  for (const [text, expectedId] of samples) {
    const findings = findBlockedClaims(text);
    assert.ok(
      findings.some((finding) => finding.id === expectedId),
      `expected "${text}" to be flagged as ${expectedId}`
    );
  }
});

test("claim guard allows approved smooth-base and educational language", () => {
  const approved = [
    "French Rubber Base helps with smooth base.",
    "Smooth base for cleaner salon work. Shop Crystal Clawz French Rubber Base.",
    "Most lifting issues come from prep, product control, or the layer being too thick.",
    "your set is not lasting",
    "Nail techs struggling with lifting, start with your foundation.",
    "salon-ready base for neat sets"
  ];

  for (const text of approved) {
    assert.deepEqual(
      findBlockedClaims(text),
      [],
      `expected "${text}" to pass the claim guard`
    );
  }
});

test("generatePack output is claim safe for every product and tone", async () => {
  const data = await loadFormDefaults();

  for (const product of data.products) {
    for (const tone of TONES) {
      for (const videoType of data.videoTypes) {
        const pack = generatePack(
          makeFormState(data, { product, tone, videoType })
        );
        const findings = findBlockedClaimsInObject(pack);
        assert.deepEqual(
          findings,
          [],
          `blocked claims for ${product.id} / ${tone} / ${videoType.id}: ${JSON.stringify(findings)}`
        );
      }
    }
  }
});

test("generatePack replaces user CTAs that carry blocked claims", async () => {
  const data = await loadFormDefaults();
  const pack = generatePack(
    makeFormState(data, { cta: "Get long-lasting sets today" })
  );
  assert.equal(pack.cta, `Shop ${data.products[0].name} at Crystal Clawz`);
});

test("generatePack rejects briefs that smuggle blocked claims through other fields", async () => {
  const data = await loadFormDefaults();
  assert.throws(
    () =>
      generatePack(
        makeFormState(data, {
          painPoint: "clients keep asking for longer-lasting sets"
        })
      ),
    /blocked claims/
  );
});

test("legacy unapproved copy never returns in generated packs", async () => {
  const data = await loadFormDefaults();
  const serialized = JSON.stringify(generatePack(makeFormState(data)));
  for (const fragment of [
    "longer-lasting",
    "prevents lifting",
    "fixes a real salon problem"
  ]) {
    assert.ok(
      !serialized.includes(fragment),
      `pack should not contain "${fragment}"`
    );
  }
});
