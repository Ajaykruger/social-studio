# Crystal Clawz Social Studio First Build Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first draft-only Social Studio slice: campaign brief -> MoneyPrinterTurbo draft contract -> human review package -> manual Postiz handoff package.

**Architecture:** Social Studio stays outside MoneyPrinterTurbo and owns business rules, schemas, review evidence, and handoff packages. MoneyPrinterTurbo remains the generator engine behind a local connector contract. Postiz receives only human-approved draft packages, starting with manual upload.

**Tech Stack:** Markdown planning docs, JSON schemas/examples, optional Node.js helper scripts in later tasks, MoneyPrinterTurbo local FastAPI endpoint, Postiz manual draft handoff first.

---

## File Map

- `social-studio\schemas\campaign-brief.schema.json`: validates campaign briefs.
- `social-studio\schemas\product-input.schema.json`: validates product claim and visual inputs.
- `social-studio\schemas\review-status.schema.json`: validates human review state.
- `social-studio\schemas\postiz-handoff.schema.json`: validates draft-only Postiz handoff packages.
- `social-studio\examples\`: stores safe fixture examples.
- `social-studio\brand-brain\`: stores brand rules and source references.
- `social-studio\evidence\`: stores sprint checklists and proof notes.
- `social-studio\connectors\moneyprinter\`: future wrapper location for local MoneyPrinterTurbo calls.
- `social-studio\handoff\postiz\`: future draft handoff payload location.

## Task 1: Lock Scope And Evidence

**Files:**

- Read: `social-studio\plans\mvp-plan.md`
- Read: `social-studio\evidence\sprint-evidence-checklist.md`
- Modify only if needed: `social-studio\evidence\sprint-evidence-checklist.md`

- [ ] **Step 1: Confirm first slice scope**

Expected scope:

```text
brief -> draft generation contract -> review package -> manual Postiz handoff
```

Forbidden in this slice:

```text
live posting
production OAuth
server mutation
secrets in files
Shopify/Xero/ERP writes
```

- [ ] **Step 2: Check current local state**

Run:

```powershell
Get-ChildItem -LiteralPath 'social-studio' -Recurse -File | Select-Object FullName,Length,LastWriteTime
git -C 'C:\path\to\CC UCG\MoneyPrinterTurbo' status --short
```

Expected:

- Social Studio files are listed.
- MoneyPrinterTurbo dirty state is recorded, not reverted.

- [ ] **Step 3: Record evidence**

Update the checklist with paths to the files produced in this task if the implementation creates an evidence note.

## Task 2: Add Safe Rubber Base Product Input

**Files:**

- Create: `social-studio\examples\rubber-base-product-input.example.json`
- Validate: `social-studio\schemas\product-input.schema.json`

- [ ] **Step 1: Create the fixture**

Use this content:

```json
{
  "productId": "french-rubber-base",
  "name": "French Rubber Base",
  "category": "Rubber Base Gel",
  "sourceUrl": "https://crystalclawz.co.za/collections/french-rubber-base",
  "approvedBenefits": [
    "smooth base",
    "cleaner colour application",
    "salon-ready base",
    "useful for French sets",
    "supports overlay work where the product page supports it"
  ],
  "blockedClaims": [
    "medical or health claims",
    "guaranteed perfect results",
    "invented testimonials",
    "unverified lab results",
    "works for every client"
  ],
  "requiredVisuals": [
    "product_closeup",
    "shade_or_swatch",
    "cta_end_frame"
  ],
  "mediaFolder": "",
  "approvalNote": "Use only product-page-supported claims or human-approved Crystal Clawz wording.",
  "lastReviewedAt": "",
  "reviewedBy": ""
}
```

- [ ] **Step 2: Parse the fixture**

Run:

```powershell
Get-Content -LiteralPath 'social-studio\examples\rubber-base-product-input.example.json' -Raw | ConvertFrom-Json | Out-Null
```

Expected: no error.

## Task 3: Create Draft Campaign Brief Fixture

**Files:**

- Create: `social-studio\examples\rubber-base-campaign-brief.example.json`
- Validate: `social-studio\schemas\campaign-brief.schema.json`

- [ ] **Step 1: Create the fixture**

Use this content:

```json
{
  "campaignId": "cc-rubber-base-demo-2026-06-10",
  "campaignName": "French Rubber Base Draft Demo",
  "product": {
    "name": "French Rubber Base",
    "category": "Rubber Base Gel",
    "url": "https://crystalclawz.co.za/collections/french-rubber-base"
  },
  "audience": "South African nail technicians",
  "painPoint": "French and colour work can look messy when the base is uneven",
  "contentType": "ugc_video",
  "platforms": ["instagram", "facebook", "tiktok"],
  "cta": "Shop Crystal Clawz French Rubber Base",
  "tone": "Friendly, professional, practical, salon-focused",
  "claimSource": {
    "sourceType": "product_page",
    "sourceRef": "https://crystalclawz.co.za/collections/french-rubber-base",
    "approvedBenefits": [
      "smooth base",
      "cleaner colour application",
      "salon-ready base"
    ],
    "blockedClaims": [
      "medical or health claims",
      "guaranteed perfect results",
      "invented testimonials"
    ]
  },
  "reviewer": "pending-human-review",
  "dueDate": "",
  "status": "brief"
}
```

- [ ] **Step 2: Parse the fixture**

Run:

```powershell
Get-Content -LiteralPath 'social-studio\examples\rubber-base-campaign-brief.example.json' -Raw | ConvertFrom-Json | Out-Null
```

Expected: no error.

## Task 4: Define MoneyPrinterTurbo Connector Contract

**Files:**

- Create: `social-studio\connectors\moneyprinter\README.md`
- Create: `social-studio\connectors\moneyprinter\request.example.json`

- [ ] **Step 1: Write connector README**

Include:

```markdown
# MoneyPrinterTurbo Connector Contract

This connector is draft-only.

It prepares payloads for the local MoneyPrinterTurbo API and collects outputs for human review.

## Local API

- Health/docs: `http://127.0.0.1:8080/docs`
- Create video: `POST /api/v1/videos` or the route shown by the local docs
- Poll task: `GET /api/v1/tasks/{task_id}` or the route shown by the local docs

## Safety

- Do not expose `config.toml`.
- Do not print API keys.
- Do not use MoneyPrinterTurbo cross-posting features.
- Do not send anything to Postiz until human review is complete.
```

- [ ] **Step 2: Create request example**

Use this content:

```json
{
  "video_subject": "Crystal Clawz French Rubber Base for South African nail technicians",
  "video_script_prompt": "Create a short, practical, salon-focused script for Crystal Clawz French Rubber Base. Speak to South African nail technicians. Keep claims grounded: smooth base, cleaner colour application, salon-ready base. Do not invent testimonials, medical claims, lab results, or guaranteed outcomes.",
  "video_aspect": "9:16",
  "video_source": "local",
  "video_count": 1,
  "video_clip_duration": 5,
  "voice_name": "",
  "subtitle_enabled": true
}
```

- [ ] **Step 3: Parse request example**

Run:

```powershell
Get-Content -LiteralPath 'social-studio\connectors\moneyprinter\request.example.json' -Raw | ConvertFrom-Json | Out-Null
```

Expected: no error.

## Task 5: Create Review Package Fixture

**Files:**

- Create: `social-studio\examples\rubber-base-review-status.example.json`
- Validate: `social-studio\schemas\review-status.schema.json`

- [ ] **Step 1: Create fixture**

Use this content:

```json
{
  "campaignId": "cc-rubber-base-demo-2026-06-10",
  "assetId": "cc-rubber-base-demo-video-001",
  "status": "needs_review",
  "reviewer": "pending-human-review",
  "checks": {
    "brandFit": false,
    "claimSafe": false,
    "productVisible": false,
    "captionReady": false,
    "ctaReady": false,
    "platformReady": false,
    "notLive": true
  },
  "notes": "Initial fixture. Human reviewer must update checks before approval.",
  "approval": {
    "approvedBy": "",
    "approvedAt": "",
    "approvalEvidence": ""
  }
}
```

- [ ] **Step 2: Parse fixture**

Run:

```powershell
Get-Content -LiteralPath 'social-studio\examples\rubber-base-review-status.example.json' -Raw | ConvertFrom-Json | Out-Null
```

Expected: no error.

## Task 6: Verify Everything

**Files:**

- Read all files in `social-studio\`

- [ ] **Step 1: Parse all JSON files**

Run:

```powershell
$files = Get-ChildItem -LiteralPath 'social-studio' -Recurse -Filter *.json -File
foreach ($file in $files) {
  Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json | Out-Null
  "OK $($file.FullName)"
}
```

Expected: every JSON file prints `OK`.

- [ ] **Step 2: Build root app**

Run:

```powershell
npm run build
```

Expected: Vite build passes.

- [ ] **Step 3: Secret-pattern scan**

Run:

```powershell
rg -n "\b(sk-live|sk-proj|sk-test)-[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]+|Bearer\s+[A-Za-z0-9._-]{12,}|pos_[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]+" social-studio
```

Expected: no matches.

- [ ] **Step 4: Report endpoint status**

Run:

```powershell
try { 'api=' + (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8080/docs' -TimeoutSec 5).StatusCode } catch { 'api_error=' + $_.Exception.Message }
try { 'webui=' + (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8501' -TimeoutSec 5).StatusCode } catch { 'webui_error=' + $_.Exception.Message }
```

Expected: either `200` if running, or a recorded blocker if not running.

## Task 7: Handoff Gate

The first build slice is ready for implementation only when:

- the fixtures exist
- JSON parsing passes
- root build passes
- no secrets are found
- MoneyPrinterTurbo endpoint state is recorded
- Postiz remains manual/draft-only

Do not connect Postiz production OAuth or publish live content in this slice.
