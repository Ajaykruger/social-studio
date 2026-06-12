# Postiz Rollback And Not-Live Proof

This note belongs to the Crystal Clawz Social Studio MVP handoff. It is local-only and does not call Postiz.

## Current Not-Live Proof

- Current package state is draft-only and review-first.
- No schedule or publish action is authorized by this MVP.
- `approved-bundle.json` and `postiz-draft.dry-run.json` must stay absent until real human approval and real local Postiz input values exist.
- Postiz drafts, if created later, must remain unpublished until separate final scheduling approval is recorded.

## Rollback

If an operator needs to return the workspace to the pre-approval review gate:

1. Remove generated approval/dry-run artifacts only:
   - `social-studio/generated/cc-rubber-base-demo-2026-06-10/approved-bundle.json`
   - `social-studio/generated/cc-rubber-base-demo-2026-06-10/postiz-draft.dry-run.json`
   - `social-studio/handoff/postiz/approved/cc-rubber-base-demo-2026-06-10`
2. Rerun the current review-state refresh.
3. Confirm the completion audit is `incomplete`, workflow status is `needs_review`, and live actions remain disabled.

Do not delete local Postiz input templates or review media. Do not remove real Postiz drafts from the Postiz UI without separate operator confirmation.
