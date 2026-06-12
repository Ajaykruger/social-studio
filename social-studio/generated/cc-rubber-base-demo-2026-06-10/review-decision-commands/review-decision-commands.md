# Review Decision Commands

Campaign: cc-rubber-base-demo-2026-06-10
Status: needs_review
Blocker: Human review decision is required before Postiz draft creation.
Next action: Review all generated assets, then copy approve or edit notes before running needs_revision or reject.

These commands are copy-only. They do not run from the app.

## Approve

- Result: Creates the approved bundle and manual Postiz package for Postiz draft upload only. Scheduling and publishing still need separate approval.
- Creates approved bundle: yes
- Creates manual Postiz package: yes
- Scheduling or publishing allowed: no
- Copy: enabled

Evidence checklist:
- UGC video evidence reviewed
- Paid ad video evidence reviewed
- Normal post evidence reviewed
- Artifact freshness checked
- Rollback and not-live proof reviewed
- Approved for Postiz draft upload only

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --manual-package-dir="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10" `
  --review-board="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-board\review-board.json" `
  --decision=approve `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rollback and not-live proof reviewed; Approved for Postiz draft upload only" `
  --notes="Approved for Postiz draft upload only. Do not publish without separate approval."
```

## Needs revision

- Result: Keeps Postiz blocked and records the requested changes before any draft upload can continue.
- Creates approved bundle: no
- Creates manual Postiz package: no
- Scheduling or publishing allowed: no
- Copy disabled until notes are edited

Evidence checklist:
- UGC video evidence reviewed
- Paid ad video evidence reviewed
- Normal post evidence reviewed
- Artifact freshness checked
- Revision notes describe exactly what must change
- Postiz remains blocked

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=needs_revision `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Revision notes describe exactly what must change; Postiz remains blocked" `
  --notes="EDIT REQUIRED: add specific revision notes before running."
```

## Reject

- Result: Stops this asset from continuing to Postiz. No approved bundle, draft upload, scheduling, or publishing is created.
- Creates approved bundle: no
- Creates manual Postiz package: no
- Scheduling or publishing allowed: no
- Copy disabled until notes are edited

Evidence checklist:
- UGC video evidence reviewed
- Paid ad video evidence reviewed
- Normal post evidence reviewed
- Artifact freshness checked
- Rejection notes describe why the campaign should stop
- Postiz remains blocked

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=reject `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rejection notes describe why the campaign should stop; Postiz remains blocked" `
  --notes="EDIT REQUIRED: add specific rejection notes before running."
```
