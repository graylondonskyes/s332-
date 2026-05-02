# Seven-Zip Integration Workspace

This workspace contains the seven audited donor archives unpacked into isolated lanes. Nothing here is live platform code yet.

## Unpacked Donors

| Donor | Unpacked Path | Platform Family |
| --- | --- | --- |
| Artificial Sole API | `seven-zips-unpacked/artificial-sole-api/artificial-sole-api-main` | Role Assistant concept |
| Dead Route Detector | `seven-zips-unpacked/dead-route-detector/dead-route-detector-skyevsx-product` | Quality Gate Platform |
| FunnelSystem | `seven-zips-unpacked/funnel-system/FunnelSystem-main` | Intake Funnel rebuild donor |
| GrayScape SuperApp | `seven-zips-unpacked/grayscape-superapp` | House Command UI donor |
| Skye GEO Engine | `seven-zips-unpacked/skye-geo-engine/skye-geo-engine-starter-v20` | AE Central growth engine |
| Valuation Certification | `seven-zips-unpacked/valuation-certification/skyehands-valuation-certification-system` | Valuation Certification Platform |
| Sovereign Variables | `seven-zips-unpacked/sovereign-variables/sovereign-variables-main` | Sovereign Primitives |

## Registry

See `platform-family-registry.json` for the canonical placement map and guardrails.

## Integration Rule

Do not copy donor code directly into live platform folders until it has:

1. a platform family assignment,
2. a SkyeHands backend contract,
3. an auth/workspace/persistence plan,
4. a smoke or proof path,
5. a claim label that matches what the code actually proves.

