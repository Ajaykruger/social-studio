# MoneyPrinterTurbo Worker Prompt

Mode: PATCH.

Goal: build or verify the local draft-generation contract from Social Studio to MoneyPrinterTurbo.

Workspace: `C:\path\to\CC UCG`

Allowed files:

- `social-studio\connectors\moneyprinter\*`
- `social-studio\examples\*`
- `social-studio\evidence\*`

Do not edit MoneyPrinterTurbo engine code unless the coordinator explicitly expands scope.

Tasks:

1. Confirm whether `http://127.0.0.1:8080/docs` is reachable.
2. If not reachable, report that as a blocker; do not silently change config.
3. Create or update a draft-only wrapper contract:
   - read campaign brief JSON
   - prepare `POST /videos` payload
   - poll `GET /tasks/{task_id}`
   - collect final MP4 path
   - write review package
4. Do not add API keys or print `config.toml`.
5. Run local parse/build checks for changed files.

Return:

- endpoint status
- files changed
- checks run
- blockers
- next exact action
