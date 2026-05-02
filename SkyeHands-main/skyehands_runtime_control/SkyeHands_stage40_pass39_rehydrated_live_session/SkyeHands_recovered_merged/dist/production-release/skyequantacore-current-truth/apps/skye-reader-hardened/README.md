# Skye Reader Hardened

A real full-stack reader app inspired by the NaturalReader web experience, but built as a self-hosted Node application.

## What is actually implemented

- Paste or type text and generate audio
- Import webpages by URL and extract readable article text
- Upload and parse TXT, MD, HTML, PDF, DOCX, EPUB, and image files
- OCR images with OpenAI vision
- Attempt OCR / scan-to-text for PDFs when direct extraction is weak and an API key is configured
- Generate downloadable speech audio with OpenAI `/v1/audio/speech`
- Use built-in OpenAI voices or custom voice IDs
- Upload voice consent recordings
- Create custom cloned voices through OpenAI `/v1/audio/voices`
- Save documents to a local library
- Save generated audio to a local audio history
- Add pronunciation replacement rules that apply before speech generation
- Voice preview lane
- Sleep timer and local playback controls
- Smoke test script for core API checks

## Stack

- Node.js + Express
- OpenAI API for TTS, OCR, and custom voices
- Mammoth for DOCX extraction
- pdf-parse for searchable PDF extraction
- Readability + JSDOM for webpage extraction
- epub2 for EPUB extraction
- Local JSON persistence in `data/store.json`

## Branding update

This build now includes two floating, glowing, pulsing transparent logos with no container:

- `public/assets/sol-memory-logo.png`
- `public/assets/sol-user-logo.png`

## Start

```bash
npm install
cp .env.example .env
npm start
```

Open:

```bash
http://localhost:3000
```

## Environment

```bash
OPENAI_API_KEY=
PORT=3000
MAX_UPLOAD_MB=20
OCR_MODEL=gpt-4.1-mini
WEB_EXTRACT_TIMEOUT_MS=20000
```

## Smoke test

Start the server first, then run:

```bash
npm run smoke
```

The smoke script checks:

- `/api/health`
- `/api/config`
- create pronunciation rule
- create library document
- fetch library
- cleanup created records

If `OPENAI_API_KEY` is configured and you want to add a live voice test, you can extend `scripts/smoke.mjs` to hit `/api/tts/preview` or `/api/tts/speak`.

## Notes

- Built-in OpenAI speech currently has a 4096-character request limit on the speech endpoint, so this app chunks long texts and stitches the returned MP3 or audio format buffers together on the server side. The chunking is real; it is not a fake UI wrapper.
- Searchable PDFs extract directly. Image-only PDFs may need OCR. This build attempts OCR through the model when enabled, but some scanned PDFs may still work better when pages are exported as images first.
- Custom voices depend on OpenAI account access to voice consent and voice creation endpoints.
- API keys stay on the server only.


## Deploy guide

See `DEPLOY-GUIDE.md` for local, Docker, Railway, Render, and production notes.
