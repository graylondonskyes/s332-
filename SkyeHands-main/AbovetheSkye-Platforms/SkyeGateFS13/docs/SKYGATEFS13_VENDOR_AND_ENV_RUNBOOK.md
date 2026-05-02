# SkyeGateFS13 Vendor And Env Runbook

`SkyeGateFS13` is the parent gate for:
- auth and identity
- vendor routing
- sovereign variables
- usage metering
- billing and top-ups
- GitHub and Netlify pushes
- enterprise operations monitoring

## Deployment sheet

Use:
- baseline: `env.template`
- full matrix: `env.ultimate.template`

The ultimate template is the canonical file when you want one place to stage:
- gate-owned vendor credentials
- billing configuration
- push/deploy configuration
- consumer bridge origins
- app-adjacent mail and voice providers

## Credential model

There are three intended modes:

1. `platform-shared`
- The gate owns the credential.
- Clients can test or build through the gate without setting up their own provider first.
- Usage is still metered and can still be billed.

2. `customer-owned`
- The customer imports their own credential into the sovereign vault.
- Traffic still routes through the gate for clearance, audit, and charging posture.

3. `hybrid-metered`
- The gate may supply shared credentials for testing or fallback.
- A customer can graduate to their own credential later without leaving the gate.

## Where secrets belong

Use env vars when:
- the gate itself must own a shared house credential
- the credential is global to the deployment

Use sovereign variables when:
- the credential belongs to a customer, user, app, or workspace
- you need scope-aware secret ownership
- you want to preserve a gate-level audit trail while supporting BYO credentials

## Admin surfaces

Use:
- `/.netlify/functions/admin-vendors`
- `/.netlify/functions/admin-sovereign-variables`
- `/.netlify/functions/platform-event-ingest` or `/platform/events`

The dashboard tab `Vendors & Sovereign Vault` is the operator UI for these routes.

For parent event mirroring from child apps:
- set `SKYGATE_EVENT_MIRROR_SECRET` on the gate
- set the same secret in the child app runtime
- have the child app post mirrored audit events to `/platform/events`

## Operational goal

Each platform can keep local product state. But privileged access should route through `SkyeGateFS13` so the parent gate can:
- approve access
- track vendor usage
- apply policy
- charge for shared testing or live production usage
