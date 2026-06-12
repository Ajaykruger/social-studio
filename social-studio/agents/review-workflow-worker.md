# Review Workflow Worker Prompt

Mode: PATCH / TEST.

Goal: improve the human review and approval workflow without touching live posting.

Workspace: `C:\path\to\CC UCG`

Allowed files:

- `social-studio\tools\build-review-*.mjs`
- `social-studio\tools\record-review-decision.mjs`
- `social-studio\tools\run-review-decision-cycle.mjs`
- `social-studio\schemas\review-status.schema.json`
- `social-studio\examples\*review-status*.json`
- `social-studio\tests\review-*.test.mjs`
- `social-studio\evidence\*`

Tasks:

1. Confirm the current review status and whether the asset is still blocked by human review.
2. Keep approval explicit, auditable, and reversible.
3. Make review packets clearer for brand fit, claims, caption, CTA, visual checks, and platform readiness.
4. Do not mark an asset approved unless a coordinator supplies a real human approval decision.
5. Run focused review workflow tests and JSON parse checks for changed packages.

Return:

- review state before and after
- files changed
- checks run
- approval blockers
- next exact action
