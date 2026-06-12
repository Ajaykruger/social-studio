import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildLocalRenderRequest,
  resolveTaskVideoPath,
  submitVideoTask,
  pollTaskStatus,
  assertLocalApiBase
} from "../connectors/moneyprinter/submit-moneyprinter-draft.mjs";

test("builds local-only render request with absolute material paths", () => {
  const root = "C:\\MoneyPrinterTurbo";
  const request = buildLocalRenderRequest({
    moneyPrinterRoot: root,
    subject: "Crystal Clawz French Rubber Base",
    script: "Shop Crystal Clawz French Rubber Base."
  });

  assert.equal(request.video_source, "local");
  assert.equal(request.subtitle_enabled, false);
  assert.equal(request.video_materials.length, 5);
  assert.match(request.video_materials[0].url, /storage\\local_videos\\01_hook\.mp4$/);
  assert.match(request.custom_audio_file, /storage\\local_videos\\crystalclawz_rubber_base_bgm_15s\.mp3$/);
});

test("resolves MoneyPrinterTurbo task URI to local final video path", () => {
  const resolved = resolveTaskVideoPath({
    moneyPrinterRoot: "C:\\MoneyPrinterTurbo",
    taskStatus: {
      data: {
        videos: ["/tasks/task-123/final-1.mp4"]
      }
    }
  });

  assert.equal(resolved, "C:\\MoneyPrinterTurbo\\storage\\tasks\\task-123\\final-1.mp4");
});

test("submits video task and extracts task id", async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { status: 200, data: { task_id: "task-123" } };
      }
    };
  };

  const taskId = await submitVideoTask({
    apiBase: "http://127.0.0.1:8080",
    requestBody: { video_subject: "demo" },
    fetchFn
  });

  assert.equal(taskId, "task-123");
  assert.equal(calls[0].url, "http://127.0.0.1:8080/api/v1/videos");
  assert.equal(calls[0].options.method, "POST");
});

test("rejects non-local MoneyPrinterTurbo API base", async () => {
  assert.throws(
    () => assertLocalApiBase("https://example.com"),
    /localhost-only/i
  );

  await assert.rejects(
    () =>
      submitVideoTask({
        apiBase: "https://example.com",
        requestBody: { video_subject: "demo" },
        fetchFn: async () => {
          throw new Error("fetch should not run");
        }
      }),
    /localhost-only/i
  );
});

test("polls until complete task status", async () => {
  let count = 0;
  const fetchFn = async () => ({
    ok: true,
    async json() {
      count += 1;
      return count === 1
        ? { status: 200, data: { task_id: "task-123", state: 4, progress: 50 } }
        : {
            status: 200,
            data: {
              task_id: "task-123",
              state: 1,
              progress: 100,
              videos: ["/tasks/task-123/final-1.mp4"]
            }
          };
    }
  });

  const status = await pollTaskStatus({
    apiBase: "http://127.0.0.1:8080",
    taskId: "task-123",
    fetchFn,
    attempts: 2,
    delayMs: 1
  });

  assert.equal(status.data.state, 1);
  assert.equal(status.data.progress, 100);
});
