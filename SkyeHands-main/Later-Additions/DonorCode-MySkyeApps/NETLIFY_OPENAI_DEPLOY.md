# Netlify Deploy — OpenAI Autonomous Editor

1. Run `schema.sql` in Neon.
2. Deploy this folder to Netlify.
3. Set at minimum:
   - `NEON_DATABASE_URL`
   - `APP_JWT_SECRET`
   - `APP_BASE_URL`
   - `ORIGIN_ALLOWLIST`
4. Optional fallback AI env vars:
   - `OPENAI_API_KEY`
   - `OPENAI_BASE_URL=https://api.openai.com`
   - `OPENAI_DEFAULT_MODEL=gpt-4o-mini`
   - `OPENAI_AGENT_MAX_STEPS=30`
5. Open the deployed app.
6. Sign in if you want the AI key stored encrypted to your org.
7. Open **AI Agent** and either:
   - paste your key and click **Save Cloud Settings**, or
   - paste your key and keep it local only.
8. Run the AI agent against the current project.

The AI route calls OpenAI from the Netlify function, not from the browser directly.
If you save the key to cloud settings, it is encrypted at rest using the app secret-derived AES-GCM lane already used for org secrets.
