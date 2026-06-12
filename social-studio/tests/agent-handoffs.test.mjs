import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const agentsDir = path.resolve("social-studio", "agents");

const requiredWorkers = [
  {
    role: "Planner/Coordinator",
    file: "planner-coordinator-worker.md"
  },
  {
    role: "Brand Brain Worker",
    file: "brand-brain-worker.md"
  },
  {
    role: "MoneyPrinterTurbo Worker",
    file: "moneyprinter-worker.md"
  },
  {
    role: "Review Workflow Worker",
    file: "review-workflow-worker.md"
  },
  {
    role: "Postiz Draft Worker",
    file: "postiz-draft-worker.md"
  },
  {
    role: "QA/Ops Worker",
    file: "qa-ops-worker.md"
  }
];

test("agent handoff README maps every named lane to a scoped worker prompt", async () => {
  const readme = await readFile(path.join(agentsDir, "README.md"), "utf8");

  for (const worker of requiredWorkers) {
    assert.match(readme, new RegExp(worker.role.replace("/", "\\/"), "i"));
    assert.match(readme, new RegExp(worker.file.replace(".", "\\."), "i"));
    await access(path.join(agentsDir, worker.file));
  }
});

test("agent worker prompts keep live posting and secrets out of scope", async () => {
  for (const worker of requiredWorkers) {
    const prompt = await readFile(path.join(agentsDir, worker.file), "utf8");

    assert.match(prompt, /Workspace: `C:\\path\\to\\CC UCG`/);
    assert.match(prompt, /Return:/);
    assert.doesNotMatch(prompt, /publish now|schedule now|store token|print token|connect production social accounts/i);
  }
});
