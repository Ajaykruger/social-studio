import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const componentPath = path.join(process.cwd(), "src", "components", "MvpFinishPathPanel.jsx");

test("MvpFinishPathPanel renders step preflight checks and expected outputs", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /preflightChecks/);
  assert.match(source, /expectedOutputs/);
  assert.match(source, /Preflight/);
  assert.match(source, /Expected outputs/);
  assert.doesNotMatch(source, /fetch\(|axios|XMLHttpRequest|onClick=\{.*run/i);
});
