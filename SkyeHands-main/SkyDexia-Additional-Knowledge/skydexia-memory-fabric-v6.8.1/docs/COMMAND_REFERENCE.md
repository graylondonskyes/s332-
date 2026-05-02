# Command Reference

## Help

```bash
skydexia-memory help
```

## init

Creates the memory root and config.

```bash
skydexia-memory init --project <project-id>
```

Options:

```text
--project <id>    Project id. Defaults to current folder name.
--root <path>     Memory root. Defaults to ./.skydexia-memory.
--actor <id>      Actor id. Defaults to skydexia.
--mode <mode>     Defaults to local-sidecar.
```

Example:

```bash
skydexia-memory init --project skyehands --actor skydexia
```

## remember

Stores a memory record.

```bash
skydexia-memory remember --title <title> --text <text>
```

Options:

```text
--type <type>       Memory type. Defaults to note.
--title <title>     Memory title.
--text <text>       Memory body.
--file <path>       Read memory text from a file.
--tag <a,b,c>       Comma-separated tags.
--tags <a,b,c>      Same as --tag.
--evidence <json>   JSON evidence object.
```

Example:

```bash
skydexia-memory remember \
  --type rule \
  --title "No theater" \
  --tag proof,quality \
  --text "Do not mark a lane complete until real smoke proof exists."
```

## recall / search

Retrieves matching memories and prints context text.

```bash
skydexia-memory recall "query terms"
skydexia-memory search "query terms"
```

Options:

```text
--query <text>    Query text.
--limit <n>       Number of memories to return. Defaults to 8.
```

Example:

```bash
skydexia-memory recall "no placeholder controls" --limit 5
```

## inject

Writes recalled context into a target file.

```bash
skydexia-memory inject --target AGENTS.md --query "query terms"
```

Options:

```text
--target <path>   Target file. Defaults to AGENTS.md.
--query <text>    Query text.
--limit <n>       Number of memories to inject. Defaults to 8.
```

Example:

```bash
skydexia-memory inject --target CLAUDE.md --query "skyehands rules directives smoke"
```

## export

Exports all memories/events for the project.

```bash
skydexia-memory export --out memory-pack.json
```

## import

Imports a memory pack into the current project memory store.

```bash
skydexia-memory import --file memory-pack.json
```

