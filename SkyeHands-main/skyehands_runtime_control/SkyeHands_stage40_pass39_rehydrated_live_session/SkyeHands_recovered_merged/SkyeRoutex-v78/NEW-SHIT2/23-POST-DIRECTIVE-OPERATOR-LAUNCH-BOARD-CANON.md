# Post-Directive Operator Launch Board Canon

This post-directive lane adds a saveable operator launch board to Routex and an importable launch board inbox to AE FLOW.

The Routex launch board must:
- compute a score from the latest proof, handoff, receipt, binder, queue, and pack-coverage surfaces
- list blockers explicitly
- generate the next-action queue in priority order
- export HTML and JSON
- push a shared outbox artifact for AE FLOW

The AE FLOW launch board lane must:
- sync the Routex launch-board outbox
- preserve imported launch boards in local storage
- export an inbox HTML view
- surface the latest imported board in the workbench

This lane is intended to make the app feel less like scattered tools and more like one operator command surface with a clear go / no-go read.
