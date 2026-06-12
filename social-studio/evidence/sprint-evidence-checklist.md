# Sprint Evidence Checklist

Use this checklist before claiming a Social Studio sprint slice is complete.

## Scope Gate

- [ ] The slice is draft-only.
- [ ] No live social account publishing is enabled.
- [ ] No production OAuth credentials are added.
- [ ] No Shopify, Xero, ERP, or n8n writes are included.

## Local State

- [ ] Root app path checked: `C:\path\to\CC UCG`
- [ ] MoneyPrinterTurbo path checked: `C:\path\to\CC UCG\MoneyPrinterTurbo`
- [ ] MoneyPrinterTurbo dirty files listed before edits.
- [ ] Any intentional new files are listed.

## Build And Runtime

- [ ] Root app build result recorded.
- [ ] MoneyPrinterTurbo API health recorded if video generation is used.
- [ ] MoneyPrinterTurbo WebUI health recorded if WebUI is used.
- [ ] Generated asset path recorded.
- [ ] Generated video opens or passes `ffprobe`.

## Brand And Claims

- [ ] Brand context applied.
- [ ] Product source URL or source file recorded.
- [ ] Approved benefits listed.
- [ ] Blocked claims checked.
- [ ] Human reviewer notes recorded.

## Postiz Handoff

- [ ] Handoff package validates as JSON.
- [ ] Handoff mode is `manual_upload` or `postiz_api_draft`.
- [ ] Status is `draft_upload_ready` or `handed_to_postiz`.
- [ ] `notLiveConfirmed` is true.
- [ ] Screenshot or written proof confirms nothing is live.

## Secrets And Safety

- [ ] Secret scan run on new/changed files.
- [ ] No `.env`, `config.toml`, OAuth token, API key, or password committed.
- [ ] Rollback note written.

## Completion Evidence

- [ ] Brief path:
- [ ] Product input path:
- [ ] Review status path:
- [ ] Handoff package path:
- [ ] Generated media path:
- [ ] Verification command/result:
- [ ] Reviewer:
- [ ] Decision:
