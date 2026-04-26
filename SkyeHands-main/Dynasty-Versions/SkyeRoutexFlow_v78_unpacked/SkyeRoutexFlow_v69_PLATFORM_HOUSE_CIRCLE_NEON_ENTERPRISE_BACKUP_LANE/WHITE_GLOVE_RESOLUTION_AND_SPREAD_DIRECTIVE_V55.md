# WHITE_GLOVE_RESOLUTION_AND_SPREAD_DIRECTIVE_V55

Status rule for this pass: this pass stays on direct code control only.

What this pass is for:
- add an operator-reviewed ambiguous duplicate-booking review lane instead of auto-resolving every duplicate pattern
- add broader entrypoint spread so the newest hardening/value surfaces are reachable from more app entry points
- add matching backend contract coverage for duplicate-booking review preview/apply and entrypoint spread visibility

Core truth rule:
- ambiguous premium bookings remain operator-reviewed
- only obviously safe duplicate outcomes may be applied from the shipped lane
- visibility spread should prove whether the newest surfaces are actually reachable, not just present in code
