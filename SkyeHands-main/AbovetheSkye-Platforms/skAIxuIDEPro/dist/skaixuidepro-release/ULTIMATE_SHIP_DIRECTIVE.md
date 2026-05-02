# skAIxuIDEpro Ultimate Ship Directive

Audit date: 2026-04-29

Scope audited:
- `index.html`
- `server.js`
- `package.json`
- `.env.example`
- `netlify.toml`
- `netlify/functions/**`
- `skAIxuide/**`
- archive/runtime notes in `ARCHIVE_NORMALIZATION_REPORT.md` and `SERVER_SIDE_AI_HARDENING.md`

## Executive verdict

`skAIxuIDEpro-deploy` is **not a fake platform**. It has a real backend lane, real auth/persistence/admin code, and a substantial browser IDE.

It is also **not yet honest to ship as "only missing provider vars"** in its current state.

The real position is:

- The **core skAIxuIDE lane is materially implemented**.
- The repo as a whole is still an **archive bundle / launcher estate**, not a clean single-product release.
- Some public claims are **too broad** relative to what the code proves.
- There are **concrete ship blockers** in routing, asset paths, security exposure, and packaging coherence.

If you want to ship this as a standalone platform, the right claim is:

`A working orchestrated AI IDE with identity, persistence, usage controls, admin tooling, and linked ecosystem apps, pending final deploy hardening and provider/runtime configuration.`

Do **not** currently claim:

- fully production-grade across the whole archive
- fully bespoke hardening for every included app
- truly provider-agnostic or multi-brain at runtime
- ready-to-ship with only env vars missing

## What is real and materially implemented

### 1. Backend governance lane is real

The Netlify backend is substantive, not decorative.

Implemented lanes:

- AI chat gateway: [netlify/functions/gateway-chat.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/gateway-chat.js:1)
- AI stream gateway: [netlify/functions/gateway-stream.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/gateway-stream.js:1)
- provider wrapper: [netlify/functions/_lib/kaixu-openai.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/_lib/kaixu-openai.js:1)
- member/auth/caps/activity/workspace/app-state helpers: [netlify/functions/_lib/kaixu-platform.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/_lib/kaixu-platform.js:1)
- runtime status: [netlify/functions/runtime-status.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/runtime-status.js:1)
- admin overview: [netlify/functions/admin-overview.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/admin-overview.js:1)
- admin mutation lane: [netlify/functions/admin-user-update.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/admin-user-update.js:1)
- workspace persistence: [netlify/functions/workspace-sync.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/workspace-sync.js:1)
- per-app state persistence: [netlify/functions/app-state.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/app-state.js:1)
- log intake/reporting: [netlify/functions/logs.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/logs.js:1)
- DB/bootstrap lane: [netlify/functions/db-setup.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/db-setup.js:1)
- identity sync hooks: [netlify/functions/identity-login.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/identity-login.js:1), [netlify/functions/identity-signup.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/identity-signup.js:1)

### 2. The IDE front end is real

The main IDE is not a one-screen façade.

Implemented surface in [skAIxuide/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/index.html:1):

- full interactive UI shell
- file/project hub
- export/import behavior
- editor + preview
- undo/redo
- guided tour
- auth overlay
- workspace snapshotting
- AI chat wiring
- app switcher into sibling tools

Cloud/session behavior is meaningfully wired in [skAIxuide/s0l26-cloud.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/s0l26-cloud.js:1):

- auth token handling
- runtime-status fetch
- site-config fetch
- auth-me session load
- gateway chat
- gateway stream
- workspace persistence
- browser log submission

### 3. Archive-wide normalization is real, but limited

The repo’s own note is important:

See [ARCHIVE_NORMALIZATION_REPORT.md](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/ARCHIVE_NORMALIZATION_REPORT.md:1).

That document correctly says the archive got:

- one shared runtime
- one generic auth shell
- one server-side AI lane
- one generic Neon backup/app-state lane
- one ecosystem catalog

It also correctly admits it **did not custom-rewrite every bespoke app’s internal business logic**.

That is the honest maturity description of the wider archive.

## Overstatements and unsupported claims

### 1. "Production-grade intelligent workspace" is too broad as currently packaged

[skAIxuide/Analysis.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/Analysis.html:215) says:

- "It is not a demo."
- "It is a production-grade intelligent workspace."

That overstates the current bundle because:

- the repo still ships as an archive of many mixed-maturity apps
- launcher routes/assets are broken in places
- some shells depend on shared generic runtime rather than bespoke app hardening
- the local dev story is split between Netlify functions and a separate fixed remote proxy server

Better claim:

`working integrated AI IDE with governance and persistence, in release-candidate state pending final hardening`

### 2. "15+ tool ecosystem" is true as a launcher count, but easy to misread as 15+ equally hardened products

[skAIxuide/Analysis.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/Analysis.html:257) references 15+ peer tools.

That is directionally true as a surfaced ecosystem, but the stronger implied claim is risky. The codebase shows:

- some linked apps are substantial
- some are static/PWA shells
- some are archive-normalized rather than fully productized

Ship wording should say:

`15+ linked tools and app surfaces are included in the ecosystem archive`

not

`15+ production apps`

### 3. Provider stance is orchestrated branding, not true provider-agnostic multi-model runtime

[netlify/functions/_lib/kaixu-openai.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/_lib/kaixu-openai.js:1) is a branded OpenAI wrapper.

Current reality:

- public AI name = `kAIxU`
- public provider name = `SKYES OVER LONDON`
- actual implemented upstream = OpenAI chat completions
- model fallback = more OpenAI models

So this is:

`orchestrated branded provider abstraction`

not:

- multi-provider orchestration
- provider-agnostic routing
- interchangeable brain fabric

### 4. Archive docs already disprove "only provider vars are missing"

[SERVER_SIDE_AI_HARDENING.md](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/SERVER_SIDE_AI_HARDENING.md:1) documents hardening work.

[ARCHIVE_NORMALIZATION_REPORT.md](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/ARCHIVE_NORMALIZATION_REPORT.md:1) documents archive-wide normalization rather than full bespoke rewrite.

That means the current truthful state is:

- more than env vars are still needed for a clean standalone ship

## Proven ship blockers

### Critical 1. Public log read/write lane is effectively unauthenticated

[netlify/functions/logs.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/logs.js:1)

Problem:

- `GET` returns logs without admin enforcement
- `POST` accepts logs without requiring a member session
- it records identity context if present, but does not require it

Impact:

- telemetry leakage
- possible spam/noise ingestion
- weak operational security story

Directive:

- make `GET /logs` admin-only
- throttle or auth-gate `POST /logs`
- if public logging is retained, separate anonymous write lane from admin read lane

### Critical 2. Launcher routing is broken on a case-sensitive host

Broken references:

- root launcher points to `./skAIxuide/index.html`, but actual folder is `skAIxuide`
  - [index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/index.html:1081)
- root launcher points to `./skyesoverlondon.html`, actual file is `SkyesOverLondon.html`
  - [index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/index.html:1251)
- IDE app switcher points to `smartide.html`, actual file is `SmartIDE.html`
  - [skAIxuide/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/index.html:213)

Impact:

- dead links in the flagship shell
- immediate credibility damage

Directive:

- normalize file names and links to exact case
- then crawl every launcher/app-switcher path and verify existence

### Critical 3. Root launcher advertises routes/assets that do not exist in its own location

Missing from root:

- `manifest.json`
- `icon-192.png`
- `./GotSOLE/index.html`

Referenced in:

- [index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/index.html:713)
- [index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/index.html:1183)

Impact:

- broken PWA metadata
- broken launcher cards

Directive:

- either add the missing assets/routes or remove the references before ship

### Critical 4. Root local server is not aligned with the local Netlify implementation

[server.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/server.js:1)

Problem:

- it hardcodes `<same-origin-runtime-gateway>`
- it proxies `/api/*` and `/.netlify/functions/*` to that remote lane
- this bypasses the local functions that are actually present in the repo

Impact:

- local behavior can differ from deployed behavior
- "self-contained except env vars" is not true if this server path is used
- debugging becomes misleading

Directive:

- either retire `server.js` from the ship path
- or make it proxy to local functions in dev and only use remote gateway by explicit opt-in

### Critical 5. `skyehawk.js` references a non-implemented alt route

[skyehawk.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skyehawk.js:65)

Problem:

- `GATEWAY_ALT = '/api/kaixu-chat'`
- no matching implemented function/route was found in this repo

Impact:

- misleading diagnostics
- possible false-negative or false-positive health checks

Directive:

- remove the alt route reference or implement it

## Major non-critical blockers

### 6. Identity sync functions mask failure by returning `200`

- [netlify/functions/identity-login.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/identity-login.js:1)
- [netlify/functions/identity-signup.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/identity-signup.js:1)

Problem:

- catch paths still return `200`
- they report `{ ok: true, note: ... }` on failure

Impact:

- hides setup problems
- weakens observability
- can make auth provisioning look successful when it was skipped

Directive:

- return real failure codes, or separate soft-sync semantics from success semantics

### 7. Front end is CDN-heavy

Main IDE depends on:

- Tailwind CDN
- Three.js CDN
- Lucide CDN
- Marked CDN
- DOMPurify CDN
- JSZip CDN
- Netlify Identity widget CDN

See [skAIxuide/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/index.html:1)

Impact:

- brittle cold boot under network/CDN issues
- weaker deterministic shipping story
- harder offline/protected-environment deployment

Directive:

- vend or bundle critical JS locally for release
- at minimum bundle identity/runtime-critical libraries

### 8. Duplicate shared-runtime injection appears multiple times

[skAIxuide/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/index.html:103)

and later duplicate injections further down the file.

Impact:

- risk of double patching
- harder reasoning about runtime behavior

Directive:

- normalize to one shared-runtime include

### 9. The repo is packaged as a platform archive, not a clean release target

Root contains many unrelated or mixed-maturity app folders.

Impact:

- hard to audit
- hard to support
- easy to overclaim by association

Directive:

- create a dedicated release package containing only:
  - root launcher
  - `skAIxuide`
  - `s0l26`
  - `netlify/functions`
  - the exact promoted sibling apps you intend to keep

## Honest capability statement by area

### Safe to claim

- browser-based orchestrated AI IDE
- Netlify Identity gated usage
- Neon-backed member/workspace/activity/usage persistence
- per-member caps and usage tracking
- admin review/update surface
- branded AI orchestration layer under `kAIxU`
- linked ecosystem launcher

### Claim only with caveat

- multi-app ecosystem
  - caveat: archive includes mixed-maturity apps
- persistent workspace
  - caveat: depends on deploy-side DB/Identity
- server-side AI only
- caveat: current local alternate server path still points at a fixed remote gateway

### Do not claim yet

- provider-agnostic orchestration
- multi-provider routing
- every included app is productionized
- ready-to-ship except env vars
- fully offline-ready deployment

## Minimum code changes required before "only provider vars remain" is honest

### Must do

1. Lock down logs API.
2. Fix all broken/case-sensitive launcher links.
3. Fix missing root manifest/icon references or add those files.
4. Remove or fix dead launcher entries like `GotSOLE`.
5. Remove or implement `/api/kaixu-chat` diagnostic route.
6. Decide the real dev/runtime path:
   - Netlify functions local
   - or remote gateway proxy
   - not both in contradictory forms
7. Make identity sync failures visible with real status behavior.
8. Deduplicate shared runtime injection.
9. Create a trimmed release bundle instead of shipping the whole archive as-is.

### Strongly recommended

1. Bundle critical CDN dependencies locally.
2. Add a real health-check page that verifies:
   - identity
   - DB
   - blobs
   - gateway-chat
   - gateway-stream
   - admin permissions
3. Add a release smoke script that checks all internal launcher links.
4. Add explicit provider telemetry fields showing:
   - branded model
   - resolved upstream model
   - lane used
5. If you want the orchestrator claim to be stronger, add a true fallback brain lane:
   - open-weight local or hosted fallback
   - explicit lane resolution logging

## Positioning directive

### If shipping now after only env vars

Do not do it.

That would ship a bundle with:

- avoidable broken links
- exposed logs lane
- mixed runtime story
- overstated maturity language

### If shipping after the minimum changes above

Position it as:

`skAIxuIDEpro is a governed AI IDE and ecosystem launcher with branded orchestration, identity-gated use, usage controls, admin oversight, and persistent workspace state.`

### If you want enterprise-grade positioning later

Then add:

- true multi-provider orchestration
- deterministic local asset bundling
- release-only app curation
- stronger access control on telemetry/admin surfaces
- automated smoke verification

## Final ruling

The flagship core is real.

The current repo is **release-candidate platform code inside an archive bundle**, not a finished standalone ship artifact.

The main blockers are not missing "AI implementation" code. They are:

- security hardening
- route/asset correctness
- package curation
- runtime consistency
- honest positioning

After those are fixed, the statement `only provider vars and deploy config remain` becomes much closer to true.
