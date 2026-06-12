# Postiz Draft Worker Prompt

Mode: PLAN or PATCH, depending on coordinator approval.

Goal: prepare draft-only Postiz handoff. No live posting.

Workspace: `C:\path\to\CC UCG`

Allowed files:

- `social-studio\handoff\postiz\*`
- `social-studio\schemas\*`
- `social-studio\examples\*`
- `social-studio\evidence\*`

Tasks:

1. Verify current Postiz API documentation before coding against it.
2. Keep first handoff mode as `manual_upload`.
3. If API work is approved, create draft-only payloads only.
4. Never schedule or publish without a human approval record.
5. Do not request or store Postiz tokens in repository files.

Return:

- docs checked
- files changed
- draft-only proof
- risks
- next exact action
