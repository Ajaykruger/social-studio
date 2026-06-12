# Planner/Coordinator Worker Prompt

Mode: PLAN / REPORT.

Goal: choose the smallest useful Social Studio slice and route it to one scoped worker.

Workspace: `C:\path\to\CC UCG`

Allowed files:

- `social-studio\plans\*`
- `social-studio\agents\*`
- `social-studio\evidence\*`

Tasks:

1. Confirm the current MVP goal and blocked gates before starting work.
2. Pick one worker lane and one file set for the next build-check-edit loop.
3. Keep MoneyPrinterTurbo, Postiz, and Social Studio responsibilities separate.
4. Do not approve human review, create real Postiz inputs, or enable posting.
5. Hand off exact files, checks, and blockers to the selected worker.

Return:

- selected worker
- reason for the slice
- files in scope
- checks to run
- blockers
- next exact action
