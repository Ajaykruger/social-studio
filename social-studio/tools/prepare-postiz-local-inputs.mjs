import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertNoPostizInputSecrets } from "../lib/postiz-input-safety.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..");

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function displayName(filePath) {
  return path.basename(filePath);
}

function makeUiSummary(result) {
  return {
    status: result.status,
    commandOnly: result.commandOnly,
    networkCallsAllowed: result.networkCallsAllowed,
    liveActionsEnabled: result.liveActionsEnabled,
    files: result.files,
    nextAction: result.nextAction
  };
}

export async function preparePostizLocalInputs({
  integrationsTemplatePath,
  uploadedMediaTemplatePath,
  integrationsOut,
  uploadedMediaOut,
  generatedAt = new Date().toISOString()
}) {
  const outputPaths = [integrationsOut, uploadedMediaOut];
  const existing = [];
  for (const filePath of outputPaths) {
    if (await exists(filePath)) {
      existing.push(displayName(filePath));
    }
  }

  if (existing.length) {
    throw new Error(`prepare Postiz local inputs refuses to overwrite existing files: ${existing.join(", ")}`);
  }

  const integrations = await readJson(integrationsTemplatePath);
  const uploadedMedia = await readJson(uploadedMediaTemplatePath);

  try {
    assertNoPostizInputSecrets({ integrations, uploadedMedia });
  } catch {
    throw new Error("Postiz local input template contains API keys, tokens, or secrets");
  }

  await mkdir(path.dirname(integrationsOut), { recursive: true });
  await mkdir(path.dirname(uploadedMediaOut), { recursive: true });
  await writeFile(integrationsOut, `${JSON.stringify(integrations, null, 2)}\n`);
  await writeFile(uploadedMediaOut, `${JSON.stringify(uploadedMedia, null, 2)}\n`);

  const result = {
    packageType: "social_studio_postiz_local_input_bootstrap",
    generatedAt,
    status: "created",
    commandOnly: true,
    networkCallsAllowed: false,
    liveActionsEnabled: false,
    files: [
      {
        id: "integrations",
        label: "Postiz integrations",
        file: displayName(integrationsOut),
        status: "created"
      },
      {
        id: "uploaded_media",
        label: "Uploaded media references",
        file: displayName(uploadedMediaOut),
        status: "created"
      }
    ],
    nextAction: "Fill only real local Postiz IDs and uploaded media references, then validate the input files."
  };
  result.uiSummary = makeUiSummary(result);
  return result;
}

async function main() {
  const campaignId = readArg("campaign", "cc-rubber-base-demo-2026-06-10");
  const inputKitDir = path.join(studioRoot, "generated", campaignId, "postiz-input-kit");
  const result = await preparePostizLocalInputs({
    integrationsTemplatePath: readArg("integrations-template", path.join(inputKitDir, "integrations.local.template.json")),
    uploadedMediaTemplatePath: readArg("uploaded-media-template", path.join(inputKitDir, "uploaded-media.local.template.json")),
    integrationsOut: readArg("integrations-out", path.join(inputKitDir, "integrations.local.json")),
    uploadedMediaOut: readArg("uploaded-media-out", path.join(inputKitDir, "uploaded-media.local.json"))
  });

  console.log(`status=${result.status}`);
  for (const file of result.files) {
    console.log(`${file.id}=${file.file}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
