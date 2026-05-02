# ValleyVerified v2 Security And Compliance Notes

## Authentication

- All writes require a SkyGate bearer token.
- Tokens are verified with RS256.
- Expected audience defaults to `skygatefs13`.
- Production deployments must set `SKYGATE_PUBLIC_KEY_PEM` or `SKYGATE_JWKS_JSON`.

## Data Boundaries

ValleyVerified v2 stores four core record types:

- jobs
- contractors
- claims
- fulfillments

The current local implementation uses JSON state for proof and portability. Enterprise deployment can replace this with Neon without changing the network contract.

## PII

Potential PII fields:

- contractor name
- contractor email
- contractor phone
- company contact name
- company contact email
- company contact phone
- service area/location

Operational rules:

- Do not expose non-public contact fields on public board views.
- Restrict export/reporting to operator/admin roles.
- Keep contractor verification documents in the existing contractor income verification lane or a dedicated secure evidence store.

## Payment Scope

ValleyVerified v2 does not directly process bank card data. Payment and refund settlement belong to SkyeRoutex and provider webhooks.

## Enterprise Deployment Checklist

- Set SkyGate production JWKS/public key.
- Set JobPing messaging provider vars.
- Set SkyeRoutex payment provider vars.
- Move JSON state to Neon if multi-tenant production load requires durable queryable persistence.
- Add role-specific read filters before exposing contractor contact data publicly.
- Add per-tenant org IDs when onboarding multiple enterprise customers.
