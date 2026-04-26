# WHITE GLOVE CONFLICT AND SPECIAL DOCS DIRECTIVE V46

This pass is focused on the next white-glove items still within direct coding control:

- tighter dispatch conflict scoring for multi-stop, return-leg, standby, airport, rider, driver, and vehicle overlap depth
- explicit booking-chain fields for multi-stop, return-leg, standby planning, airport meet/greet, flight code, signage name, cancellation reason, and no-show reason
- airport meet/greet card generation bound to the booking record
- cancellation / no-show proof generation bound to the booking record
- AE FLOW visibility for conflict depth and special white-glove docs

Status rule for this pass:
- do not call it done on words alone
- only count what is present in shipped code, parse-valid, and wired into the app surface
