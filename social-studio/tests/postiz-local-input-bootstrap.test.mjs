import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { preparePostizLocalInputs } from "../tools/prepare-postiz-local-inputs.mjs";

function integrationsTemplate() {
  return [
    {
      platform: "instagram",
      id: "TODO_POSTIZ_INSTAGRAM_INTEGRATION_ID",
      settings: { __type: "instagram", post_type: "reel" }
    }
  ];
}

function mediaTemplate() {
  return [
    {
      id: "TODO_POSTIZ_UPLOADED_MEDIA_ID",
      path: "TODO_POSTIZ_UPLOADED_MEDIA_MP4_PATH"
    }
  ];
}

test("creates editable local Postiz input files from templates without network actions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-bootstrap-"));
  try {
    const templatesDir = path.join(tempDir, "templates");
    const localDir = path.join(tempDir, "local");
    await mkdir(templatesDir, { recursive: true });
    const integrationsTemplatePath = path.join(templatesDir, "integrations.local.template.json");
    const uploadedMediaTemplatePath = path.join(templatesDir, "uploaded-media.local.template.json");
    const integrationsOut = path.join(localDir, "integrations.local.json");
    const uploadedMediaOut = path.join(localDir, "uploaded-media.local.json");
    await writeFile(integrationsTemplatePath, `${JSON.stringify(integrationsTemplate(), null, 2)}\n`);
    await writeFile(uploadedMediaTemplatePath, `${JSON.stringify(mediaTemplate(), null, 2)}\n`);

    const result = await preparePostizLocalInputs({
      integrationsTemplatePath,
      uploadedMediaTemplatePath,
      integrationsOut,
      uploadedMediaOut,
      generatedAt: "2026-06-10T21:00:00.000Z"
    });

    assert.equal(result.status, "created");
    assert.equal(result.commandOnly, true);
    assert.equal(result.networkCallsAllowed, false);
    assert.equal(result.liveActionsEnabled, false);
    assert.equal(result.files.length, 2);
    assert.deepEqual(JSON.parse(await readFile(integrationsOut, "utf8")), integrationsTemplate());
    assert.deepEqual(JSON.parse(await readFile(uploadedMediaOut, "utf8")), mediaTemplate());
    assert.doesNotMatch(JSON.stringify(result.uiSummary), /C:\\|TODO_POSTIZ|apiKey|accessToken/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("refuses to overwrite existing local Postiz files by default", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-bootstrap-"));
  try {
    const integrationsTemplatePath = path.join(tempDir, "integrations.local.template.json");
    const uploadedMediaTemplatePath = path.join(tempDir, "uploaded-media.local.template.json");
    const integrationsOut = path.join(tempDir, "integrations.local.json");
    const uploadedMediaOut = path.join(tempDir, "uploaded-media.local.json");
    await writeFile(integrationsTemplatePath, `${JSON.stringify(integrationsTemplate(), null, 2)}\n`);
    await writeFile(uploadedMediaTemplatePath, `${JSON.stringify(mediaTemplate(), null, 2)}\n`);
    await writeFile(integrationsOut, `${JSON.stringify([{ platform: "instagram", id: "postiz-real-existing-id" }], null, 2)}\n`);

    await assert.rejects(
      () =>
        preparePostizLocalInputs({
          integrationsTemplatePath,
          uploadedMediaTemplatePath,
          integrationsOut,
          uploadedMediaOut
        }),
      /refuses to overwrite/i
    );

    const existing = JSON.parse(await readFile(integrationsOut, "utf8"));
    assert.equal(existing[0].id, "postiz-real-existing-id");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects template files that contain secret-like fields", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "social-studio-postiz-bootstrap-"));
  try {
    const integrationsTemplatePath = path.join(tempDir, "integrations.local.template.json");
    const uploadedMediaTemplatePath = path.join(tempDir, "uploaded-media.local.template.json");
    const integrationsOut = path.join(tempDir, "integrations.local.json");
    const uploadedMediaOut = path.join(tempDir, "uploaded-media.local.json");
    const unsafeTemplate = [
      {
        platform: "instagram",
        id: "TODO_POSTIZ_INSTAGRAM_INTEGRATION_ID",
        settings: { apiKey: "postiz_live_secret_key_1234567890" }
      }
    ];
    await writeFile(integrationsTemplatePath, `${JSON.stringify(unsafeTemplate, null, 2)}\n`);
    await writeFile(uploadedMediaTemplatePath, `${JSON.stringify(mediaTemplate(), null, 2)}\n`);

    await assert.rejects(
      () =>
        preparePostizLocalInputs({
          integrationsTemplatePath,
          uploadedMediaTemplatePath,
          integrationsOut,
          uploadedMediaOut
        }),
      /contains API keys, tokens, or secrets/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
