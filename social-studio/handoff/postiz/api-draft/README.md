# Postiz API Draft Dry Run

This folder is for preparing a Postiz API draft package without making network calls.

## What This Does

The dry-run builder creates the JSON shape needed for Postiz `POST /posts` with:

- `type: "draft"`
- one post per approved platform
- uploaded Postiz media references in the `image` array
- fake `Authorization` placeholder only
- `networkCallsAllowed: false`

It refuses:

- unapproved `needs_review` bundles
- bundles with failed review checks
- remote Postiz API bases such as Postiz Cloud
- missing uploaded media references
- scheduled dates

## Current Postiz Docs Checked

- Create post: https://docs.postiz.com/public-api/posts/create
- Upload file: https://docs.postiz.com/public-api/uploads/upload-file
- List integrations: https://docs.postiz.com/public-api/integrations/list

Postiz calls channels "integrations" in the API.

## Inputs

First, a human reviewer must approve a bundle:

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --manual-package-dir="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10" `
  --decision=approve `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rollback and not-live proof reviewed; Approved for Postiz draft upload only." `
  --notes="Approved for Postiz draft upload only. Do not publish without separate approval."
```

Then edit the prepared local Postiz input files:

- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json`
- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json`

Use only real Postiz integration IDs and the media `id` / `path` returned by Postiz upload.

## Safer Local Input Kit

The current review refresh writes both editable local files and reset templates:

- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json`
- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json`
- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.template.json`
- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.template.json`

Replace the `TODO_POSTIZ...` values in the two `.local.json` files, then refresh readiness or run the dry-run command below. The template files are only a reset reference.

Do not paste API keys into these files. They only need Postiz integration IDs plus the uploaded media `id` and `path`.

## Dry-Run Command

```powershell
node social-studio\tools\run-postiz-dry-run-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\approved-bundle.json" `
  --integrations="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json" `
  --review-packet="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-packet\review-packet.json" `
  --manual-manifest="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10\manifest.json" `
  --content-plan="social-studio\generated\cc-rubber-base-demo-2026-06-10\content-plan\content-plan.json" `
  --brand-claim-ledger="social-studio\generated\cc-rubber-base-demo-2026-06-10\brand-claim-ledger\brand-claim-ledger.json" `
  --production-packets="social-studio\generated\cc-rubber-base-demo-2026-06-10\production-packets\production-packets.json" `
  --production-queue="social-studio\generated\cc-rubber-base-demo-2026-06-10\production-queue\production-queue.json" `
  --review-board="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-board\review-board.json" `
  --human-approval-handoff="social-studio\generated\cc-rubber-base-demo-2026-06-10\human-approval-handoff\human-approval-handoff.ui.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --tests-passing=true `
  --build-passing=true `
  --secret-scan-passing=true `
  --path-leak-scan-passing=true
```

The output is still a dry-run package. It is not a live upload, draft creation, schedule, or post.
