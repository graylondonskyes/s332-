# Local Sidecar Runbook

This runbook is for using SkyDexia Memory Fabric as a local repo tool.

## Install once

```bash
cd /path/to/skydexia-memory-fabric-v6.8.1
npm link
```

Verify:

```bash
skydexia-memory help
```

## Initialize a project

```bash
cd /path/to/project
skydexia-memory init --project project-name
```

## Record common memory types

### Rule

```bash
skydexia-memory remember \
  --type rule \
  --title "Preserve branding" \
  --tag branding,ui \
  --text "Preserve existing brand identity, color, CSS, polish, routes, and working plumbing."
```

### Failure

```bash
skydexia-memory remember \
  --type failure \
  --title "Button existed without backend route" \
  --tag failure,ui,backend \
  --text "A visible button was shipped without its backend route. Do not claim ready until click smoke proves the route."
```

### Smoke proof

```bash
skydexia-memory remember \
  --type smoke-proof \
  --title "Route smoke passed" \
  --tag smoke,routes \
  --text "Route smoke passed for registered routes." \
  --evidence '{"passed":true,"proofFile":"proof/ROUTE_SMOKE.json"}'
```

### Directive status

```bash
skydexia-memory remember \
  --type directive \
  --title "Gate 1 — Route manifest truth" \
  --tag directive,complete,routes \
  --text "Route manifest audit and route smoke passed."
```

## Recall memory

```bash
skydexia-memory recall "route smoke directive"
```

Use a higher limit:

```bash
skydexia-memory recall "branding ui smoke" --limit 12
```

## Inject into AGENTS.md

```bash
skydexia-memory inject --target AGENTS.md --query "branding ui smoke rules"
```

The command creates or updates a block in `AGENTS.md`.

## Use a custom root directory

```bash
skydexia-memory init --project skyehands --root /path/to/memory-root
```

Or set an environment variable:

```bash
export SKYDEXIA_MEMORY_ROOT=/path/to/memory-root
skydexia-memory recall "smoke proof"
```

## Export memory

```bash
skydexia-memory export --out skyehands-memory-pack.json
```

## Import memory

```bash
skydexia-memory import --file skyehands-memory-pack.json
```

## Files created

```text
.skydexia-memory/config.json
.skydexia-memory/memory.jsonl
.skydexia-memory/events.jsonl
.skydexia-memory/exports/
```

## Git rule

Usually commit memory system code, not private memory data.

Recommended `.gitignore` entry:

```gitignore
.skydexia-memory/
```

If you intentionally want to seed a project memory pack, export a curated JSON file and commit that instead.

