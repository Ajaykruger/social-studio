import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const componentPath = path.join(process.cwd(), "src", "components", "SocialStudioStatusPanel.jsx");

test("SocialStudioStatusPanel exposes current artifact freshness without live actions", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Artifact freshness/);
  assert.match(source, /status\.freshness/);
  assert.match(source, /generatedAt/);
  assert.match(source, /sourceGeneratedAt/);
  assert.match(source, /sourceBundle/);
  assert.match(source, /generatedPath/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
