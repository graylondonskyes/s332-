# Skye Reader Hardened — Deploy Guide

This app is a real Node/Express server with file uploads, local persistence, and server-side OpenAI calls.

## What this package is

- Runtime: Node 22
- Server: Express
- Storage: local `data/` folder on disk
- AI lane: `OPENAI_API_KEY` kept server-side
- Best fit hosts: Railway, Render, Fly.io, VPS, Docker hosts

## Important reality

This exact package is **not** a static drop. It needs a Node server and writable disk.

It is also **not** Worker-native as shipped. To run on Cloudflare Workers, it would need a platform rewrite for uploads, storage, and audio/file persistence.

## Fast local start

```bash
npm install
cp .env.example .env
# add OPENAI_API_KEY to .env
npm start
```

Open:

```bash
http://localhost:3000
```

Run smoke test in another terminal:

```bash
npm run smoke
```

## Environment variables

```bash
OPENAI_API_KEY=
PORT=3000
MAX_UPLOAD_MB=20
OCR_MODEL=gpt-4.1-mini
WEB_EXTRACT_TIMEOUT_MS=20000
```

## Railway deploy

1. Create a new Railway project.
2. Upload the repo or connect Git.
3. Set runtime to Node 22.
4. Add environment variables from `.env.example`, especially `OPENAI_API_KEY`.
5. Set the start command to:

```bash
npm start
```

6. Deploy.
7. After deploy, open the service URL and test `/api/health`.

## Render deploy

1. Create a new **Web Service**.
2. Connect the repo.
3. Runtime: Node.
4. Build command:

```bash
npm install
```

5. Start command:

```bash
npm start
```

6. Add the environment variables.
7. Deploy and test `/api/health`.

## VPS / Docker deploy

Build image:

```bash
docker build -t skye-reader-hardened .
```

Run container:

```bash
docker run -d \
  --name skye-reader-hardened \
  -p 3000:3000 \
  -e OPENAI_API_KEY=YOUR_KEY \
  -e PORT=3000 \
  skye-reader-hardened
```

Then open:

```bash
http://YOUR_SERVER_IP:3000
```

## Reverse proxy example notes

If you place it behind Nginx or Caddy, proxy all traffic to the Node app on port 3000.

## Production checks

After deploy, confirm:

```bash
/api/health
/api/config
```

Then test in UI:

- paste text and preview voice
- generate audio
- upload PDF or DOCX
- import a webpage URL
- save document to library
- add a pronunciation rule
- confirm audio download works

## Storage reality

The app stores data in local JSON and local folders:

- `data/store.json`
- `data/audio/`
- `data/uploads/`
- `data/voice-samples/`

For single-instance deployment this is fine.
For scaled or ephemeral hosting, move persistence to object storage + database.

## Security notes

- Keep `OPENAI_API_KEY` server-side only.
- Do not expose `.env`.
- Put the app behind HTTPS in production.
- If this will become customer-facing, add authentication before public release.
