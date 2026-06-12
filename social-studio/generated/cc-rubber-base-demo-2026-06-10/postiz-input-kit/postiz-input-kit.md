# Postiz Input Kit

Generated: 2026-06-12T06:36:31.481Z
Campaign: cc-rubber-base-demo-2026-06-10
Status: needs_real_values

## Safety

- Network calls allowed: no
- Secrets shown in UI: no
- Secret-like fields found: 0

## Files

- Integrations template: integrations.local.template.json
- Uploaded media template: uploaded-media.local.template.json
- Integrations local file: integrations.local.json
- Uploaded media local file: uploaded-media.local.json

## Validation

- Required platforms: 3
- Ready integrations: 0
- Uploaded media ready: 0

## Upload Targets

- UGC video: upload video, then fill uploaded-media.local.json fields id, path.
- Paid ad video: upload video, then fill uploaded-media.local.json fields id, path.
- Normal post: upload image, then fill uploaded-media.local.json fields id, path.

## Operator Preflight

- instagram: missing. File: integrations.local.json. Missing fields: id. Fields: id, settings.__type.
- facebook: missing. File: integrations.local.json. Missing fields: id. Fields: id, settings.__type.
- tiktok: missing. File: integrations.local.json. Missing fields: id. Fields: id, settings.__type.
- UGC video: missing. File: uploaded-media.local.json. Missing fields: id, path. Fields: id, path.
- Paid ad video: missing. File: uploaded-media.local.json. Missing fields: id, path. Fields: id, path.
- Normal post: missing. File: uploaded-media.local.json. Missing fields: id, path. Fields: id, path.

## Operator Edit Plan

- integrations.local.json: Fill one real Postiz channel integration record per required platform.
  - Allowed fields: platform, id, settings.__type
  - instagram: missing. Missing fields: id. Fields: id, settings.__type.
  - facebook: missing. Missing fields: id. Fields: id, settings.__type.
  - tiktok: missing. Missing fields: id. Fields: id, settings.__type.
- uploaded-media.local.json: Fill one real uploaded media reference per approved review asset.
  - Allowed fields: assetId, contentType, id, path
  - UGC video: missing. Missing fields: id, path. Fields: id, path.
    - Source asset: /social-studio/cc-rubber-base-demo-2026-06-10/review/final-1.mp4
    - Source instruction: Upload the reviewed source asset to Postiz, then paste the returned media id and path.
  - Paid ad video: missing. Missing fields: id, path. Fields: id, path.
    - Source asset: /social-studio/cc-rubber-base-demo-2026-06-10/review/paid-ad-video-02.mp4
    - Source instruction: Upload the reviewed source asset to Postiz, then paste the returned media id and path.
  - Normal post: missing. Missing fields: id, path. Fields: id, path.
    - Source asset: /social-studio/cc-rubber-base-demo-2026-06-10/review/normal-post-03.svg
    - Source instruction: Upload the reviewed source asset to Postiz, then paste the returned media id and path.

## Next Action

- Edit integrations.local.json and uploaded-media.local.json with real local Postiz IDs and uploaded media values, then refresh readiness.
