# Crystal Clawz Social Studio

Planning scaffold for the Crystal Clawz review-first social content system.

## Purpose

Crystal Clawz Social Studio coordinates brand-safe content creation before anything reaches a live social account.

The MVP workflow is:

1. Create a campaign brief.
2. Generate draft content or video through a generator such as MoneyPrinterTurbo.
3. Review the output against Crystal Clawz brand and claim rules.
4. Approve the asset for Postiz draft upload only.
5. Hand the approved package to Postiz as a draft or manual upload.
6. Final scheduling or publishing needs separate approval.

## Boundaries

This folder does not contain live posting code yet.

Do not store API keys, OAuth tokens, `.env` files, Postiz tokens, social credentials, or generated secrets here.

The Postiz API handoff is currently dry-run only. See `handoff/postiz/api-draft/README.md`.

## First Sprint Rule

The first sprint is draft-only:

- no live auto-posting
- no production social OAuth
- no server mutation without a separate approval
- no secrets committed
- every generated asset must go through human review

## Main Plan

See `plans/mvp-plan.md`.
