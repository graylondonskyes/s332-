# Autonomous Company Mesh

This folder is the organized source home for AboveTheSkye platform/app surfaces that SkyeHands launches or coordinates.

## Company Flow Proof

The cross-platform proof is:

```bash
cd ../skyehands_runtime_control
npm run smoke:company-flow
```

It proves a restaurant onboarding flow can fan out across the platform bus:

- `merchant.onboarded` reaches Lead Vault, Appointment Setter, Maggie's Store, and Workforce Command.
- `lead.generated` reaches Lead Vault and Appointment Setter.
- `ae.requested` reaches AE CommandHub.
- `webcreator.project.requested` reaches SkyDexia through SkyeWebCreatorMax.
- `storefront.requested` reaches SkyDexia and Maggie's Store.
- `webcreator.project.generated`, `app.generated`, and `webcreator.delivery.queued` close the generated storefront handoff.
- `commerce.product.created` and `commerce.order.created` reach Maggie's Store, with order context also visible to SkyeRoutex.
- `workforce.job.posted` reaches SkyeRoutex Workforce Command.
- `dispatch.requested` reaches both SkyeRoutex and SkyeRoutex Workforce Command.

The latest proof artifact is written to:

```txt
../skyehands_runtime_control/.skyequanta/proofs/autonomous-company-flow-smoke.json
```

## Creator IDE Mesh Proof

The creator/build proof is:

```bash
cd ../skyehands_runtime_control
npm run smoke:creator-ide-mesh
```

It proves skAIxu IDE Pro, SuperIDEv2, SuperIDEv3, SkyeWebCreatorMax, SkyDexia, SkyeForgeMax, and AE CommandHub can coordinate a creator-owned platform build:

- `ide.project.created` reaches all IDEs plus planning/build platforms.
- `ide.agent.requested` reaches AE CommandHub and SkyDexia.
- `webcreator.project.requested` reaches SkyDexia through SkyeWebCreatorMax.
- `app.generated` is broadcast back through the platform mesh so AE CommandHub, SuperIDEv2, SuperIDEv3, and skAIxu IDE Pro all receive the generated artifact signal.
- `ide.release.packaged` reaches the release/build surfaces.

The latest proof artifact is written to:

```txt
../skyehands_runtime_control/.skyequanta/proofs/creator-ide-mesh-smoke.json
```

## Organized Platform Sources

Active SkyeHands platform sources now live under `AbovetheSkye-Platforms`, including the registry-backed sources for Appointment Setter, JobPing, Maggie's Store, SkyDexia, SkyeLeadVault, SkyeMediaCenter, SkyeMusicNexus, SkyeForgeMax, SkyeRoutex, ValleyVerified, SkyeRoutex Workforce Command, SuperIDEv2, SuperIDEv3.8, and skAIxu IDE Pro.
