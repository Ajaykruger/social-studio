# Crystal Clawz Social Studio

Review-first local MVP for creating Crystal Clawz social content with:

- MoneyPrinterTurbo draft-video generation contracts
- Crystal Clawz brand and claim files
- Human review and approval gates
- Manual Postiz draft-upload handoff
- Local-only Postiz dry-run package generation

The current MVP does not schedule or publish posts. It prepares review assets,
approval evidence, local Postiz input templates, and dry-run payloads only.

## Current Workflow

1. Build campaign and brand context.
2. Generate or attach MoneyPrinterTurbo draft media.
3. Review UGC video, paid ad video, and normal post assets.
4. Record a human decision for Postiz draft upload only.
5. Fill local Postiz integration and uploaded-media references.
6. Generate a local Postiz dry-run package.
7. Confirm the MVP completion audit.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Verification

```bash
node --test social-studio/tests/*.test.mjs
npm run build
```

## Safety Boundaries

- No Postiz API calls from the app UI.
- No scheduling or publishing in this MVP.
- No API keys, access tokens, cookies, passwords, or secrets in local Postiz input files.
- Approval means Postiz draft upload only.
- Publishing needs a separate future approval and implementation path.

## MoneyPrinterTurbo

The MoneyPrinterTurbo engine is expected as a local sibling folder when running
the connector against a real local MoneyPrinterTurbo checkout. This repository
includes Crystal Clawz integration materials and contracts, but not Python
virtualenvs, generated task storage, logs, or local config secrets.

## Main Paths

```text
src/                              React app
public/social-studio/             Review media served by the local app
social-studio/                    Plans, agents, tools, tests, generated artifacts
MoneyPrinterTurbo/docs/           Crystal Clawz setup notes
MoneyPrinterTurbo/fixtures/       Crystal Clawz product fixture
MoneyPrinterTurbo/templates/      Crystal Clawz prompt and brand templates
```
