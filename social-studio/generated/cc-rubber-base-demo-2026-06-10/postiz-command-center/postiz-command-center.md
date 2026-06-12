# Postiz Command Center

Generated: 2026-06-12T06:36:31.481Z
Campaign: cc-rubber-base-demo-2026-06-10
Status: blocked_by_human_review

These commands are copy-only. The app does not run them.

## Prerequisites

- Human approval recorded: blocked. Record a real human approval before building any Postiz dry-run payload.
- Real local Postiz inputs: blocked. Fill integrations.local.json and uploaded-media.local.json with real local IDs/media references.
- Dry-run only: ready. This command center only prepares local dry-run payloads.
- Live actions off: ready. The app does not run Postiz API calls, scheduling, or publishing.

## Prepare local Postiz inputs

Local input files already exist. Edit integrations.local.json and uploaded-media.local.json, then validate them. The prepare command refuses to overwrite existing local files.

- Copy disabled until prerequisites are ready
- Requires: local_templates
- Writes: integrations.local.json, uploaded-media.local.json
- Never: Never calls the Postiz API. Never schedules or publishes social content. Never writes API keys, tokens, or secrets.

```powershell
node social-studio\tools\prepare-postiz-local-inputs.mjs `
  --integrations-template="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.template.json" `
  --uploaded-media-template="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.template.json" `
  --integrations-out="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media-out="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json"
```

## Validate Postiz inputs

Uses local files only. Does not call Postiz. Exits blocked until every real ID/media reference is present.

- Copy disabled until prerequisites are ready
- Requires: integrations.local.json, uploaded-media.local.json
- Writes: postiz-local-input-validation.json, postiz-local-input-validation.ui.json, postiz-local-input-validation.md
- Never: Never calls the Postiz API. Never schedules or publishes social content. Never writes API keys, tokens, or secrets.

```powershell
node social-studio\tools\validate-postiz-local-inputs.mjs `
  --bundle="social-studio\generated\cc-rubber-base-demo-2026-06-10\approved-bundle.json" `
  --review-board="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-board\review-board.json" `
  --integrations="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit"
```

## Refresh Postiz readiness

Reads approved bundle and local Postiz references. Does not call Postiz.

- Copy disabled until prerequisites are ready
- Requires: approved-bundle.json, integrations.local.json, uploaded-media.local.json
- Writes: postiz-dry-run-readiness.json, postiz-dry-run-readiness.ui.json, postiz-dry-run-readiness.md
- Never: Never calls the Postiz API. Never schedules or publishes social content. Never writes API keys, tokens, or secrets.

```powershell
node social-studio\tools\build-postiz-dry-run-readiness.mjs `
  --workflow-status="social-studio\generated\cc-rubber-base-demo-2026-06-10\workflow-status.json" `
  --integrations="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json" `
  --approved-bundle="social-studio\generated\cc-rubber-base-demo-2026-06-10\approved-bundle.json" `
  --postiz-input-kit="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\postiz-input-kit.json" `
  --manual-manifest="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10\manifest.json" `
  --postiz-dry-run="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-draft.dry-run.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-dry-run-readiness"
```

## Build Postiz dry-run

Requires approved-bundle.json and real local Postiz media/integration values. Writes a dry-run payload only.

- Copy disabled until prerequisites are ready
- Requires: approved-bundle.json, real Postiz local inputs, passing verification flags
- Writes: postiz-draft.dry-run.json, workflow-status.json, mvp-completion-audit.json
- Never: Never calls the Postiz API. Never schedules social content. Never publishes social content. Never writes API keys, tokens, or secrets.

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
