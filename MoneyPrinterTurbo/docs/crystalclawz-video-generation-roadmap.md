# Crystal Clawz Video Generation Roadmap

Date: 2026-06-09

## Current MoneyPrinterTurbo Reality

MoneyPrinterTurbo does not currently create fully generative AI video scenes from OpenAI or Gemini inside this app.

Its working pipeline is:
1. Generate a script with an LLM such as OpenAI or Gemini.
2. Generate or use audio through TTS or a custom audio file.
3. Pull stock video from Pexels or Pixabay, or use local uploaded media.
4. Compose the final video with FFmpeg/MoviePy.
5. Optionally add subtitles and background music.

For Crystal Clawz, this means better ads require better branded prompts, better product media, and working LLM/TTS/media keys. Sora or Gemini/Veo-style generated motion video would be a new integration, not a built-in MoneyPrinterTurbo feature.

## Branding Added

The app now loads:

`templates/crystalclawz_brand_context.md`

That file is appended to script-generation prompts in `app/services/llm.py`, so future generated scripts should follow the Crystal Clawz audience, tone, claim boundaries, and French Rubber Base positioning.

The starting Rubber Base ad brief is:

`templates/crystalclawz_ad_brief_rubber_base.json`

## Keys Needed For The Existing App

For the current MoneyPrinterTurbo pipeline:

- OpenAI key or Gemini key: script generation.
- Pexels key or Pixabay key: stock video search and download.
- TTS option:
  - Edge TTS can work without a paid key but previously timed out on this machine.
  - Gemini TTS needs a Gemini key.
  - Azure Speech needs Azure key and region.
- ImageMagick path: needed for some text/subtitle workflows on Windows.

Keep keys only in ignored `config.toml` or environment variables. Do not commit them.

## Better Ads Path

Recommended next build order:

1. Get script generation working with OpenAI or Gemini.
2. Use local Crystal Clawz product images and videos as the primary material source.
3. Add Pexels or Pixabay only for neutral salon atmosphere clips, not fake product footage.
4. Fix TTS with either a reliable provider or a local voice workflow.
5. Add a Sora or other video-generation module only after the basic ad workflow is stable.

## Sora/OpenAI Path

OpenAI's current video generation API uses Sora models and is asynchronous: create a video job, poll or use webhooks, then download the MP4 when complete.

Important constraint: Sora input images with human faces are currently restricted. Product-only images are the safer starting point.

For Crystal Clawz, the safer first Sora experiment would be product-only:

Prompt example:
"Close-up product video of a black Crystal Clawz French Rubber Base bottle on a clean salon table, soft pink and white nail swatches beside it, slow push-in camera move, polished professional lighting, no hands, no people, no text."

## Not Yet Done

- No API keys were added.
- No live external posting was enabled.
- No Shopify, n8n, ERP, Xero, TikTok, Instagram, or YouTube connection was made.
- No Sora/Gemini video integration was added yet.
