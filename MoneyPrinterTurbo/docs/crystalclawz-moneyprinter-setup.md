# Crystal Clawz MoneyPrinterTurbo Setup Notes

Date checked: 2026-06-07

## Scope

This is a local proof of concept for Crystal Clawz short-form nail product videos. It must use fixture/demo product data first and must not connect to live Shopify, Xero, ERP, posting APIs, or production automation.

## Local Checkout

- Repo: https://github.com/harry0703/MoneyPrinterTurbo
- Local folder: `C:\path\to\CC UCG\MoneyPrinterTurbo`
- Checkout method: shallow fetch of `main` after the first full clone timed out.
- Current commit inspected: `ed1dc678d5c05cf8b265a34d3e590a17e32b7ecf`

## Files Inspected

- `README-en.md`
- `README.md`
- `config.example.toml`
- `.gitignore`
- `Dockerfile`
- `Dockerfile.gpu`
- `docker-compose.yml`
- `docker-compose.gpu.yml`
- `docs/GPU_DOCKER_DEPLOYMENT.md`
- `webui.bat`
- `webui.sh`
- `main.py`
- `app/asgi.py`
- `app/router.py`
- `app/controllers/v1/video.py`
- `app/controllers/v1/llm.py`
- `pyproject.toml`
- `requirements.txt`

## Safest Install Route On This Machine

Preferred route: Docker CPU compose, because it bundles Linux FFmpeg and ImageMagick and keeps the app isolated.

Current reality: Docker CLI and Docker Compose are installed, but the Docker Desktop Linux engine is not running from this shell. Because of that, Docker cannot start the app right now.

Working route used today: Windows/manual setup with `uv`.

The default `python` on PATH is Python 3.14.3, which is outside the project's supported range. The project requires Python `>=3.11,<3.13`. `uv` already has CPython 3.11.15 installed, so `uv sync --frozen` is the safe manual route.

## Dependency Check

- Python default PATH: Python 3.14.3, not suitable for this project.
- `uv`: installed and usable.
- `uv` Python: CPython 3.11.15, suitable.
- FFmpeg: installed on PATH, version 8.1.1.
- ImageMagick: `magick` is not on PATH.
- Docker: installed, version 29.3.1.
- Docker Compose: installed, version v5.1.0.
- Docker daemon: not running; `docker info` cannot connect to `dockerDesktopLinuxEngine`.

## Setup Actions Completed

- Created `.venv` using `uv sync --frozen`.
- Used `C:\tmp\uv-cache-moneyprinterturbo` as the uv cache because both the default uv cache and a project-local cache hit Windows permission issues.
- Used Windows certificate store mode for uv dependency downloads.
- Copied `config.example.toml` to `config.toml`.
- Confirmed `/config.toml` is already gitignored.
- Added fixture/demo product data at `fixtures/crystalclawz_products.json`.
- Added prompt template at `templates/crystalclawz_video_prompt.md`.
- Started the API locally and verified `http://127.0.0.1:8080/docs` returned HTTP 200.
- Started the WebUI locally and verified `http://127.0.0.1:8501` returned HTTP 200.

## Configuration Notes

`config.toml` is local only and must stay out of git.

Do not paste real API keys into chat or committed files. Add keys only locally when needed, preferably through local environment variables or the ignored `config.toml`.

Minimum useful services for real generation:
- LLM provider key: OpenAI, Gemini, DeepSeek, Qwen, Azure OpenAI, AIHubMix, LiteLLM, Ollama, or another configured provider.
- Stock video source key: Pexels or Pixabay, unless using uploaded local nail product footage only.
- TTS: Edge TTS may work without an API key, but Azure Speech, Gemini TTS, or SiliconFlow TTS require keys depending on selected mode.
- Optional subtitle/transcription: faster-whisper can run locally, but may download models and is slower on CPU.

## What Works Now

- Repo is cloned locally and dependencies are installed.
- Local fixture product data exists.
- Crystal Clawz prompt template exists.
- Local `config.toml` exists and is ignored.
- API is running locally at `http://127.0.0.1:8080/docs`.
- WebUI is running locally at `http://127.0.0.1:8501`.
- API and WebUI entrypoints are identified:
  - WebUI: `uv run streamlit run ./webui/Main.py --browser.gatherUsageStats=False`
  - API: `uv run python main.py`
- API routes support local video material upload/listing and task output download/streaming.

## What Is Broken Or Blocked

- Docker route is blocked until Docker Desktop engine is running.
- Host ImageMagick is missing from PATH. This may matter for some subtitle/text rendering workflows on Windows.
- No real LLM, stock media, or paid TTS keys are configured.
- Live posting integrations are intentionally not connected.
- The API has no active auth dependency in the inspected router code, so keep it bound to localhost for proof-of-concept testing.

## n8n Fit

This can be connected to n8n later, but not yet. The safest later pattern is:

1. n8n reads approved product data.
2. n8n sends a local or private API request to MoneyPrinterTurbo.
3. MoneyPrinterTurbo writes video outputs to local `storage/tasks`.
4. n8n picks up completed output files and routes them to review or storage.
5. Posting to TikTok, Reels, YouTube Shorts, Shopify, or any live API stays behind a human approval gate.

Do not connect n8n to live Shopify, Xero, ERP, or posting APIs during this proof of concept.

## Google Drive Output

MoneyPrinterTurbo itself does not show a built-in Google Drive exporter in the inspected files. It writes generated videos under local `storage/tasks` and exposes API download/stream endpoints.

Google Drive output is still practical later through n8n or a separate upload script:
- Generate the video locally.
- Save or locate the final MP4 under `storage/tasks`.
- Upload the approved file to Google Drive through n8n or a Drive API step.

## Recommended Next Step

Start the API first and verify the local docs page loads. Then start the WebUI in a second shell.

Use fixture/demo products and local uploaded nail product footage before adding real keys or connecting any external workflow.
