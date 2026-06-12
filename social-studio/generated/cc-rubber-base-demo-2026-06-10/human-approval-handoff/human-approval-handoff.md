# Human Approval Handoff

Generated: 2026-06-12T06:36:31.481Z
Campaign: cc-rubber-base-demo-2026-06-10
Status: awaiting_human_decision

## Review Media

- Video: /social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4
- Contact sheet: /social-studio/cc-rubber-base-demo-2026-06-10/review/contact-sheet.jpg
- Caption: Smooth base for cleaner salon work. Shop Crystal Clawz French Rubber Base.

## Review Assets

- UGC video: /social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4
- Paid ad video: /social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4
- Normal post: /social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg

## Decision Readiness

### UGC video

- Status: ready

- Review media: ready
- Review evidence: ready
- Decision commands: ready
- Publish blocked: ready
- Not-live proof: ready

### Paid ad video

- Status: ready

- Review media: ready
- Review evidence: ready
- Decision commands: ready
- Publish blocked: ready
- Not-live proof: ready

### Normal post

- Status: ready

- Review media: ready
- Review evidence: ready
- Decision commands: ready
- Publish blocked: ready
- Not-live proof: ready


## Approval Evidence Summary

- UGC video evidence reviewed: covered - UGC video review media and evidence are present.
- Paid ad video evidence reviewed: covered - Paid ad video review media and evidence are present.
- Normal post evidence reviewed: covered - Normal post review media and evidence are present.
- Artifact freshness checked: covered - Current copy-only decision commands are available in the generated handoff.
- Rollback and not-live proof reviewed: covered - Rollback and not-live proof is complete and the review packet confirms nothing is live.
- Approved for Postiz draft upload only: covered - Approve command is scoped to Postiz draft upload only and does not allow scheduling or publishing.

## Per-Asset Approval Checklist

### UGC video

Approve or request changes for UGC video.

Review Evidence:
- Video: /social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4
- Contact sheet: /social-studio/cc-rubber-base-demo-2026-06-10/review/contact-sheet.jpg
- MoneyPrinter prompt: UGC video: UGC video: show French Rubber Base helping South African nail technicians with french and colour work can look messy when the base is uneven using the approved benefit "smooth base". Product: French Rubber ...
- Review focus: creator-style hook feels natural; product is visible early; claims stay inside approved benefits; caption and CTA match the product page

Required Checks:
- Open and review the asset.
- Confirm asset is not live or scheduled.
- Confirm only approved brand and product claims are used.
- Confirm the right decision command will be copied.

### Paid ad video

Approve or request changes for Paid ad video.

Review Evidence:
- Video: /social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4
- Storyboard: /social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02-storyboard.svg
- MoneyPrinter prompt: Paid ad video: Paid ad video: show French Rubber Base helping South African nail technicians with french and colour work can look messy when the base is uneven using the approved benefit "smooth base". Product: French...
- Review focus: first three seconds show the problem or product clearly; benefit claim is source-backed; offer and CTA are explicit; visual pacing works for a paid placement

Required Checks:
- Open and review the asset.
- Confirm asset is not live or scheduled.
- Confirm only approved brand and product claims are used.
- Confirm the right decision command will be copied.

### Normal post

Approve or request changes for Normal post.

Review Evidence:
- Image: /social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg
- Caption draft: French Rubber Base helps with smooth base. Shop Crystal Clawz French Rubber Base.
- Design brief: Normal post: Normal post: show French Rubber Base helping South African nail technicians with french and colour work can look messy when the base is uneven using the approved benefit "smooth base".
- Review focus: single clear product point; caption is useful without overclaiming; image or carousel frame has readable product context; CTA is clear

Required Checks:
- Open and review the asset.
- Confirm asset is not live or scheduled.
- Confirm only approved brand and product claims are used.
- Confirm the right decision command will be copied.


## Decision Intake

- Approval boundary: Approval here means Postiz draft upload only. Scheduling or publishing needs separate approval.
- Not-live confirmation required: yes
- Valid decisions: approve, needs_revision, reject

- Decision: required
- Reviewer name: required
- Evidence reviewed: required
- Decision notes: required

## Safety

- Command only: yes
- Network calls allowed: no
- Live actions enabled: no
- Schedule or publish ready: no
- Rollback and not-live proof: ready

## Decision Commands

### Approve

- Notes: Approval notes are already scoped to Postiz draft upload only.
- Creates the approved bundle and manual Postiz package for Postiz draft upload only. Scheduling and publishing still need separate approval.
- Creates approved bundle: yes
- Creates manual Postiz package: yes
- Keeps Postiz blocked: no
- Allows scheduling or publishing: no
- Copy: enabled

Evidence checklist:
- UGC video evidence reviewed
- Paid ad video evidence reviewed
- Normal post evidence reviewed
- Artifact freshness checked
- Rollback and not-live proof reviewed
- Approved for Postiz draft upload only

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --manual-package-dir="social-studio\handoff\postiz\approved\cc-rubber-base-demo-2026-06-10" `
  --review-board="social-studio\generated\cc-rubber-base-demo-2026-06-10\review-board\review-board.json" `
  --decision=approve `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rollback and not-live proof reviewed; Approved for Postiz draft upload only" `
  --notes="Approved for Postiz draft upload only. Do not publish without separate approval."
```

### Needs revision

- Notes: Edit --notes with specific revision notes before running.
- Keeps Postiz blocked and records the requested changes before any draft upload can continue.
- Creates approved bundle: no
- Creates manual Postiz package: no
- Keeps Postiz blocked: yes
- Allows scheduling or publishing: no
- Copy disabled until notes are edited

Evidence checklist:
- UGC video evidence reviewed
- Paid ad video evidence reviewed
- Normal post evidence reviewed
- Artifact freshness checked
- Revision notes describe exactly what must change
- Postiz remains blocked

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=needs_revision `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Revision notes describe exactly what must change; Postiz remains blocked" `
  --notes="EDIT REQUIRED: add specific revision notes before running."
```

### Reject

- Notes: Edit --notes with specific rejection notes before running.
- Stops this asset from continuing to Postiz. No approved bundle, draft upload, scheduling, or publishing is created.
- Creates approved bundle: no
- Creates manual Postiz package: no
- Keeps Postiz blocked: yes
- Allows scheduling or publishing: no
- Copy disabled until notes are edited

Evidence checklist:
- UGC video evidence reviewed
- Paid ad video evidence reviewed
- Normal post evidence reviewed
- Artifact freshness checked
- Rejection notes describe why the campaign should stop
- Postiz remains blocked

```powershell
node social-studio\tools\run-review-decision-cycle.mjs `
  --input="social-studio\generated\cc-rubber-base-demo-2026-06-10\draft-bundle.json" `
  --out-dir="social-studio\generated\cc-rubber-base-demo-2026-06-10" `
  --decision=reject `
  --reviewer="Andre" `
  --evidence="UGC video evidence reviewed; Paid ad video evidence reviewed; Normal post evidence reviewed; Artifact freshness checked; Rejection notes describe why the campaign should stop; Postiz remains blocked" `
  --notes="EDIT REQUIRED: add specific rejection notes before running."
```

## Next Action

- Review all generated assets, then copy approve or edit notes before running needs_revision or reject.
