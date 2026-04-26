# SECTION 58 — DEVGLOW DIRECTIVE

☑ Add a global keyboard command that opens the DevGlow overlay from the active SkyeHands surface
☑ Add exact backing file-path resolution for the live screen, route, panel, or currently focused UI surface
☑ Add clipboard copy action for the resolved file path
☑ Add bug-log capture action so copied paths and notes can be appended into a persistent operator log
☑ Add tabbed DevGlow menu with Path, Keyboard Commands, and Terminal Commands views
☑ Add keyboard-commands registry surface that lists live shortcuts with current bindings
☑ Add terminal-commands registry surface that lists canonical run, smoke, recovery, and proof commands
☑ Add support for local projects, remote workspace runtimes, private server sessions, and Codespaces-style live environments
☑ Add explanation surface for why a path was resolved and where the resolution came from
☑ Add hostile-path handling so unresolved, ambiguous, or generated-only surfaces fail loudly instead of guessing
☑ Add privacy / policy filtering so restricted paths can be redacted or denied under policy mode
☑ Add durable event logging for DevGlow opens, copies, denials, and bug-log writes
☑ Trigger the DevGlow keyboard command from a fixture surface
☑ Prove the overlay resolves the exact backing file path for the active screen
☑ Copy the resolved path to clipboard and prove it matches the displayed value
☑ Switch to Keyboard Commands tab and prove live bindings render
☑ Switch to Terminal Commands tab and prove canonical commands render
☑ Append a captured path into a persistent bug log and prove persistence after restart
☑ Trigger DevGlow on an ambiguous screen and prove the system fails loudly instead of inventing a path
☑ Trigger DevGlow on a restricted surface and prove path redaction or denial follows policy
☑ Inject stale route metadata and prove resolution verification fails
☑ Inject duplicate bug-log writes and prove dedupe or explicit duplicate handling
☑ Corrupt one logged DevGlow event and prove verification fails loudly
☑ `apps/skyequanta-shell/bin/workspace-proof-section58-devglow.mjs`
☑ `scripts/smoke-section58-devglow.sh`
☑ `docs/proof/SECTION_58_DEVGLOW.json`
☑ The platform can reveal exact live backing paths, commands, and bug trails without operator hunting or fake path guesses
