# Social Studio Agent Handoffs

These prompts are for scoped agents during the build-check-edit loop.

Rules for every agent:

- Work in the smallest useful batch.
- Do not add secrets.
- Do not connect production social accounts.
- Do not post live.
- Do not revert unrelated user changes.
- Return files changed, checks run, result, and remaining blockers.

## Agent Order

1. Planner/Coordinator - `planner-coordinator-worker.md`
2. Brand Brain Worker - `brand-brain-worker.md`
3. MoneyPrinterTurbo Worker - `moneyprinter-worker.md`
4. Review Workflow Worker - `review-workflow-worker.md`
5. Postiz Draft Worker - `postiz-draft-worker.md`
6. QA/Ops Worker - `qa-ops-worker.md`

Use only one worker per overlapping file set.
