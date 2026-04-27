# SuperIDEv3 Smoke Plan

Purpose: define the smoke proof required before SuperIDEv3 can be called merged, usable, or deployable.

## Source Lane Smoke Before Merge

☐ Smoke Dynasty lane app launch.
☐ Smoke Dynasty Neural Space Pro launch.
☐ Smoke Dynasty SkyeChat launch.
☐ Smoke Dynasty SkyeDocxPro launch.
☐ Smoke Dynasty SkyeBlog launch.
☐ Smoke Dynasty route navigation.
☐ Smoke 3.3.0 app launch.
☐ Smoke 3.3.0 operator gate.
☐ Smoke 3.3.0 publishing package generation.
☐ Smoke 3.3.0 payment session route boundary.
☐ Smoke 3.3.0 submission job route boundary.
☐ Smoke 3.3.0 evidence dashboard.

## Final App UI Smoke

☐ Home loads.
☐ Workspace loads.
☐ Neural Space Pro loads.
☐ SkyeChat loads.
☐ SkyeDocxPro loads.
☐ SkyeBlog loads.
☐ Catalog loads.
☐ Publishing loads.
☐ Commerce loads.
☐ Submissions load.
☐ Evidence loads.
☐ Settings loads.
☐ Every visible navigation button routes correctly.
☐ Every visible action button has a real handler.
☐ Every visible action button changes state, creates output, or calls an API.
☐ Every panel is readable inside viewport bounds.
☐ Every modal can open and close.
☐ Every error state is visible and not silent.

## Final API Smoke

☐ Auth login route succeeds with valid configured test credentials.
☐ Auth login route fails with bad credentials.
☐ Auth verify route accepts valid session.
☐ Auth verify route rejects missing session.
☐ Auth refresh route rotates valid session.
☐ Auth logout route revokes session.
☐ Payment checkout route creates a session or returns missing-config failure.
☐ Stripe webhook route verifies signature or returns signature failure.
☐ Session reconcile route returns typed result.
☐ Publishing package route emits package output.
☐ Publishing binary route emits binary output.
☐ Catalog route persists title state.
☐ Release history route records release event.
☐ Submission job route creates typed job.
☐ Submission dispatch route respects live boundary.
☐ Submission status route returns typed status.
☐ Submission cancel route changes job state.
☐ Evidence routes return current artifacts.

## Data Persistence Smoke

☐ Catalog survives reload.
☐ Workspace files survive reload.
☐ Owned library state survives reload.
☐ Release history survives reload.
☐ Submission jobs survive reload.
☐ Auth revocation survives reload where storage is configured.
☐ Runtime journal writes audit event.
☐ Runtime journal reads audit event.
☐ Export/import preserves project state.

## No-Theater Failure Smoke

☐ Missing auth fails loudly.
☐ Missing payment credentials fail loudly.
☐ Missing portal credentials fail loudly.
☐ Missing publishing input fails loudly.
☐ Missing route fails smoke.
☐ Missing button fails smoke.
☐ Fake success fails smoke.
☐ Stale artifact fails smoke.
☐ Hash mismatch fails smoke.

## Release Gate Smoke

☐ Protected file hashes are current.
☐ Artifact freshness check passes.
☐ Route map check passes.
☐ UI smoke passes.
☐ API smoke passes.
☐ Source-lane parity smoke passes.
☐ Final release checklist generated.
☐ Final release artifacts generated.
