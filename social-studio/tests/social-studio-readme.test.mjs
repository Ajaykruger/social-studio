import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const readmePath = path.resolve("social-studio", "README.md");

test("Social Studio README keeps the first sprint scoped to draft upload, not scheduling", async () => {
  const markdown = await readFile(readmePath, "utf8");

  assert.match(markdown, /review-first social content system/i);
  assert.match(markdown, /Approve the asset for Postiz draft upload only/i);
  assert.match(markdown, /Final scheduling or publishing needs separate approval/i);
  assert.match(markdown, /no live auto-posting/i);
  assert.doesNotMatch(markdown, /Approve the asset for scheduling/i);
});
