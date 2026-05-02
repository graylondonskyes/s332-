# SkyDexia Memory Fabric Directive v6.8.1

Only mark a line complete after code and smoke proof verify it.

✅ Local JSONL append-only memory store exists.

✅ Local-sidecar mode initializes a project memory root.

✅ Local-sidecar mode captures manual memories with type, title, tags, body, evidence, project id, actor id, and timestamp.

✅ Local-sidecar mode recalls memories with query scoring.

✅ Context injection writes/replaces a bounded memory block in `AGENTS.md` or another target.

✅ Secret redaction runs before memory persistence.

✅ Platform-embedded mode exports `createSkyDexiaMemory` for direct import inside SkyeHands/SkyDexia.

✅ Platform middleware provides `beforePlan`, `afterAction`, `recordDirective`, and `recordSmoke` hooks.

✅ Smoke proof records are first-class memory records.

✅ Directive records are first-class memory records.

✅ Export pack generation is implemented.

✅ Smoke script proves local capture, recall, injection, platform middleware recall, directive recording, smoke proof recording, secret redaction, and export pack generation.

✅ Detailed use and integration guide exists.

✅ Local sidecar runbook exists.

✅ SkyeHands platform embedding blueprint exists.

✅ Command reference exists.

✅ Storage adapter guide exists.

✅ Troubleshooting guide exists.

☐ Browser dashboard is not implemented in v6.8.1.

☐ True vector embeddings are not implemented in v6.8.1; retrieval is lexical scoring.

☐ Neon/Postgres live smoke is not proven without a live database URL and host dependency.

☐ Cloudflare D1 live smoke is not proven without a Cloudflare Worker runtime binding.

☐ Cross-device cloud sync is not implemented in v6.8.1.

☐ Authenticated multi-tenant admin UI is not implemented in v6.8.1.

✅ This package does not vendor or copy uploaded AGPL source.
