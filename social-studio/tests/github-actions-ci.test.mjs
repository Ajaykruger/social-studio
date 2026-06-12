import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const workflowPath = path.resolve(".github", "workflows", "ci.yml");
const readmePath = path.resolve("README.md");

test("GitHub Actions CI runs tests and build on main pushes and pull requests", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /name:\s*CI/);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[\s*main\s*\]/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /runs-on:\s*ubuntu-latest/);
  assert.match(workflow, /node-version:\s*22/);
  assert.match(workflow, /cache:\s*npm/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
});

test("README shows the GitHub Actions CI badge", async () => {
  const markdown = await readFile(readmePath, "utf8");

  assert.match(
    markdown,
    /\[!\[CI\]\(https:\/\/github\.com\/Ajaykruger\/social-studio\/actions\/workflows\/ci\.yml\/badge\.svg\)\]\(https:\/\/github\.com\/Ajaykruger\/social-studio\/actions\/workflows\/ci\.yml\)/
  );
});
