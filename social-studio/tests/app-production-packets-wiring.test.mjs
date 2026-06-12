import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const componentPath = path.join(process.cwd(), "src", "components", "ProductionPacketsPanel.jsx");

test("ProductionPacketsPanel exposes packet copy, prompt, and format details without live actions", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Production Packets/);
  assert.match(source, /asset\.details/);
  assert.match(source, /promptSummary/);
  assert.match(source, /captionDraft/);
  assert.match(source, /designBrief/);
  assert.match(source, /platforms/);
  assert.match(source, /formats/);
  assert.match(source, /postizFormat/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
