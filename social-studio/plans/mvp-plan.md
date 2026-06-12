# Crystal Clawz Social Studio MVP Plan

Date: 2026-06-10

## Goal

Build a review-first Crystal Clawz content workflow that connects:

- Crystal Clawz brand brain and campaign briefs
- MoneyPrinterTurbo as the first draft video/content generator
- Postiz as the social calendar, approval, scheduling, and publishing system
- Human approval before anything can be scheduled or posted

## Decision

Do not convert MoneyPrinterTurbo into a full social publishing platform.

Use this split:

- Social Studio owns briefs, brand rules, review status, evidence, and handoff packages.
- MoneyPrinterTurbo owns script/video rendering and task outputs.
- Postiz owns social accounts, OAuth, calendar, scheduling, publishing, and analytics.
- n8n is later glue after the manual and API draft flows are proven.

## Current Local State

- Root app: `C:\path\to\CC UCG`
  - Existing local Crystal UGC Studio for Flow/Gemini-style prompt packs.
  - Not currently a git repository.
- Generator repo: `C:\path\to\CC UCG\MoneyPrinterTurbo`
  - Nested git repo on `main`.
  - Dirty with intentional Crystal Clawz planning/branding work.
  - Current local endpoints were not running during the 2026-06-10 planning pass.
- Existing brand files:
  - `MoneyPrinterTurbo\templates\crystalclawz_brand_context.md`
  - `MoneyPrinterTurbo\templates\crystalclawz_ad_brief_rubber_base.json`
  - `MoneyPrinterTurbo\templates\crystalclawz_video_prompt.md`
  - `MoneyPrinterTurbo\fixtures\crystalclawz_products.json`

## MVP Workflow

1. `brief`
   - Andre/Jenn creates a campaign brief.
   - Brief names product, audience, pain point, content type, platform, CTA, claim source, and reviewer.
2. `draft_generated`
   - Social Studio calls or guides MoneyPrinterTurbo.
   - MoneyPrinterTurbo creates a draft video, caption, hashtags, and metadata.
3. `needs_review`
   - Human checks brand fit, product visibility, claims, captions, CTA, and platform readiness.
4. `approved`
   - Reviewed asset is locked for handoff.
5. `draft_upload_ready`
   - Social Studio creates a Postiz handoff package.
6. `handed_to_postiz`
   - First sprint: manual Postiz upload or draft creation only.
   - Later sprint: API-created Postiz draft.
7. `needs_revision` or `rejected`
   - Reviewer notes return the asset to editing.

## Postiz MVP Role

Postiz should own:

- social account connections and OAuth
- draft calendar
- final approval/scheduling flow
- publishing queue
- analytics and status after posting

Postiz should not own:

- Crystal Clawz brand brain
- heavy script/video generation
- product claim rules
- automatic posting before review
- engagement automation in the MVP

First integration should be manual upload, then API-created drafts.

## MoneyPrinterTurbo MVP Role

MoneyPrinterTurbo should own:

- script generation using the existing Crystal Clawz brand context
- TTS or custom audio
- local or stock media assembly
- subtitles
- final MP4 render
- local task storage

Social Studio should own:

- campaign brief intake
- status tracking
- output collection
- review evidence
- Postiz handoff package

Minimum MoneyPrinterTurbo contract:

- `POST /videos`
- `GET /tasks/{task_id}`
- final output under `storage/tasks/<task_id>/`

## Provider Strategy

First sprint:

- MoneyPrinterTurbo
- local Crystal Clawz product media
- OpenAI or Gemini only for script/caption generation if a key is approved
- Pexels/Pixabay only for neutral salon background clips if approved

Second stage:

- OpenMontage for higher-quality agentic ad production
- Gemini/Veo-style provider for selected product hero shots, if cost is approved

Avoid hardwiring OpenAI Sora as a core dependency. Current OpenAI docs say the Sora 2 Videos API is deprecated and scheduled to shut down on September 24, 2026.

## Skills And Plugins To Use

Core plugins:

- Superpowers
- Browser
- GitHub
- OpenAI Developers
- Chrome only for logged-in OAuth/browser work
- Data Analytics later for reporting
- Google Drive/Canva only if assets or approvals live there

Core skills:

- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `superpowers:using-git-worktrees`
- `superpowers:subagent-driven-development`
- `superpowers:dispatching-parallel-agents`
- `superpowers:test-driven-development`
- `superpowers:systematic-debugging`
- `superpowers:verification-before-completion`
- `superpowers:requesting-code-review`

## Agent Lanes

- Postiz agent: deployment, API, drafts, OAuth and social platform risks.
- MoneyPrinterTurbo agent: generation API, runtime blockers, output contract.
- Brand brain agent: schemas, review states, claim rules, content templates.
- Video provider agent: MoneyPrinterTurbo, OpenMontage, Veo, avatar/video providers.
- QA/ops agent: gates, secrets scan, endpoint checks, rollback evidence.

## Build-Check-Edit Loop

Each sprint slice must follow:

1. Plan the smallest useful slice.
2. Build only that slice.
3. Run the verification gates.
4. Edit the failing part only.
5. Save evidence.
6. Repeat.

## Verification Gates

Before MVP completion can be claimed:

- Root app builds if changed.
- MoneyPrinterTurbo API and WebUI health are checked if generation is used.
- One safe Rubber Base draft asset is generated or represented by a verified fixture.
- One Postiz handoff package exists and is draft-only.
- No live posting happens.
- Secrets scan passes.
- `config.toml`, `.env`, OAuth tokens, and API keys are not committed.
- Human review status is recorded.
- Rollback note exists.

## First Implementation Plan

1. Inventory and preserve current MoneyPrinterTurbo dirty state.
2. Keep Social Studio outside MoneyPrinterTurbo.
3. Add schemas for campaign brief, review status, and Postiz handoff.
4. Add one Rubber Base example handoff package.
5. Add a small local wrapper only after schema review:
   - read brief
   - call MoneyPrinterTurbo
   - poll task
   - collect output path
   - create review package
6. Bring Postiz in manually first:
   - upload approved MP4 and caption
   - keep it as a draft
   - prove it is not live
7. Add Postiz API draft creation later.

## Explicit Non-Goals For MVP

- no live auto-posting
- no production OAuth setup without separate approval
- no engagement automation
- no automatic comments, likes, or replies
- no ERP/Xero/Shopify writes
- no secrets in git
- no attempt to make MoneyPrinterTurbo a full scheduler
