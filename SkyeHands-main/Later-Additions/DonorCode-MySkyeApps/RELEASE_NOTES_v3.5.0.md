# WebPile Pro Enterprise v3.5.0 — OpenAI Autonomous Netlify Build

## Added
- Direct OpenAI agent execution through Netlify Function `POST /api/ai/agent`
- Encrypted org-level AI settings route `GET/PUT /api/ai/settings`
- Project-level `settings_json` persistence in Neon-backed `projects` table
- AI Agent modal in the UI with:
  - local browser key storage
  - encrypted cloud key save/clear
  - model selection
  - autonomy step control
  - auto-apply toggle
  - project-aware prompt workflow
- Autonomous file tools:
  - list files
  - read file
  - search codebase
  - create file
  - update file
  - rename file
  - delete file

## Changed
- Cloud project create/load/save now persists project settings
- Build version updated to `3.5.0-openai-autonomous-netlify`
- `.env.example` expanded with OpenAI fallback variables
- README expanded with AI deployment/settings notes

## Verified
- `npm run check:syntax` passes
- `npm test` passes
- Extracted browser script from `index.html` passes `node --check`

## Deploy requirements
- `NEON_DATABASE_URL`
- `APP_JWT_SECRET`
- `APP_BASE_URL`
- `ORIGIN_ALLOWLIST`
- Optional AI fallback envs:
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `OPENAI_DEFAULT_MODEL`
  - `OPENAI_AGENT_MAX_STEPS`

## Notes
- The app now calls OpenAI directly from the Netlify Function layer, not through Kaixu/Gateway.
- The preferred user path is saving an OpenAI key in the AI Settings modal, either local-only or encrypted to the org.
- Live production smoke on Netlify still depends on your real deploy secrets and Neon schema rollout.
