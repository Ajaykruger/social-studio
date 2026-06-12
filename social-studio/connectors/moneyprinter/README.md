# MoneyPrinterTurbo Connector Contract

This connector is draft-only.

It prepares payloads for the local MoneyPrinterTurbo API and collects outputs for human review.

## Local API

- Health/docs: `http://127.0.0.1:8080/docs`
- Create video: `POST /api/v1/videos` or the route shown by the local docs
- Poll task: `GET /api/v1/tasks/{task_id}` or the route shown by the local docs

## Local Material Rule

Use absolute local material paths under:

`C:\path\to\CC UCG\MoneyPrinterTurbo\storage\local_videos`

The API accepts file names such as `01_hook.mp4`, but this checkout currently fails during final combine if the returned materials are only file names. Absolute paths inside the local videos folder passed the 2026-06-10 test render.

## Helper

Use:

```powershell
node social-studio\connectors\moneyprinter\submit-moneyprinter-draft.mjs
```

Useful flags:

- `--task-id=<id>` attaches an existing completed MoneyPrinterTurbo task.
- `--thumbnail=<path>` records a preview image in the review bundle.

## Safety

- Do not expose `config.toml`.
- Do not print API keys.
- Do not use MoneyPrinterTurbo cross-posting features.
- Do not send anything to Postiz until human review is complete.
