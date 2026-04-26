# Skyes Over London LC — Music Forge Studio

Standalone one-app package.

## Included
- `index.html` — recording, import, extraction, timeline, beat forge, export UI
- `assets/logo.png` — local brand asset
- `netlify/functions/openai-audio-studio.js` — direct runtime for transcription, text assist, and synthetic readback
- `netlify.toml` — Netlify config and microphone permissions policy
- `.env.example` — environment template

## What this build does
- Records vocals directly in the browser
- Imports common audio files
- Imports video files and extracts their audio when the browser supports that format
- Transcribes selected clips
- Lets AI coach the take, punch up hooks, and write mix notes
- Builds a structured beat blueprint from the vocal text and notes
- Renders a playable synth beat clip inside the app
- Provides a visual waveform and arrangement timeline
- Exports the mix as WAV

## Deploy
1. Upload this folder to Netlify.
2. Add the environment variables from `.env.example`.
3. Open the site, allow microphone access, and start recording or importing files.

## Notes
- Client-facing branding stays Skyes Over London LC.
- Provider keys remain server-side only.
- AI voice playback is synthetic and should be disclosed when used publicly.
- Video audio extraction depends on the browser being able to decode and capture that uploaded video format locally.
