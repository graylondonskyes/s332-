## netlify.toml
[build]
  command = "echo 'No build step required'"
  publish = "."
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
  included_files = ["netlify/functions/**"]

[[redirects]]
  from = "/share/:token"
  to = "https://reports.codefloor.io/:token"
  status = 302
  force = true

[[redirects]]
  from = "/.netlify/functions/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[dev]
  command = "python3 -m http.server 8888"
  port = 8888
  targetPort = 8888

---
## wrangler.toml (save as wrangler.toml in /worker/)
name = "codefloor-share"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
API_BASE = "https://your-site.netlify.app"

[[r2_buckets]]
binding = "EVIDENCE_BUCKET"
bucket_name = "codefloor-evidence"

---
## netlify/functions/package.json
{
  "name": "codefloor-functions",
  "type": "module",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "@neondatabase/serverless": "^0.9.4",
    "jwt-decode": "^4.0.0",
    "resend": "^3.5.0"
  }
}

---
## .env.example
# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/codefloor?sslmode=require

# Cloudflare R2
CF_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET=codefloor-evidence

# Resend (email)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_DOMAIN=codefloor.io

# App
SITE_URL=https://codefloor.io
ALLOWED_ORIGIN=https://codefloor.io

# Stripe (when you're ready)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

---
## README.md

# CodeFloor

**Devil's-advocate code-floor valuation for software platforms.**

No ARR multiples. No hype premiums. Proof-backed. Built for founders.

## Stack
- Frontend: Vanilla JS, Netlify Identity
- API: Netlify Functions (Node/ESM)
- Database: Neon PostgreSQL
- Storage: Cloudflare R2 (evidence files)
- Email: Resend
- Share CDN: Cloudflare Worker

## Deploy

### 1. Neon database
```bash
# Create a Neon project at neon.tech
# Copy connection string
# Run schema:
psql $DATABASE_URL < schema.sql
```

### 2. Cloudflare R2
```bash
# Create bucket in Cloudflare dashboard: codefloor-evidence
# Create R2 API token with read+write on bucket
# Copy Access Key ID and Secret
```

### 3. Resend
```bash
# Sign up at resend.com
# Verify your domain
# Create API key
```

### 4. Netlify
```bash
# Connect GitHub repo to Netlify
# Set environment variables in Netlify UI (copy from .env.example)
# Enable Identity: Site Settings → Identity → Enable
# Add Identity webhook:
#   Settings → Identity → Events → Registration → /.netlify/functions/identity-signup
```

### 5. Cloudflare Worker (share links)
```bash
cd worker
npm install -g wrangler
wrangler login
# Edit wrangler.toml: set API_BASE to your Netlify URL
wrangler deploy
# Add custom domain: reports.codefloor.io → worker
```

## Pricing tiers (implement with Stripe)
- **Solo** $49/mo — 10 projects, PDF export, share links
- **Pro** $149/mo — unlimited projects, team (5 seats), evidence uploads
- **Agency** $399/mo — white-label, unlimited, priority support

## Methodology
A section earns its value only when:
1. Code exists
2. Runtime path exists
3. Hostile/failure path exists
4. Proof artifact passes
5. Claim stays blank until all four above

No exceptions. Open items stay disclosed, never hidden.
