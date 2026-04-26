# PLATFORM HOUSE CIRCLE INTEGRATION DIRECTIVE V63

V63 continues the integral-stack directive with major codebase implementation work that was still within local control.

What is newly landed in code:
- live QR camera scanning lane using `BarcodeDetector` + `getUserMedia`, with manual fallback redemption
- vendor POS adapter normalization for Square, Toast, Clover, generic CSV, and JSON rows
- local webhook inbox and background job execution queue with dead-letter replay
- realtime local sync mesh using peer heartbeat, storage-signal frames, BroadcastChannel frames, and replica-bundle apply
- new Platform House V63 command surfaces inside the Routex shell

What V63 does not pretend to be:
- not a remote cloud backend
- not cross-account server auth
- not vendor-certified live API credentials

What V63 materially closes:
- the scanning gap
- the adapter/import gap
- the local automation-processor gap
- the same-machine/same-browser realtime sync gap
