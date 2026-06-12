import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");

test("App groups campaign selector options by awaiting and decided state", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /awaitingCampaigns/);
  assert.match(source, /decidedCampaigns/);
  assert.match(source, /<optgroup label="Awaiting decision"/);
  assert.match(source, /<optgroup label="Decided"/);
  assert.match(source, /campaign\.decided/);
  assert.match(source, /campaign\.contentTypes/);
  assert.match(source, /bg-amber-500/);
  assert.match(source, /bg-emerald-500/);
});
