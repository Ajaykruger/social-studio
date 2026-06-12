import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const componentPath = path.join(process.cwd(), "src", "components", "ReviewDecisionCommandsPanel.jsx");

test("ReviewDecisionCommandsPanel exposes a safe approval action center", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Approval Action Center/);
  assert.match(source, /packet\.summary/);
  assert.match(source, /Copy approve command/);
  assert.match(source, /Copy revision command/);
  assert.match(source, /Copy reject command/);
  assert.match(source, /item\.effect/);
  assert.match(source, /item\.evidenceChecklist/);
  assert.match(source, /Evidence checklist/);
  assert.match(source, /noteGuidance/);
  assert.match(source, /requiresNoteEdit/);
  assert.match(source, /Edit notes before running/);
  assert.match(source, /copyEnabled/);
  assert.match(source, /Copy disabled/);
  assert.match(source, /createsApprovedBundle/);
  assert.match(source, /allowsSchedulingOrPublishing/);
  assert.doesNotMatch(source, /onClick=\{.*run|fetch\(|axios|XMLHttpRequest/);
});
