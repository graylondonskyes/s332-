# ENV Ultimate Readable Guide

This is the human-readable companion to [env.ultimate.template](./env.ultimate.template).

Use this file when you want:
- plain-English descriptions of what each env section is for
- official provider signup or console links
- a cleaner onboarding sheet for operators, customers, or teammates

Do **not** paste secrets into this file. Keep actual values in `env.ultimate.template` or in the gate's sovereign vault.

## Canonical Rule

- Canonical machine-oriented env contract: [env.ultimate.template](./env.ultimate.template)
- Human-readable guide: `ENV_ULTIMATE_READABLE.md`

## Core Identity / Auth / Origin

These vars define the parent gate identity, JWT/session signing, encryption, and browser/API origins.

- `ADMIN_PASSWORD`: admin dashboard login secret
- `JWT_SECRET`: JWT signing base secret
- `DB_ENCRYPTION_KEY`: encryption root for stored secrets
- `KEY_PEPPER`: extra secret for key-hash hardening
- `ALLOWED_ORIGINS`: CORS allowlist
- `PUBLIC_APP_ORIGIN`: public browser origin for redirects and checkout callbacks
- `SKYGATE_ISSUER`: explicit issuer URL if you do not want request-derived issuer logic

## Ownership Matrix

Use this table to decide who should normally own each env group.

| Env group | Typical owner | Why |
|---|---|---|
| Core identity / auth / origin | Gate-owned | These define the parent authority and should stay under operator control. |
| Database / persistence | Gate-owned | The gate is the parent ledger and should own its main state plane. |
| Runtime control shell | Runtime-shell-only | These wire the SkyeHands runtime control shell, bridge, Theia, and OpenHands lanes into the gate. |
| Shared AI vendors | Gate-owned by default | Best when the gate is providing the house lane, metering usage, and enforcing policy. |
| Customer AI credentials | Customer BYO via sovereign vault | Use when the customer brings their own vendor account but still routes through the gate for approval, tracking, and billing. |
| Vector / RAG vendors | Gate-owned or customer BYO | Depends on whether embeddings/search are house-managed or customer-managed. |
| Push / deploy vendors | Gate-owned for managed delivery | Best when the gate is acting as the parent deploy and source-control authority. |
| Billing / commerce | Gate-owned | Parent payment and charging lanes should remain centralized. |
| Communications / mail | Gate-owned or platform-specific | House mail goes in env; customer-owned mail should usually live in the vault. |
| Voice / speech | Gate-owned or customer BYO | Telephony often stays centralized; premium voice vendors may be customer-provided. |
| Cache / infra extras | Gate-owned | Shared infra should be under operator control. |
| Child-platform bridge vars | Runtime-shell-only or platform-specific | These are integration lanes, not customer-owned product creds. |

## Runtime Control Shell

These vars connect the parent gate to the SkyeHands runtime control shell and the modified Theia / OpenHands launch stack.

- `SKYGATEFS13_ORIGIN`
- `SKYGATEFS13_GATE_TOKEN`
- `SKYGATEFS13_GATE_MODEL`
- `SKYGATE_EVENT_MIRROR_SECRET`
- `SKYEQUANTA_*` bridge / runtime vars

## Vendor Signup / Console Links

The table below maps every gate-tracked vendor env family in `env.ultimate.template` to an official signup, console, or product-entry URL.

| Vendor | Main env family | Official link |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com/signup |
| Anthropic | `ANTHROPIC_API_KEY` | https://platform.claude.com/ |
| Google AI Studio / Gemini | `GEMINI_API_KEY` | https://aistudio.google.com/welcome |
| Google Cloud | `GOOGLE_CLOUD_*` | https://console.cloud.google.com/ |
| Firebase | `FIREBASE_*` | https://firebase.google.com/ |
| Azure OpenAI | `AZURE_OPENAI_*` | https://azure.microsoft.com/en-us/products/ai-foundry/models/openai/ |
| xAI | `XAI_API_KEY` | https://x.ai/api |
| Groq | `GROQ_API_KEY` | https://console.groq.com/home |
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai/ |
| DeepSeek | `DEEPSEEK_API_KEY` | https://platform.deepseek.com/ |
| Mistral | `MISTRAL_API_KEY` | https://console.mistral.ai/ |
| Together | `TOGETHER_API_KEY` | https://api.together.xyz/ |
| Perplexity | `PERPLEXITY_API_KEY` | https://www.perplexity.ai/hub/blog/introducing-pplx-api |
| Fireworks | `FIREWORKS_API_KEY` | https://fireworks.ai/ |
| Cohere | `COHERE_API_KEY` | https://dashboard.cohere.com/ |
| Replicate | `REPLICATE_API_TOKEN` | https://replicate.com/ |
| Hugging Face | `HUGGINGFACE_API_KEY` | https://huggingface.co/join |
| Modal | `MODAL_TOKEN_*` | https://modal.com/signup |
| Neon / Netlify DB | `NETLIFY_DATABASE_URL`, `DATABASE_URL` | https://neon.com/ |
| Pinecone | `PINECONE_*` | https://www.pinecone.io/ |
| Qdrant | `QDRANT_*` | https://cloud.qdrant.io/ |
| Weaviate | `WEAVIATE_*` | https://console.weaviate.cloud/ |
| Netlify | `NETLIFY_AUTH_TOKEN` | https://app.netlify.com/ |
| GitHub | `GITHUB_*` | https://github.com/signup |
| Cloudflare | `CLOUDFLARE_*` | https://dash.cloudflare.com/sign-up |
| Vercel | `VERCEL_*` | https://vercel.com/signup |
| Railway | `RAILWAY_*` | https://railway.com/ |
| Render | `RENDER_*` | https://dashboard.render.com/register |
| Stripe | `STRIPE_*` | https://dashboard.stripe.com/register |
| Twilio | `TWILIO_*` | https://www.twilio.com/try-twilio |
| ElevenLabs | `ELEVENLABS_*` | https://elevenlabs.io/sign-up |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | https://www.assemblyai.com/dashboard/signup |
| Resend | `RESEND_*` | https://resend.com/signup |
| Postmark | `POSTMARK_SERVER_TOKEN` | https://postmarkapp.com/ |
| SendGrid | `SENDGRID_API_KEY` | https://signup.sendgrid.com/ |
| Mailgun | `MAILGUN_*` | https://www.mailgun.com/ |
| SMTP | `SMTP_*` | Use your mail host’s control panel or provider signup page. |
| Supabase | `SUPABASE_*` | https://supabase.com/dashboard/sign-up |
| Upstash | `UPSTASH_*` | https://console.upstash.com/ |

## Vendor Ownership Notes

Use this table when deciding whether a vendor should live as a house credential in `env.ultimate.template` or as a customer-provided credential in the sovereign vault.

| Vendor group | Default ownership posture |
|---|---|
| OpenAI / Anthropic / Gemini / Azure OpenAI / xAI / Groq / DeepSeek / Mistral / Together / Perplexity / Fireworks / Cohere / OpenRouter | Gate-owned by default for shared metered lanes; customer BYO supported via sovereign vault |
| Google Cloud / Firebase / Supabase / Neon / Upstash | Gate-owned for parent infrastructure; customer BYO only when isolating a customer’s own stack |
| Pinecone / Qdrant / Weaviate | Gate-owned for house RAG, customer BYO for customer-isolated vector stacks |
| Netlify / GitHub / Cloudflare / Vercel / Railway / Render | Gate-owned when SkyeGate is acting as deploy and push parent |
| Stripe | Gate-owned |
| Twilio / ElevenLabs / AssemblyAI / SMTP / Resend / Postmark / SendGrid / Mailgun | Gate-owned for house comms, customer BYO when they need their own brand/account lane |
| Replicate / Hugging Face / Modal | Gate-owned for managed experiments and house execution, customer BYO for isolated compute spend |

## Billing / Payments

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

Use Stripe if the gate should own the payment lane. Customer-owned billing contexts can still be modeled in the sovereign vault, but the parent gate should keep the metering record.

## Communications / Mail

- SMTP is the neutral fallback lane.
- Resend, Postmark, SendGrid, and Mailgun are all modeled as vendor-tracked outbound mail options.

## Voice / Speech

- Twilio is the telephony edge.
- ElevenLabs and AssemblyAI are optional AI voice/speech companions.

## Operational Advice

- Put house credentials in `env.ultimate.template` only when the parent gate should provide and meter them.
- Put customer-owned secrets into the sovereign vault when the customer is bringing their own vendor account.
- Keep provider onboarding, metering, and credential posture visible in the gate dashboards.
