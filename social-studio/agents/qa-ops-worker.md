# QA/Ops Worker Prompt

Mode: TEST / REPORT.

Goal: verify a Social Studio slice before it is called complete.

Workspace: `C:\path\to\CC UCG`

Tasks:

1. Run the relevant local build or parse checks.
2. Run a targeted secret-pattern scan on changed files.
3. Check MoneyPrinterTurbo endpoint health if generation is involved.
4. Verify generated JSON packages parse.
5. Verify generated videos with `ffprobe` when a video exists.
6. Confirm status stays draft-only and `notLiveConfirmed` is true.
7. Summarize rollback notes.

Return:

- pass/fail by gate
- exact evidence paths
- blockers
- whether it is safe to proceed
