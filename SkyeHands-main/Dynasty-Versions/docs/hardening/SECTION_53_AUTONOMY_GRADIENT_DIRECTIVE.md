# SECTION 53 — AUTONOMY GRADIENT DIRECTIVE

☑ Add autonomy modes such as suggest-only, draft-and-wait, execute-with-review-gates, full autonomous, continuous maintenance mode
☑ Bind autonomy settings by task, workspace, repo, branch, user, and policy tier
☑ Add review gates and approval checkpoints
☑ Add UI showing current autonomy level and pending approval requirements
☑ Add policy enforcement for forbidden autonomy levels in restricted contexts

☑ Run the same task under multiple autonomy modes and prove different execution behavior
☑ Prove suggest-only never mutates state
☑ Prove draft-and-wait produces a patch but stops before execution
☑ Prove execute-with-review-gates pauses at human approval
☑ Prove fully autonomous completes without manual stop when allowed
☑ Simulate forbidden autonomy escalation and prove denial

☑ `apps/skyequanta-shell/bin/workspace-proof-section53-autonomy-gradient.mjs`
☑ `scripts/smoke-section53-autonomy-gradient.sh`
☑ `docs/proof/SECTION_53_AUTONOMY_GRADIENT.json`

☑ The same task behaves materially differently under different autonomy settings, with policy and evidence enforcing the distinction
