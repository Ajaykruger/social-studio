import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const reviewScreenPath = path.join(process.cwd(), "src", "components", "ReviewDecisionScreen.jsx");
const studioDataPath = path.join(process.cwd(), "src", "utils", "studioData.js");

test("Review screen exposes attach-rendered-reel controls for pending UGC video assets", async () => {
  const source = await readFile(reviewScreenPath, "utf8");

  assert.match(source, /attachRenderedReel/);
  assert.match(source, /Attach rendered reel/);
  assert.match(source, /contentType === "ugc_video"/);
  assert.match(source, /!asset\.assetUrl/);
  assert.match(source, /Rendered MP4 path/);
  assert.match(source, /onDecided\?\./);
  assert.doesNotMatch(source, /fetch\(/);
});

test("studio data helper posts rendered reel paths to the attach endpoint", async () => {
  const source = await readFile(studioDataPath, "utf8");

  assert.match(source, /export async function attachRenderedReel/);
  assert.match(source, /\/api\/campaigns\/\$\{campaignId\}\/attach-reel/);
  assert.match(source, /filePath/);
});
