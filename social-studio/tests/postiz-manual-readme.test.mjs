import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const readmePath = path.resolve("social-studio", "handoff", "postiz", "manual", "README.md");

test("manual Postiz README describes the current multi-asset approval flow", async () => {
  const markdown = await readFile(readmePath, "utf8");

  assert.match(markdown, /run-review-decision-cycle\.mjs/);
  assert.match(markdown, /UGC video/i);
  assert.match(markdown, /Paid ad video/i);
  assert.match(markdown, /Normal post/i);
  assert.match(markdown, /paid-ad-video-02\.mp4/);
  assert.match(markdown, /normal-post-03\.svg/);
  assert.doesNotMatch(markdown, /record-review-decision\.mjs/);
  assert.doesNotMatch(markdown, /Reviewed MP4/i);
});

test("manual Postiz README approval command includes every required approval evidence gate", async () => {
  const markdown = await readFile(readmePath, "utf8");

  assert.match(markdown, /UGC video evidence reviewed/);
  assert.match(markdown, /Paid ad video evidence reviewed/);
  assert.match(markdown, /Normal post evidence reviewed/);
  assert.match(markdown, /Artifact freshness checked/);
  assert.match(markdown, /Rollback and not-live proof reviewed/);
  assert.match(markdown, /Approved for Postiz draft upload only/);
});
