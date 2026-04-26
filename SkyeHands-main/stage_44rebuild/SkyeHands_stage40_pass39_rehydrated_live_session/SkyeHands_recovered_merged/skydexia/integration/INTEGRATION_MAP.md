# SkyDexia Integration Map

Generated: 2026-04-16T12:40:10.218Z

## Systems
- **CDE**: directive validation, release gating, smoke accounting.
- **AE**: runtime handlers + appointment/commerce/provider resilience smoke suites.
- **SkyDexia**: donor ingestion, normalization, template spinup, knowledge updates.
- **Route Flow**: provider contract checks, generated project smoke commands, alert delivery.

## Linkages
1. CDE -> AE: CDE release gate runs directive validator which includes AE smoke artifacts.
2. AE -> SkyDexia: AE/provider contracts are consumed by SkyDexia provider proof harness.
3. SkyDexia -> Route Flow: donor smoke suites invoke generated project route smoke scripts.
4. Route Flow -> CDE: execution artifacts feed back into release notes and directive completion.

## Evidence Paths
- Directive: `ULTIMATE_SYSTEM_DIRECTIVE.md`
- Release Notes: `DIRECTIVE_RELEASE_NOTES.md`
- Provider Contract: `skydexia/providers/provider-var-contract.json`
- Alerts: `skydexia/alerts/*.json`
