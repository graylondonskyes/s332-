# ValleyVerified v2

ValleyVerified v2 is the parent procurement and fulfillment platform for the SkyeHands business network. It connects company job intake, contractor onboarding, AE Flow dispatch, JobPing alerts, SkyeRoutex routing, SkyGate authorization, and SkyeCard-backed commerce into one operator surface.

## Enterprise Role

- Company-side job posting and procurement intake
- Contractor onboarding, eligibility, and claim routing
- AE contractor dispatch and fulfillment closeout
- SkyeRoutex adapter contract for cross-platform orchestration
- SkyGate bearer authentication for every write operation
- Public read endpoints for board/listing surfaces

## Runtime Surface

The platform is intentionally deployable as its own Netlify site while still registering into the wider SkyeHands launchpad proof.

- Public app: `index.html`
- Functions: `netlify/functions`
- Job intake API: `/.netlify/functions/valley-jobs`
- Contractor API: `/.netlify/functions/valley-contractors`
- Claim API: `/.netlify/functions/valley-claims`
- Fulfillment API: `/.netlify/functions/valley-fulfillment`

## Local Verification

Run from this folder:

```bash
npm run check:functions
npm run smoke:browser
npm run smoke:local
npm run smoke
```

Run from `SkyeHands-main/Dynasty-Versions` to verify ecosystem registration:

```bash
node apps/skyequanta-shell/bin/workspace-proof-section61-platform-launchpad.mjs
./skyequanta doctor --mode deploy --probe-active
```

## Provider Boundary

Code is complete for local enterprise proof. The only expected deployment-time gap is live provider configuration:

- SkyGate signing/JWKS material
- Stripe and PayPal credentials
- Production data path or managed persistence
- Notification providers for external dispatch

Those values should be injected at deployment time, not hard-coded in the platform.

## Proof Notes

`npm run smoke:browser` drives a real local browser across operator login, job posting, contractor onboarding, claim, and fulfillment. `npm run smoke:local` includes the direct-function proof plus that browser lane when Playwright and the repo browser bundle are available. Neither command claims deployed SkyGate/provider execution by itself.
