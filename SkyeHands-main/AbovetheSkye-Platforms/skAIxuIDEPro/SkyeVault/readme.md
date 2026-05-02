# SkyePortal Vault — Control Plane (Netlify-ready)

This is your personal **one-stop shop** for:
- Firebase projects registry (dev/stage/prod)
- Versioned Firestore/Storage rules packs
- App identities (app_id / allowed origins)
- Env profiles (public env + encrypted private env stored inside the vault)
- Netlify Broker functions to mint short-lived scoped JWTs and deploy rules server-side via the Firebase Rules API

## 1) Deploy to Netlify
1. Create a new Netlify site from this folder (or drop it into your existing repo).
2. Set these **Netlify environment variables**:

### Required
- `VAULT_SIGNING_SECRET`  
  A long random string (32+ chars). Used to sign short-lived JWTs.

- `VAULT_APP_SECRETS`  
  JSON map of app IDs to secrets, e.g.
  ```json
  {
    "vault-ui": "CHANGE_ME_TO_A_LONG_SECRET",
    "skaixuide": "ANOTHER_LONG_SECRET"
  }
  ```

- `VAULT_GOOGLE_SA_JSON`  
  Your Google service account JSON as a single-line string.  
  This service account must have permission to manage Firebase Rules for the target project(s).
  Recommended role: **Firebase Admin** (or a least-privilege role that can update Firebase Rules releases).

### Optional
- `VAULT_TOKEN_TTL_SECONDS`  
  Default `300` (5 minutes). Shorter is safer.

- `VAULT_PUBLIC_CONFIG_JSON`  
  JSON map of app IDs to public config and endpoints:
  ```json
  {
    "vault-ui": {
      "public": { "FEATURE_FLAGS": "vault" },
      "endpoints": { "broker": "/.netlify/functions" }
    },
    "skaixuide": {
      "public": { "FIREBASE_PROJECT_ID": "my-project", "SOME_FLAG": "1" },
      "endpoints": { "broker": "https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions" }
    }
  }
  ```

## 2) Use the Vault UI
- Open the deployed site
- Choose **Initialize new vault** (first time)
- Create:
  - Projects
  - Rules Packs
  - Apps
  - Env Profiles
- In the **Broker tab**:
  - Set Broker URL to your site URL
  - Use app_id `vault-ui` and the secret you set in `VAULT_APP_SECRETS`
  - Mint token
  - Deploy rules packs to a chosen Firebase project

## 3) Security model (non-negotiable)
- The vault encrypts data locally; exports are encrypted blobs.
- The Broker never sends service account JSON to the browser.
- Apps should receive only non-secret config or short-lived tokens.

## 4) API endpoints (Broker)
- `POST /.netlify/functions/mint`
  - body: `{ app_id, app_secret, scopes: [] }`
  - returns: `{ token, expires_in }`

- `GET /.netlify/functions/config?app_id=...`
  - returns app-specific public config from `VAULT_PUBLIC_CONFIG_JSON`

- `POST /.netlify/functions/deployRules`
  - header: `Authorization: Bearer <token>`
  - scope required: `rules:deploy`
  - body: `{ projectId, firestoreRules, storageRules }`

## 5) Local dev
You can run this locally with Netlify CLI:
- `npm i -g netlify-cli`
- `netlify dev`

Set the same env vars locally (Netlify CLI will read a `.env` if you create one).
