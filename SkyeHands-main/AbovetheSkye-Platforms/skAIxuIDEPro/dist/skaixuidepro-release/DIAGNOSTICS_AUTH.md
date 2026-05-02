# SkAIxu Diagnostics — Password Gate Setup

The `/skAIxuide/diagnostics.html` page is locked behind a server-side password check.
Only people with the correct password can access the board.

---

## How It Works

When the diagnostics page loads, it shows a full-screen password prompt.
The password is sent to the **local dev server** (`/api/auth/diag`) which validates it
against environment variables — the password never lives in the browser or source code.

Authentication is cached per browser session (tab close = re-prompt).

---

## Setting Up Your Password

### Option 1 — `.env` file (recommended for local dev)

Create a `.env` file in the workspace root:

```
DIAGNOSTICS_PASSWORD=your-secret-password-here
```

Then load it before starting the server:

```bash
export $(cat .env | xargs) && npm start
```

Or use `dotenv-cli`:

```bash
npm install -g dotenv-cli
dotenv -- node server.js
```

### Option 2 — Export directly in terminal

```bash
export DIAGNOSTICS_PASSWORD=your-password && node server.js
```

---

## Adding More Passwords (multiple operator keys)

To let additional people in (e.g., trusted clients), add numbered env vars:

```
DIAGNOSTICS_PASSWORD=your-master-password
DIAGNOSTICS_PASSWORD_2=client-a-password
DIAGNOSTICS_PASSWORD_3=client-b-password
```

Each is checked in order. To **revoke** client access, just remove their env var and restart the server.
No code changes needed.

---

## Removing the Gate Entirely

If you ever want the diagnostics page to be public, set the env var to an empty string,
or remove the `diag-lock` div from `skAIxuide/diagnostics.html`.

---

## Deploy (Netlify)

Set `DIAGNOSTICS_PASSWORD` in your Netlify site's **Environment Variables** settings:
`Site Settings → Environment variables → Add variable`.

The server's `/api/auth/diag` route handles it server-side — safe and CORS-free.
