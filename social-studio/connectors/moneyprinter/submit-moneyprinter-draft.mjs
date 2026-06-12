import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDraftBundle,
  loadJsonFile
} from "../../tools/build-draft-bundle.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioRoot = path.resolve(__dirname, "..", "..");
const repoRoot = path.resolve(studioRoot, "..");
const defaultMoneyPrinterRoot = path.join(repoRoot, "MoneyPrinterTurbo");

function pathForRoot(root) {
  return /^[A-Za-z]:[\\/]/.test(String(root || "")) ? path.win32 : path;
}

function joinMoneyPrinterPath(root, ...parts) {
  return pathForRoot(root).join(root, ...parts);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function fetchJson(fetchFn, url, options) {
  const response = await fetchFn(url, options);
  if (!response.ok) {
    throw new Error(`MoneyPrinterTurbo request failed: ${response.status} ${response.statusText || ""}`.trim());
  }
  return response.json();
}

export function assertLocalApiBase(apiBase) {
  const parsed = new URL(apiBase);
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!["http:", "https:"].includes(parsed.protocol) || !allowedHosts.has(parsed.hostname)) {
    throw new Error("MoneyPrinterTurbo connector is localhost-only in the MVP");
  }
  return true;
}

export function buildLocalRenderRequest({
  moneyPrinterRoot = defaultMoneyPrinterRoot,
  subject,
  script
}) {
  const localVideos = joinMoneyPrinterPath(moneyPrinterRoot, "storage", "local_videos");
  const materialNames = [
    "01_hook.mp4",
    "02_range.mp4",
    "03_six_in_one.mp4",
    "04_texture.mp4",
    "05_cta.mp4"
  ];

  return {
    video_subject: subject,
    video_script: script,
    video_terms: ["French Rubber Base", "Crystal Clawz", "nail technician"],
    video_aspect: "9:16",
    video_concat_mode: "sequential",
    video_transition_mode: "None",
    video_clip_duration: 5,
    video_count: 1,
    video_source: "local",
    video_materials: materialNames.map((name) => ({
      provider: "local",
      url: joinMoneyPrinterPath(localVideos, name),
      duration: 5
    })),
    custom_audio_file: joinMoneyPrinterPath(localVideos, "crystalclawz_rubber_base_bgm_15s.mp3"),
    subtitle_enabled: false,
    bgm_type: "none",
    voice_name: "",
    n_threads: 2
  };
}

export async function submitVideoTask({
  apiBase = "http://127.0.0.1:8080",
  requestBody,
  fetchFn = fetch
}) {
  assertLocalApiBase(apiBase);
  const result = await fetchJson(fetchFn, `${apiBase}/api/v1/videos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  const taskId = result?.data?.task_id;
  if (!taskId) {
    throw new Error("MoneyPrinterTurbo did not return a task id");
  }
  return taskId;
}

export async function getTaskStatus({
  apiBase = "http://127.0.0.1:8080",
  taskId,
  fetchFn = fetch
}) {
  assertLocalApiBase(apiBase);
  return fetchJson(fetchFn, `${apiBase}/api/v1/tasks/${taskId}`);
}

export async function pollTaskStatus({
  apiBase = "http://127.0.0.1:8080",
  taskId,
  fetchFn = fetch,
  attempts = 48,
  delayMs = 5000
}) {
  let latest = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await getTaskStatus({ apiBase, taskId, fetchFn });
    const state = latest?.data?.state;
    if (state === 1) {
      return latest;
    }
    if (state === -1) {
      throw new Error(`MoneyPrinterTurbo task failed: ${taskId}`);
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }
  throw new Error(`MoneyPrinterTurbo task did not complete: ${taskId}`);
}

export function resolveTaskVideoPath({
  moneyPrinterRoot = defaultMoneyPrinterRoot,
  taskStatus
}) {
  const video = taskStatus?.data?.videos?.[0];
  if (!video) {
    throw new Error("MoneyPrinterTurbo task status does not include a final video");
  }

  if (/^[A-Za-z]:\\/.test(video)) {
    return video;
  }

  const pathApi = pathForRoot(moneyPrinterRoot);
  const normalized = video.replace(/^\/+/, "").replace(/\//g, pathApi.sep);
  if (!normalized.startsWith(`tasks${pathApi.sep}`)) {
    throw new Error(`Unexpected MoneyPrinterTurbo video path: ${video}`);
  }
  return pathApi.join(moneyPrinterRoot, "storage", normalized);
}

async function main() {
  const moneyPrinterRoot = readArg("moneyprinter-root", defaultMoneyPrinterRoot);
  const apiBase = readArg("api-base", "http://127.0.0.1:8080");
  const taskIdArg = readArg("task-id", "");
  const thumbnailPath = readArg("thumbnail", "");
  const outDir = readArg(
    "out-dir",
    path.join(studioRoot, "generated", "cc-rubber-base-demo-2026-06-10")
  );

  const brief = await loadJsonFile(
    path.join(studioRoot, "examples", "rubber-base-campaign-brief.example.json")
  );
  const product = await loadJsonFile(
    path.join(studioRoot, "examples", "rubber-base-product-input.example.json")
  );
  const requestTemplate = await loadJsonFile(
    path.join(studioRoot, "connectors", "moneyprinter", "request.example.json")
  );

  const requestBody = buildLocalRenderRequest({
    moneyPrinterRoot,
    subject: `${brief.product.name} for ${brief.audience}`,
    script: "A smooth base helps French and colour work look cleaner. French Rubber Base gives nail technicians a salon-ready base for neat sets. Shop Crystal Clawz French Rubber Base."
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "moneyprinter-local-render-request.json"),
    `${JSON.stringify(requestBody, null, 2)}\n`
  );

  const taskId = taskIdArg || await submitVideoTask({ apiBase, requestBody });
  const taskStatus = await pollTaskStatus({
    apiBase,
    taskId,
    attempts: taskIdArg ? 1 : 48,
    delayMs: 5000
  });
  const mediaPath = resolveTaskVideoPath({ moneyPrinterRoot, taskStatus });

  await writeFile(
    path.join(outDir, "moneyprinter-task-status.json"),
    `${JSON.stringify(taskStatus, null, 2)}\n`
  );

  const bundle = buildDraftBundle({
    brief,
    product,
    requestTemplate,
    mediaPath,
    thumbnailPath
  });
  bundle.moneyprinterRequest = requestBody;
  bundle.moneyprinterTask = {
    taskId,
    state: taskStatus?.data?.state,
    progress: taskStatus?.data?.progress,
    crossPostResults: taskStatus?.data?.cross_post_results ?? null
  };

  await writeFile(
    path.join(outDir, "draft-bundle.json"),
    `${JSON.stringify(bundle, null, 2)}\n`
  );
  await writeFile(
    path.join(outDir, "review-status.json"),
    `${JSON.stringify(bundle.reviewStatus, null, 2)}\n`
  );
  await writeFile(
    path.join(outDir, "postiz-handoff.preview.json"),
    `${JSON.stringify(bundle.postizHandoff, null, 2)}\n`
  );

  console.log(`task_id=${taskId}`);
  console.log(`media=${mediaPath}`);
  console.log(`postiz_status=${bundle.postizHandoff.status}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
