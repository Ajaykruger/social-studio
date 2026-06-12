# MVP Operator Packet

Generated: 2026-06-12T06:36:31.481Z
Campaign: cc-rubber-base-demo-2026-06-10
Status: waiting_for_human_approval

## Current Blockers

- Human approval recorded: Record human approval first.
- Real local Postiz input values: Real Postiz integration IDs and uploaded media references are still required.
- Postiz draft dry-run package: Dry-run package has not been created.
- Approved draft-only MVP complete: The MVP is not complete until every requirement above is complete.

## Next Safe Actions

- Review and record decision: Review all generated assets, then copy approve or edit notes before running needs_revision or reject.
  - Approve: `node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --manual-package-dir="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10" `
  --review-board="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-board\review-board.json" `
  --decision=approve `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rollback and not-live proof reviewed; Approved for Postiz draft upload only" `
  --notes="Approved for Postiz draft upload only. Do not publish without separate approval."`
  - Needs revision: copy disabled until notes are edited. `node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=needs_revision `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Revision notes describe exactly what must change; Postiz remains blocked" `
  --notes="EDIT REQUIRED: add specific revision notes before running."`
  - Reject: copy disabled until notes are edited. `node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=reject `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rejection notes describe why the campaign should stop; Postiz remains blocked" `
  --notes="EDIT REQUIRED: add specific rejection notes before running."`

## Gated Upcoming Actions

- Fill real local Postiz inputs: blocked. Blocked until: Human approval recorded.
  - Prepare local Postiz inputs: copy disabled. `node social-studio\tools\prepare-postiz-local-inputs.mjs `
  --integrations-template="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.template.json" `
  --uploaded-media-template="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.template.json" `
  --integrations-out="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media-out="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json"`
  - Validate Postiz inputs: copy disabled. `node social-studio\tools\validate-postiz-local-inputs.mjs `
  --bundle="social-studio\generated\cc-rubber-base-demo-2026-06-10\approved-bundle.json" `
  --review-board="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-board\review-board.json" `
  --integrations="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit"`
- Refresh Postiz readiness: blocked. Blocked until: Human approval recorded; Real local Postiz input values.
  - Refresh Postiz readiness: copy disabled. `node social-studio\tools\build-postiz-dry-run-readiness.mjs `
  --workflow-status="social-studio\generated\cc-rubber-base-demo-2026-06-10\workflow-status.json" `
  --integrations="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\integrations.local.json" `
  --uploaded-media="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\uploaded-media.local.json" `
  --approved-bundle="social-studio\generated\cc-rubber-base-demo-2026-06-10\approved-bundle.json" `
  --postiz-input-kit="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-input-kit\postiz-input-kit.json" `
  --manual-manifest="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10\manifest.json" `
  --postiz-dry-run="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-draft.dry-run.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10\postiz-dry-run-readiness"`
- Build Postiz dry-run package: blocked. Blocked until: Human approval recorded; Real local Postiz input values.
  - Build Postiz dry-run: copy disabled. `node social-studio\tools\run-postiz-dry-run-cycle.mjs `
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
  --path-leak-scan-passing=true`
- Confirm MVP completion: blocked. Blocked until: Human approval recorded; Real local Postiz input values; Postiz draft dry-run package.

## Operator Files

- Human approval handoff: social-studio/generated/cc-rubber-base-demo-2026-06-10/human-approval-handoff/human-approval-handoff.ui.json - Review generated assets and copy the selected decision command.
- Postiz integration IDs: social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/integrations.local.json - Add real channel IDs and platform settings only.
- Uploaded media references: social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-input-kit/uploaded-media.local.json - Add real uploaded media IDs and URLs for approved assets only.

## Readiness Snapshot

- Human decision: ready_for_human_decision (3/3 assets ready)
- Postiz inputs: needs_real_values (6 missing checks)
- UGC video: /social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4
- Paid ad video: /social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4
- Normal post: /social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg

## Postiz Input Checklist

- Integration slots: instagram, facebook, tiktok
- instagram: missing in integrations.local.json; fields id, settings.__type
- facebook: missing in integrations.local.json; fields id, settings.__type
- tiktok: missing in integrations.local.json; fields id, settings.__type
- Media upload refs: 0/3 ready
- UGC video: /social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4
- Paid ad video: /social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4
- Normal post: /social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg

## Forbidden Actions

- Do not call the Postiz API from this MVP packet.
- Do not schedule or publish any social post from this MVP packet.
- Do not paste API keys, access tokens, or secrets into local Postiz input files.
- Do not treat the MVP as complete until approval, real Postiz inputs, dry-run package, and completion audit are all green.

## Next Action

- Review all generated assets, then copy approve or edit notes before running needs_revision or reject.
