import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const visualReviewPath = path.resolve(
  "social-studio",
  "generated",
  "cc-rubber-base-demo-2026-06-10",
  "visual-review",
  "visual-review.md"
);

test("current visual-review artifact keeps approval scoped to Postiz draft upload only", async () => {
  const markdown = await readFile(visualReviewPath, "utf8");

  assert.match(markdown, /needs human creative review before Postiz draft upload only/i);
  assert.doesNotMatch(markdown, /upload or scheduling/i);
  assert.doesNotMatch(markdown, /before Postiz scheduling/i);
});
