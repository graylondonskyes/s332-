# 06 — ACCEPTANCE PROOFS IN ORDER

These are the exact proof runs that should be used before any directive checkboxes change.

## Proof run A — contract cleanup
1. create one fresh account in AE FLOW.
2. send it to Routex.
3. run one quick action from Routex.
4. confirm one visible UI confirmation appears.
5. reload both apps.
6. confirm the same action appears in history and export output.
7. import a legacy backup and confirm no crash + hydrated defaults.

## Proof run B — route pack
1. create a route with at least two stops.
2. add economics, one task, one proof file, one signature.
3. export route pack.
4. import on second device copy.
5. confirm duplicate warnings if same-name same-date route already exists.
6. confirm imported copy retains docs, economics, and tasks.

## Proof run C — signed service summary
1. complete one stop with signature.
2. generate service summary.
3. reload app.
4. reopen the generated summary from doc vault.
5. export proof packet and confirm summary is included.

## Proof run D — account code / QR lookup
1. create account code in AE FLOW.
2. print/export or copy the code.
3. look it up in Routex offline.
4. confirm the resolved client matches the original account.
5. generate proof packet and confirm the same code is present.

## Proof run E — voice notes
1. on a supported device, attach voice note to stop or account.
2. reload app.
3. replay voice note offline.
4. export route pack and confirm metadata carries through.
5. on an unsupported device, confirm the UI degrades cleanly without dead buttons.

## Proof run F — heat score
1. route the same client twice.
2. mark one failure and one success.
3. log collections due or success.
4. confirm account heat changes.
5. confirm route builder sorting reflects the score.
6. restore from backup and confirm the same score is still present or correctly recomputed.

## Proof run G — pseudo-map board
1. create five-stop route.
2. reorder on board.
3. add directional text between stops.
4. launch next-stop flow from board.
5. confirm order persists on normal route view and export.

## Proof run H — multi-day trip pack
1. create trip with day 1 and day 2 routes.
2. log lodging and day-specific expenses.
3. close each day separately.
4. close trip.
5. confirm daily ledgers and trip ledger reconcile.
6. export and import trip pack.

## Mandatory proof note format for directive checkmarks
Use this exact pattern:
`✅ YYYY-MM-DD — <one-line proof note naming the surface, the persisted data, and the export/restore result>`
