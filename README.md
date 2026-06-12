# Crystal Clawz Social Studio

[![CI](https://github.com/Ajaykruger/social-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Ajaykruger/social-studio/actions/workflows/ci.yml)

Review-first local MVP for creating Crystal Clawz social content with:

- MoneyPrinterTurbo draft-video generation contracts
- Crystal Clawz brand and claim files
- Human review and approval gates
- Manual Postiz draft-upload handoff
- Local-only Postiz dry-run package generation

The current MVP does not schedule or publish posts. It prepares review assets,
approval evidence, local Postiz input templates, and dry-run payloads only.

## Current Workflow

1. **Create tab**: paste a crystalclawz.co.za product link, pick the one
   approved benefit, and generate captions, hooks, a reel script, and a
   static post. Everything passes the claim guard.
2. **Send to review**: the draft becomes a campaign in the Review tab.
   Reel campaigns stay blocked until the rendered video is attached.
3. **Review tab**: the reviewer checks the assets, confirms each evidence
   gate, and records approve, needs_revision, or reject.
4. Approval creates a manual Postiz draft package only. Filling local Postiz
   inputs and the dry-run package remain operator steps (Operator tab).

## Run Locally

```bash
npm install
npm run build
npm run serve
```

Open http://127.0.0.1:4810/ - the serve command runs the app plus the local
decision API (decisions, product import, generation). For development with
hot reload, run `npm run serve` and `npm run dev` together and use the Vite
URL instead.

### AI generation (optional)

Create a file named `.env` in the project root containing:

```text
ANTHROPIC_API_KEY=sk-ant-...
```

With the key set, the Create tab generates with Claude (claude-opus-4-8).
Without it, generation falls back to built-in templates. The `.env` file is
gitignored and must never be committed.

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
