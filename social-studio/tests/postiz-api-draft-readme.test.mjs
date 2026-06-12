import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const readmePath = path.resolve("social-studio", "handoff", "postiz", "api-draft", "README.md");

test("Postiz API draft README points operators at prepared local files", async () => {
  const markdown = await readFile(readmePath, "utf8");

  assert.match(markdown, /integrations\.local\.json/);
  assert.match(markdown, /uploaded-media\.local\.json/);
  assert.match(markdown, /--human-approval-handoff=/);
  assert.doesNotMatch(markdown, /Copy those template files/i);
  assert.doesNotMatch(markdown, /integrations\.example\.json"/i);
});

test("Postiz API draft README approval command includes every required approval evidence gate", async () => {
  const markdown = await readFile(readmePath, "utf8");

  assert.match(markdown, /UGC video evidence reviewed/);
  assert.match(markdown, /Paid ad video evidence reviewed/);
  assert.match(markdown, /Normal post evidence reviewed/);
  assert.match(markdown, /Artifact freshness checked/);
  assert.match(markdown, /Rollback and not-live proof reviewed/);
  assert.match(markdown, /Approved for Postiz draft upload only/);
});
