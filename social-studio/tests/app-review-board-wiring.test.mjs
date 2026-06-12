import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const componentPath = path.join(process.cwd(), "src", "components", "ReviewBoardPanel.jsx");

test("ReviewBoardPanel can display generated image review assets without running workflow commands", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /imageUrl/);
  assert.match(source, /videoUrl/);
  assert.match(source, /assetUrl/);
  assert.match(source, /Open asset/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
