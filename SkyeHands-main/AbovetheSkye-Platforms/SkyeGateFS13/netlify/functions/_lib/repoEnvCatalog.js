export const CANONICAL_ENV_TEMPLATE = "env.ultimate.template";

const OWNERSHIP = Object.freeze({
  gate: { owner: "Gate-owned", note: "Parent authority, billing, secrets, and shared control-plane state stay under operator control." },
  runtime: { owner: "Runtime-shell-only", note: "These vars wire the SkyeHands runtime control shell and launcher stack into the gate." },
  byo: { owner: "Customer BYO via sovereign vault", note: "Prefer vault-backed customer credentials when a tenant brings its own vendor account." },
  mixed: { owner: "Mixed", note: "Either gate-owned or customer BYO depending on whether the platform is using house lanes or isolated customer lanes." }
});

const REPO_ENV_SECTIONS = Object.freeze([
  {
    key: "gate-core",
    title: "Gate Core",
    ownership: OWNERSHIP.gate,
    vars: [
      "ADMIN_PASSWORD",
      "JWT_SECRET",
      "DB_ENCRYPTION_KEY",
      "KEY_PEPPER",
      "ALLOWED_ORIGINS",
      "PUBLIC_APP_ORIGIN",
      "SKYGATE_ISSUER",
      "DISABLE_ADMIN_PASSWORD_HEADER",
      "USER_SESSION_TTL_SECONDS",
      "CLIENT_ERROR_TOKEN",
      "JOB_WORKER_SECRET",
      "SKYGATE_EVENT_MIRROR_SECRET"
    ]
  },
  {
    key: "gate-bootstrap",
    title: "Gate Bootstrap / Mail Hooks",
    ownership: OWNERSHIP.gate,
    vars: [
      "ADMIN_EMAIL",
      "AUTH_EMAIL_WEBHOOK_URL"
    ]
  },
  {
    key: "database",
    title: "Database / Persistence",
    ownership: OWNERSHIP.gate,
    vars: ["NETLIFY_DATABASE_URL", "DATABASE_URL", "ASYNC_JOB_SUCCESS_RETENTION_DAYS", "ASYNC_JOB_RETENTION_DAYS"]
  },
  {
    key: "gate-policy",
    title: "Gate Policy / Pricing",
    ownership: OWNERSHIP.gate,
    vars: [
      "DEFAULT_RPM_LIMIT",
      "DEFAULT_CUSTOMER_CAP_CENTS",
      "CAP_WARN_PCT",
      "ALERT_WEBHOOK_URL",
      "SKYGATE_DEFAULT_CREDENTIAL_MODE",
      "SKYGATE_DEFAULT_BILLING_MODE",
      "SKYGATE_DEFAULT_USAGE_MODE",
      "SKYGATE_ALLOW_CUSTOMER_BYO_CREDENTIALS",
      "SKYGATE_ALLOW_PLATFORM_SHARED_TESTING",
      "SKYGATE_VENDOR_LEDGER_MODE"
    ]
  },
  {
    key: "runtime-bridges",
    title: "Runtime Bridges",
    ownership: OWNERSHIP.runtime,
    vars: [
      "SKYGATEFS13_ORIGIN",
      "SKYGATE_ORIGIN",
      "SKYGATE_AUTH_ORIGIN",
      "SKYGATEFS13_GATE_TOKEN",
      "SKYGATE_GATE_TOKEN",
      "SKYGATEFS13_GATE_MODEL",
      "SKYGATE_GATE_MODEL",
      "SKYGATE_SOURCE_APP",
      "SKYGATEFS13_EVENT_MIRROR_SECRET"
    ]
  },
  {
    key: "stage-runtime",
    title: "SkyeHands Runtime Control",
    ownership: OWNERSHIP.runtime,
    vars: [
      "SKYEQUANTA_RUNTIME_MODE",
      "SKYEQUANTA_HOST",
      "SKYEQUANTA_BRIDGE_PORT",
      "SKYEQUANTA_REMOTE_EXECUTOR_PORT",
      "SKYEQUANTA_IDE_PORT",
      "SKYEQUANTA_AGENT_PORT",
      "SKYEQUANTA_ADMIN_TOKEN",
      "SKYEQUANTA_GATE_URL",
      "SKYEQUANTA_GATE_TOKEN",
      "SKYEQUANTA_OSKEY",
      "SKYEQUANTA_GATE_MODEL",
      "SKYEQUANTA_PUBLIC_ORIGIN",
      "SKYEQUANTA_RUNTIME_CONTRACT_URL"
    ]
  },
  {
    key: "ai-vendors",
    title: "AI Vendors",
    ownership: OWNERSHIP.mixed,
    vars: [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_CLOUD_PROJECT_ID",
      "GOOGLE_CLOUD_REGION",
      "GOOGLE_APPLICATION_CREDENTIALS_JSON",
      "XAI_API_KEY",
      "GROQ_API_KEY",
      "OPENROUTER_API_KEY",
      "DEEPSEEK_API_KEY",
      "MISTRAL_API_KEY",
      "TOGETHER_API_KEY",
      "PERPLEXITY_API_KEY",
      "FIREWORKS_API_KEY",
      "COHERE_API_KEY",
      "REPLICATE_API_TOKEN",
      "AZURE_OPENAI_API_KEY",
      "AZURE_OPENAI_ENDPOINT",
      "AZURE_OPENAI_API_VERSION",
      "HUGGINGFACE_API_KEY",
      "MODAL_TOKEN_ID",
      "MODAL_TOKEN_SECRET"
    ]
  },
  {
    key: "vectors-rag",
    title: "Vectors / RAG",
    ownership: OWNERSHIP.mixed,
    vars: [
      "PINECONE_API_KEY",
      "PINECONE_INDEX",
      "PINECONE_HOST",
      "QDRANT_URL",
      "QDRANT_API_KEY",
      "QDRANT_COLLECTION",
      "WEAVIATE_URL",
      "WEAVIATE_API_KEY",
      "WEAVIATE_CLASS"
    ]
  },
  {
    key: "deploy-ops",
    title: "Deploy / Ops",
    ownership: OWNERSHIP.gate,
    vars: [
      "NETLIFY_AUTH_TOKEN",
      "PUSH_NETLIFY_MAX_DEPLOYS_PER_MIN",
      "PUSH_NETLIFY_MAX_DEPLOYS_PER_DAY",
      "PUSH_UPLOAD_INLINE_RETRIES",
      "PUSH_JOB_MAX_ATTEMPTS",
      "PUSH_JOB_RETRY_BASE_MS",
      "PUSH_JOB_RETRY_MAX_MS",
      "PUSH_CHUNK_RETENTION_HOURS",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
      "GITHUB_OAUTH_REDIRECT_URL",
      "GITHUB_API_BASE",
      "GITHUB_API_VERSION",
      "GITHUB_PUSH_MAX_FILES",
      "GITHUB_PUSH_MAX_TOTAL_BYTES",
      "GITHUB_PUSH_MAX_FILE_BYTES",
      "GITHUB_JOB_MAX_ATTEMPTS",
      "GITHUB_JOB_RETRY_BASE_MS",
      "GITHUB_JOB_RETRY_MAX_MS",
      "GITHUB_CHUNK_RETENTION_HOURS",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_ZONE_ID",
      "VERCEL_TOKEN",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      "RAILWAY_TOKEN",
      "RAILWAY_PROJECT_ID",
      "RAILWAY_ENVIRONMENT_ID",
      "RENDER_API_KEY",
      "RENDER_OWNER_ID",
      "RENDER_SERVICE_ID"
    ]
  },
  {
    key: "billing-commerce",
    title: "Billing / Commerce",
    ownership: OWNERSHIP.gate,
    vars: [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_CURRENCY",
      "STRIPE_SUCCESS_URL",
      "STRIPE_CANCEL_URL",
      "DEFAULT_RPM_LIMIT",
      "DEFAULT_CUSTOMER_CAP_CENTS",
      "CAP_WARN_PCT",
      "ALERT_WEBHOOK_URL"
    ]
  },
  {
    key: "communications",
    title: "Communications",
    ownership: OWNERSHIP.mixed,
    vars: [
      "MAIL_FROM",
      "SKYE_MAIL_FROM",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_SECURE",
      "RESEND_API_KEY",
      "RESEND_FROM",
      "RESEND_WEBHOOK_SECRET",
      "POSTMARK_SERVER_TOKEN",
      "SENDGRID_API_KEY",
      "MAILGUN_API_KEY",
      "MAILGUN_DOMAIN"
    ]
  },
  {
    key: "voice-speech",
    title: "Voice / Speech",
    ownership: OWNERSHIP.mixed,
    vars: [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "VOICE_FALLBACK_TRANSFER_NUMBER",
      "VOICE_AI_RELAY_USD_PER_MIN",
      "VOICE_TELEPHONY_USD_PER_MIN",
      "VOICE_RECORDING_USD_PER_MIN",
      "VOICE_MARKUP_PCT",
      "ELEVENLABS_API_KEY",
      "ELEVENLABS_VOICE_ID",
      "ASSEMBLYAI_API_KEY"
    ]
  },
  {
    key: "redis-cache",
    title: "Redis / Cache",
    ownership: OWNERSHIP.gate,
    vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]
  },
  {
    key: "platforms",
    title: "Platform / Child Apps",
    ownership: OWNERSHIP.runtime,
    vars: [
      "SUPERIDEV3_ORIGIN",
      "SKYEMAIL_FROM",
      "SKYEMAIL_WEBHOOK_SECRET",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ANON_KEY"
    ]
  }
]);

function detectConfigured(name) {
  return !!String(process.env[name] || "").trim();
}

export function getRepoEnvSections() {
  return REPO_ENV_SECTIONS.map((section) => ({
    ...section,
    canonical_template: CANONICAL_ENV_TEMPLATE,
    owner: section.ownership?.owner || "Unspecified",
    ownership_note: section.ownership?.note || "",
    vars: section.vars.map((name) => ({
      name,
      configured: detectConfigured(name)
    }))
  }));
}

export function getRepoEnvSummary() {
  const sections = getRepoEnvSections();
  const all = sections.flatMap((section) => section.vars);
  return {
    canonical_template: CANONICAL_ENV_TEMPLATE,
    sections: sections.length,
    total_vars: all.length,
    configured_vars: all.filter((entry) => entry.configured).length,
    missing_vars: all.filter((entry) => !entry.configured).length
  };
}
