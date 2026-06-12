// Minimal .env loader so a non-technical operator can keep the Anthropic API
// key in a local file instead of typing environment variables. The .env file
// is gitignored and must never be committed.
import { readFileSync } from "node:fs";
import path from "node:path";

export function loadDotEnv(workspaceRoot) {
  let content;
  try {
    content = readFileSync(path.join(workspaceRoot, ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
