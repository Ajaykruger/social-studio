# Manual Postiz Draft Handoff

This folder is for manual Postiz draft upload packages.

## Safety Rule

Do not upload or schedule a package in Postiz until the package has a human approval bundle.

The current preview package stays in:

`social-studio\handoff\postiz\manual\cc-rubber-base-demo-2026-06-10`

It is currently for review only.

## Human Approval Command

After Andre or Jenn reviews all generated assets and the contact sheet, record the approval with:

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --manual-package-dir="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10" `
  --decision=approve `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rollback and not-live proof reviewed; Approved for Postiz draft upload only." `
  --notes="Approved for Postiz draft upload only. Do not publish without separate approval."
```

If the draft needs changes:

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=needs_revision `
  --reviewer="Andre" `
  --evidence="Reviewed UGC video, paid ad video, normal post, and contact sheet locally." `
  --notes="Describe what must change before Postiz upload."
```

## Manual Postiz Draft Steps

Only after approval:

1. Open Postiz.
2. Create draft posts for the approved platforms and formats.
3. Upload each reviewed asset:
   - UGC video: `media\final-1.mp4`
   - Paid ad video: `media\paid-ad-video-02.mp4`
   - Normal post: `media\normal-post-03.svg`
4. Copy `caption.txt`.
5. Copy `hashtags.txt`.
6. Choose the approved platforms only.
7. Keep everything as drafts unless final scheduling is separately approved.
8. Record proof that the posts are not live.

## Current Package Contents

Each package should contain:

- `manifest.json`
- `caption.txt`
- `hashtags.txt`
- `review-checklist.md`
- `media\final-1.mp4`
- `media\paid-ad-video-02.mp4`
- `media\normal-post-03.svg`
- thumbnail image
