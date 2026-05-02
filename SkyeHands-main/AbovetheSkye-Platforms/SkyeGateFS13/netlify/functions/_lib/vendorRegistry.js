const VENDORS = Object.freeze([
  {
    key: "openai",
    name: "OpenAI",
    category: "ai-model",
    env: ["OPENAI_API_KEY"],
    capabilities: ["chat", "stream", "embeddings"]
  },
  {
    key: "anthropic",
    name: "Anthropic",
    category: "ai-model",
    env: ["ANTHROPIC_API_KEY"],
    capabilities: ["chat", "stream"]
  },
  {
    key: "gemini",
    name: "Google Gemini",
    category: "ai-model",
    env: ["GEMINI_API_KEY"],
    capabilities: ["chat", "stream", "embeddings"]
  },
  {
    key: "google-cloud",
    name: "Google Cloud",
    category: "cloud-platform",
    env: ["GOOGLE_CLOUD_PROJECT_ID", "GOOGLE_CLOUD_REGION", "GOOGLE_APPLICATION_CREDENTIALS_JSON"],
    capabilities: ["cloud-hosting", "vertex-ai", "storage", "pubsub"]
  },
  {
    key: "firebase",
    name: "Firebase",
    category: "backend-platform",
    env: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
    capabilities: ["auth", "firestore", "storage", "hosting"]
  },
  {
    key: "xai",
    name: "xAI",
    category: "ai-model",
    env: ["XAI_API_KEY"],
    capabilities: ["chat", "reasoning"]
  },
  {
    key: "groq",
    name: "Groq",
    category: "ai-model",
    env: ["GROQ_API_KEY"],
    capabilities: ["chat", "fast-inference"]
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    category: "ai-router",
    env: ["OPENROUTER_API_KEY"],
    capabilities: ["routing", "chat"]
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    category: "ai-model",
    env: ["DEEPSEEK_API_KEY"],
    capabilities: ["chat", "reasoning"]
  },
  {
    key: "mistral",
    name: "Mistral",
    category: "ai-model",
    env: ["MISTRAL_API_KEY"],
    capabilities: ["chat", "embeddings"]
  },
  {
    key: "together",
    name: "Together",
    category: "ai-router",
    env: ["TOGETHER_API_KEY"],
    capabilities: ["chat", "inference-hosting"]
  },
  {
    key: "perplexity",
    name: "Perplexity",
    category: "ai-model",
    env: ["PERPLEXITY_API_KEY"],
    capabilities: ["chat", "search"]
  },
  {
    key: "fireworks",
    name: "Fireworks",
    category: "ai-router",
    env: ["FIREWORKS_API_KEY"],
    capabilities: ["chat", "inference-hosting"]
  },
  {
    key: "cohere",
    name: "Cohere",
    category: "ai-model",
    env: ["COHERE_API_KEY"],
    capabilities: ["chat", "embeddings", "rerank"]
  },
  {
    key: "replicate",
    name: "Replicate",
    category: "model-hosting",
    env: ["REPLICATE_API_TOKEN"],
    capabilities: ["image", "video", "model-hosting"]
  },
  {
    key: "azure-openai",
    name: "Azure OpenAI",
    category: "ai-platform",
    env: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
    capabilities: ["chat", "embeddings", "enterprise-hosting"]
  },
  {
    key: "github",
    name: "GitHub",
    category: "source-control",
    env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_OAUTH_REDIRECT_URL"],
    capabilities: ["oauth", "repo-push", "code-hosting"]
  },
  {
    key: "netlify",
    name: "Netlify",
    category: "deployment",
    env: ["NETLIFY_AUTH_TOKEN"],
    capabilities: ["deploy", "hosting", "db-attach"]
  },
  {
    key: "stripe",
    name: "Stripe",
    category: "payments",
    env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    capabilities: ["checkout", "billing", "topups"]
  },
  {
    key: "twilio",
    name: "Twilio",
    category: "communications",
    env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    capabilities: ["voice", "webhooks"]
  },
  {
    key: "resend",
    name: "Resend",
    category: "communications",
    env: ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "RESEND_FROM"],
    capabilities: ["email", "inbound-webhooks"]
  },
  {
    key: "postmark",
    name: "Postmark",
    category: "communications",
    env: ["POSTMARK_SERVER_TOKEN"],
    capabilities: ["email"]
  },
  {
    key: "sendgrid",
    name: "SendGrid",
    category: "communications",
    env: ["SENDGRID_API_KEY"],
    capabilities: ["email"]
  },
  {
    key: "mailgun",
    name: "Mailgun",
    category: "communications",
    env: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"],
    capabilities: ["email"]
  },
  {
    key: "smtp",
    name: "SMTP",
    category: "communications",
    env: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
    capabilities: ["email"]
  },
  {
    key: "upstash",
    name: "Upstash Redis",
    category: "infrastructure",
    env: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    capabilities: ["rate-limits", "cache"]
  },
  {
    key: "neon",
    name: "Neon / Netlify DB",
    category: "infrastructure",
    env: ["NETLIFY_DATABASE_URL", "DATABASE_URL"],
    capabilities: ["postgres", "state", "ledger"]
  },
  {
    key: "cloudflare",
    name: "Cloudflare",
    category: "edge-platform",
    env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID"],
    capabilities: ["workers", "dns", "r2", "pages"]
  },
  {
    key: "vercel",
    name: "Vercel",
    category: "deployment",
    env: ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"],
    capabilities: ["deploy", "preview", "hosting"]
  },
  {
    key: "railway",
    name: "Railway",
    category: "deployment",
    env: ["RAILWAY_TOKEN", "RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID"],
    capabilities: ["deploy", "services", "databases"]
  },
  {
    key: "render",
    name: "Render",
    category: "deployment",
    env: ["RENDER_API_KEY", "RENDER_OWNER_ID", "RENDER_SERVICE_ID"],
    capabilities: ["deploy", "preview", "services"]
  },
  {
    key: "supabase",
    name: "Supabase",
    category: "backend-platform",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"],
    capabilities: ["postgres", "auth", "storage", "edge-functions"]
  },
  {
    key: "pinecone",
    name: "Pinecone",
    category: "vector-database",
    env: ["PINECONE_API_KEY", "PINECONE_INDEX", "PINECONE_HOST"],
    capabilities: ["vector-search", "rag", "embeddings"]
  },
  {
    key: "qdrant",
    name: "Qdrant",
    category: "vector-database",
    env: ["QDRANT_URL", "QDRANT_API_KEY", "QDRANT_COLLECTION"],
    capabilities: ["vector-search", "rag"]
  },
  {
    key: "weaviate",
    name: "Weaviate",
    category: "vector-database",
    env: ["WEAVIATE_URL", "WEAVIATE_API_KEY", "WEAVIATE_CLASS"],
    capabilities: ["vector-search", "rag"]
  },
  {
    key: "elevenlabs",
    name: "ElevenLabs",
    category: "voice-ai",
    env: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
    capabilities: ["tts", "voice-cloning"]
  },
  {
    key: "assemblyai",
    name: "AssemblyAI",
    category: "speech-ai",
    env: ["ASSEMBLYAI_API_KEY"],
    capabilities: ["transcription", "speech-to-text"]
  },
  {
    key: "huggingface",
    name: "Hugging Face",
    category: "model-platform",
    env: ["HUGGINGFACE_API_KEY"],
    capabilities: ["inference", "models", "datasets"]
  },
  {
    key: "modal",
    name: "Modal",
    category: "compute-platform",
    env: ["MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET"],
    capabilities: ["gpu-jobs", "serverless-compute"]
  }
]);

export function getVendorCatalog() {
  return VENDORS.map((vendor) => {
    const envStatus = vendor.env.map((name) => ({
      name,
      present: !!String(process.env[name] || "").trim()
    }));
    const configured = envStatus.some((entry) => entry.present);
    return {
      ...vendor,
      configured,
      env_status: envStatus
    };
  });
}

export function getVendorCatalogMap() {
  const map = new Map();
  for (const vendor of getVendorCatalog()) map.set(vendor.key, vendor);
  return map;
}

export function vendorSummary() {
  const vendors = getVendorCatalog();
  return {
    total: vendors.length,
    configured: vendors.filter((vendor) => vendor.configured).length,
    missing: vendors.filter((vendor) => !vendor.configured).length,
    by_category: vendors.reduce((acc, vendor) => {
      const current = acc[vendor.category] || { total: 0, configured: 0 };
      current.total += 1;
      if (vendor.configured) current.configured += 1;
      acc[vendor.category] = current;
      return acc;
    }, {})
  };
}
