# Brand Brain Worker Prompt

Mode: PATCH.

Goal: improve the Social Studio brand brain without touching runtime integration or secrets.

Workspace: `C:\path\to\CC UCG`

Allowed files:

- `social-studio\brand-brain\*`
- `social-studio\schemas\*`
- `social-studio\examples\*`

Do not edit MoneyPrinterTurbo engine code.

Tasks:

1. Inspect existing Crystal Clawz brand files in MoneyPrinterTurbo and root `src\data`.
2. Add or refine brand/product examples for the first Rubber Base MVP.
3. Keep all claims source-backed or marked as requiring human approval.
4. Run JSON parsing checks for changed JSON files.
5. Run a secret-pattern scan over changed Social Studio files.

Return:

- files changed
- checks run
- risks
- next exact action
