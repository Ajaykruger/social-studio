# Postiz Local Input Validation

Generated: 2026-06-12T06:36:31.481Z
Campaign: cc-rubber-base-demo-2026-06-10
Status: blocked

## Safety

- Command only: yes
- Network calls allowed: no
- Live actions enabled: no
- Values shown: no

## Results

- Ready for dry-run: no
- Missing checks: 6
- Input secrets: none

## Operator Preflight

- instagram: missing. File: integrations.local.json. Missing fields: id.
- facebook: missing. File: integrations.local.json. Missing fields: id.
- tiktok: missing. File: integrations.local.json. Missing fields: id.
- UGC video: missing. File: uploaded-media.local.json. Missing fields: id, path.
- Paid ad video: missing. File: uploaded-media.local.json. Missing fields: id, path.
- Normal post: missing. File: uploaded-media.local.json. Missing fields: id, path.

## Operator Edit Plan

- integrations.local.json: 3 records need attention.
  - Allowed fields: platform, id, settings.__type
- uploaded-media.local.json: 3 records need attention.
  - Allowed fields: assetId, contentType, id, path

## Next Action

- Edit integrations.local.json and uploaded-media.local.json with real local Postiz IDs and uploaded media values, then refresh readiness.
