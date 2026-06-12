# Review Decision Runbook

Use this after all generated assets have been reviewed in the local app.

Current app URL:

`http://127.0.0.1:5173`

## Refresh The Current Review State

Use this to rebuild the local review screen, manual Postiz preview package, workflow status, decision commands, and MVP audit while the draft is still waiting for review.

```powershell
node social-studio\tools\refresh-current-review-state.mjs `
  --tests-passing=true `
  --build-passing=true `
  --secret-scan-passing=true `
  --path-leak-scan-passing=true
```

Expected status before human approval:

`blocked_by_human_review`

This command refuses approved bundles and Postiz dry-run files. It does not approve, upload, schedule, publish, or call Postiz.

## If Approved

This records a real human approval, creates `approved-bundle.json`, rebuilds workflow status, and creates an approved manual Postiz draft package.

Before approving, review `social-studio\handoff\postiz\rollback-note.md` and confirm the local approval handoff shows `Rollback proof: ready`.

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

Expected status after approval:

`approved_waiting_postiz_dry_run`

## Fill And Validate Local Postiz Inputs

The local Postiz input files have already been prepared in this workspace. Do not rerun the prepare command unless the local files are missing; it refuses to overwrite existing files.

After approval, edit the existing local files:

- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json`
- `social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json`

Fill only the real local Postiz integration IDs and uploaded media `id` / `path`. Replace the `TODO_POSTIZ...` placeholders. Do not paste API keys, access tokens, cookies, passwords, or bearer tokens into these files.

```powershell
node social-studio\tools\build-postiz-input-kit.mjs `
  --bundle="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --review-board="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-board\review-board.json" `
  --integrations="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit"
```

## Build Postiz Draft Dry-Run After Approval

Use this only after:

- `approved-bundle.json` exists
- approved media has been uploaded to local Postiz
- Postiz returned real media `id` and `path`
- real integration IDs have replaced the examples

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

Expected status after the dry-run package:

`draft_mvp_ready`

This still does not call Postiz. It writes a dry-run payload only.

The local files contain `TODO_POSTIZ...` placeholders until you edit them. The dry-run command rejects placeholder values, so they must be replaced with real local Postiz integration IDs and uploaded media values first.

## If It Needs Changes

This records a revision decision, creates `revision-bundle.json`, and keeps Postiz blocked.

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=needs_revision `
  --reviewer="Andre" `
  --evidence="Reviewed all generated assets in the local app." `
  --notes="Describe exactly what must change before Postiz draft upload."
```

Expected status after revision:

`needs_revision`

## If Rejected

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=reject `
  --reviewer="Andre" `
  --evidence="Reviewed all generated assets in the local app." `
  --notes="Describe why this asset should not continue."
```

Expected status after rejection:

`rejected`

## Guardrails

- Approval requires a real reviewer name.
- Approval requires evidence.
- Approval does not publish anything.
- Approval creates a Postiz manual draft package only.
- Scheduling or publishing still needs separate approval.

## Readiness Audit

After any decision cycle, rebuild the MVP readiness audit:

```powershell
node social-studio\tools\build-mvp-readiness-audit.mjs `
  --tests-passing=true `
  --build-passing=true `
  --secret-scan-passing=true `
  --path-leak-scan-passing=true
```

Current expected status before human approval:

`blocked_by_human_review`
