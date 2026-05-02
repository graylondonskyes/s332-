# Troubleshooting

## `skydexia-memory: command not found`

Run:

```bash
cd /path/to/skydexia-memory-fabric-v6.8.1
npm link
```

Then restart the terminal or run:

```bash
hash -r
```

Direct fallback:

```bash
node /path/to/skydexia-memory-fabric-v6.8.1/bin/skydexia-memory.mjs help
```

## `npm link` fails

Check Node version:

```bash
node -v
```

This package expects Node 18+.

## Memory is not showing up in recall

Check that you are in the same repo where memory was recorded:

```bash
pwd
ls -la .skydexia-memory
cat .skydexia-memory/memory.jsonl | tail -5
```

Recall with an empty query to show recent memories:

```bash
skydexia-memory recall ""
```

## Inject changed AGENTS.md and you do not want to commit it

Inspect it:

```bash
git diff -- AGENTS.md
```

Restore it:

```bash
git checkout -- AGENTS.md
```

Or keep local-only generated memory blocks out of commits.

## Secret redaction did not catch a custom secret format

The default redactor catches common token patterns. If your project uses custom secret formats, add a custom redaction rule in `src/index.mjs` inside `redactSecrets()` before using memory in production.

## D1 adapter throws binding error

The D1 adapter requires:

```js
storage: { kind: 'cloudflare-d1', db: env.SKYDEXIA_MEMORY_DB }
```

It must run inside a Cloudflare Worker with a real D1 binding.

## Neon adapter cannot import `pg`

Install `pg` in the host app:

```bash
npm install pg
```

Then provide:

```bash
NEON_DATABASE_URL=...
```

## Smoke fails

Run from the package root:

```bash
cd /path/to/skydexia-memory-fabric-v6.8.1
npm run smoke
```

The smoke creates temporary folders and writes proof to:

```text
proof/SMOKE_PASS_v6.8.1.json
```

If it fails, the error will identify the specific gate.

