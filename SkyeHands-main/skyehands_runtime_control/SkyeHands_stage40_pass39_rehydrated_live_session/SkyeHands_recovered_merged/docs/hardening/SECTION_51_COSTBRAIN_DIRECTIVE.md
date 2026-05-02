# SECTION 51 — COSTBRAIN / LIVE ECONOMIC INTELLIGENCE DIRECTIVE

☑ Track token spend, compute cost, build time, deploy cost, storage cost, and rollback risk per run
☑ Add cost model per provider and runtime lane
☑ Add planning modes such as cheapest acceptable, safest regulated patch, fastest fix under budget, private-only budget mode
☑ Add budget-aware planner and runtime decision engine
☑ Add cost explanation UI for why a cheaper or safer route was selected
☑ Add budget overrun denial path and approval path

☑ Run the same task under multiple budget policies
☑ Prove route/plan changes when budget changes
☑ Prove live spend accounting for the run
☑ Prove over-budget denial
☑ Prove human override can approve a more expensive route
☑ Inject incorrect cost metadata and prove validation catches it
☑ Simulate provider price spike and prove planner reroutes or fails loudly

☑ `apps/skyequanta-shell/bin/workspace-proof-section51-costbrain.mjs`
☑ `scripts/smoke-section51-costbrain.sh`
☑ `docs/proof/SECTION_51_COSTBRAIN.json`

☑ The platform can choose materially different engineering strategies based on explicit economic constraints and explain why
