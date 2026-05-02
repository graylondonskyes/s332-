# SkyDexia Canonical Architecture & Runtime Boundaries

## Authority
SkyDexia is the orchestrator authority for SkyeHands runtime composition.

## Runtime Layers
1. **Orchestration Plane (SkyDexia)**
   - Capability registry resolution
   - Policy validation
   - Build/runtime plan generation
2. **Execution Plane (CDE + AE + Route)**
   - CDE lifecycle jobs
   - AE command runtime operations
   - Route/CRM workflow execution
3. **Evidence Plane**
   - Smoke artifact generation
   - Runtime audit linkage
   - Release gate validation

## Runtime Boundaries
- SkyDexia can invoke CDE/AE/Route capability adapters only through registered contracts.
- Capability adapters are required to declare `id`, `lane`, `requires`, and `execute` contract fields.
- Runtime execution cannot bypass policy checks in `skydexia/policies/knowledge-lifecycle-policy.json`.

## Identity Contract
- Product model identity is enforced as: **SkyDexia model by Skyes Over London**.
