# Agent instructions — Crystal Clawz Social Studio

These rules apply to EVERY automated change in this repository. Read them
before writing any code.

## What this app is

A review-first social content studio for Crystal Clawz (a South African nail
product brand). Three tabs: **Create** (paste a crystalclawz.co.za product
URL → claim-guarded AI/template generation → campaign draft), **Review**
(human reviewer "Jen" approves / requests changes / rejects on her phone),
**Operator** (technical dashboards). A localhost Express server
(`server/decision-api.mjs`, port 4810) wraps the guarded Node tools in
`social-studio/tools/` and serves the built app.

## Non-negotiable safety boundaries

Violating any of these is a failed task, even if every test passes:

1. **Draft-only.** Approval creates a manual Postiz draft package ONLY.
   Never add scheduling, publishing, or any code path that posts content
   live. Never add Postiz API network calls. `scheduledFor` stays empty.
   TikTok settings stay `content_posting_method: "UPLOAD"`, never
   `DIRECT_POST`.
2. **Claim guard is law.** All generated or imported marketing text must
   pass `src/utils/claimGuard.js`. Blocked claim families: long-lasting /
   durability, prevents/stops lifting, chip-proof, strengthening,
   repair/heal/nail-health, guaranteed results, "fixes" claims. Never
   weaken `BLOCKED_CLAIM_PATTERNS`, never bypass `assertClaimSafe`.
3. **Human approval is central.** Every content-producing flow must end in
   a `needs_review` bundle that a named human reviewer decides on. Decisions
   require the per-campaign evidence gates. Never auto-approve, never
   pre-tick gates, never remove the re-approval 409 block.
4. **No secrets in the repo.** API keys live only in `.env` (gitignored).
   Never commit `.env`, never write keys into code, JSON artifacts, or
   tests. `integrations.local.json` / `uploaded-media.local.json` stay
   gitignored.
5. **Product imports are allowlisted** to `crystalclawz.co.za` only
   (`server/product-import.mjs`). Never widen the allowlist or add a
   generic URL fetcher.
6. **The server binds 127.0.0.1 by default.** Do not change the default
   HOST. Audit logs (`social-studio/audit/*.jsonl`) are append-only —
   never rewrite or delete entries.

## Do not touch

- `social-studio/generated/cc-rubber-base-demo-2026-06-10/` — the original
  demo campaign and its artifacts are review evidence. Read, never modify.
- `social-studio/evidence/`, `social-studio/handoff/postiz/manual/` —
  historical evidence.
- Existing tests: you may ADD tests freely; you may only modify an existing
  test when the task explicitly says so, and never to weaken a safety
  assertion.
- The legacy three-asset evidence gates for the demo campaign (bundles
  without `requiredContentTypes` keep all six gates).

## Architecture map

- `src/` — React 19 + Vite 7 + Tailwind 3. `App.jsx` has the tabs and a
  runtime artifact manifest (paths fetched from `/studio-data/<campaign>/`).
  Key components: `CreateScreen.jsx`, `ReviewDecisionScreen.jsx`.
  `src/utils/claimGuard.js` and `src/utils/studioData.js` are shared.
- `server/` — `decision-api.mjs` (Express API + static serving),
  `product-import.mjs`, `generate-campaign.mjs` (Claude `claude-opus-4-8`
  structured output when `ANTHROPIC_API_KEY` set, templates otherwise),
  `env.mjs` (.env loader).
- `social-studio/tools/` — guarded CLI tools. The decision flow is
  `run-review-decision-cycle.mjs` → `record-review-decision.mjs` →
  `handoff/postiz/build-manual-package.mjs`. These accept an injectable
  `workspaceRoot` for tests.
- `social-studio/tests/` — node:test suite. **203 tests passing** at
  handoff; that number only goes up.
- `social-studio/lib/` — shared guards (`postiz-input-safety.mjs`,
  `postiz-input-guards.mjs`).
- Campaign data contract: each campaign lives in
  `social-studio/generated/<campaignId>/` with `draft-bundle.json`,
  `review-board/review-board.json`, `review-packet/review-packet.ui.json`,
  `workflow-status.ui.json`; media in
  `public/social-studio/<campaignId>/review/`. Bundles may declare
  `postizHandoff.requiredContentTypes` (e.g. `["ugc_video","normal_post"]`);
  approval is blocked until the review board has a decision-ready item for
  every required type.

## Conventions

- Node ESM (`.mjs` for server/tools, `type: "module"`). No TypeScript.
  No new runtime dependencies without strong justification.
- Persisted paths inside artifacts are workspace-relative with forward
  slashes; resolve at point of use (see `resolveWorkspacePath`). The app
  must keep working on Windows (paths with spaces: `CC UCG`).
- Tests use temp dirs (`mkdtemp`) and stub `fetch` — never hit the network
  and never write into the real workspace.
- UI: Tailwind utility classes, mobile-first (Jen reviews on a phone),
  min-h-12 touch targets, explicit loading/error/empty states, media
  elements need `onError` fallbacks.
- Several "wiring" tests grep `src/App.jsx` for artifact path strings and
  panel order, and grep panel components to ensure they contain no
  `fetch(`. Keep panels passive; keep the manifest path strings in
  App.jsx; keep the Operator panel JSX order.

## Verify every change

```bash
npm test        # all node:test suites - must be >= 203 passing, 0 failing
npm run build   # Vite production build - must succeed
```

For server/UI changes also smoke: `npm run build && npm run serve`, then
check `http://127.0.0.1:4810/api/health` and load the app.

## Commits

Small, single-purpose commits on `main`. Imperative subject line, body
explains what and why, mention test counts. Never force-push. Never commit
`.env`, `dist/`, `node_modules/`, or anything matched by `.gitignore`.
