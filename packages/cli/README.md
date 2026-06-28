# @hiai-docs/cli

A terminal CLI for managing a self-hosted [hiai-docs](https://github.com/hiai-gg/hiai-docs) knowledge base.

Built on Bun + TypeScript + [Commander](https://github.com/tj/commander.js). Talks to the hiai-docs REST API via `Bearer` auth.

## Installation

The CLI is part of the hiai-docs monorepo.

```bash
# From the repo root
bun install

# Verify
bun --filter '@hiai-docs/cli' typecheck
```

The `hiai-docs` binary is exposed through Bun — invoke it via:

```bash
bun --filter '@hiai-docs/cli' dev -- <args>
# or
bun packages/cli/src/index.ts <args>
```

## Configuration

The CLI reads configuration from three sources, in priority order:

1. **Environment variables** — `HIAI_DOCS_URL` and `HIAI_DOCS_API_KEY`
2. **Config file** at `~/.hiai-docs/config.json`
3. **Built-in defaults** — `http://localhost:50700`, no API key

### First-time setup

Run `init` to write a config file:

```bash
bun packages/cli/src/index.ts init --url https://docs.example.com --key abc123…
```

Or set environment variables for one-off runs:

```bash
HIAI_DOCS_URL=https://docs.example.com HIAI_DOCS_API_KEY=abc123… \
  bun packages/cli/src/index.ts list
```

### Inspect or update config

```bash
hiai-docs config                # show current resolved config
hiai-docs config --url <url>    # update url
hiai-docs config --key <key>    # update API key
hiai-docs config --show         # same as `hiai-docs config` with no args
```

The config file is created lazily — `saveConfig` makes `~/.hiai-docs/` if it doesn't exist.

## Commands

### Documents

```bash
hiai-docs list                                  # paginated document list
hiai-docs list --folder <uuid> --limit 50
hiai-docs list --tag <uuid> --page 2

hiai-docs read <id>                             # title + markdown body

hiai-docs create --title "New Doc" --content "# Hello"
hiai-docs create --title "Spec" --folder <uuid>

hiai-docs update <id> --title "New Title"
hiai-docs update <id> --content "# New body"
hiai-docs update <id> --folder <uuid>           # move
hiai-docs update <id> --folder ""               # remove from folder

hiai-docs delete <id>                           # prompts for confirmation
hiai-docs delete <id> --yes                     # skip prompt (scriptable)
```

### Search

Hybrid full-text + semantic search, ranked by score.

```bash
hiai-docs search "quarterly planning"
hiai-docs search "auth" --limit 10
hiai-docs search "spec" --folder <uuid>
hiai-docs search "roadmap" --tags "important,2026"
```

### Versions & snapshots

Snapshots are named, immutable points-in-time. Auto-saved versions are subject to retention pruning; snapshots are not.

```bash
hiai-docs snapshot <id> --name "v1.0"
hiai-docs snapshot <id> --name "release" --description "tagged for Q2"

hiai-docs history <id>                          # all versions
hiai-docs history <id> --snapshots-only

hiai-docs restore <id> --version <vid>          # auto-backup is taken first
```

### Export

Write a document's markdown to a file or stdout.

```bash
hiai-docs export <id>                           # stdout
hiai-docs export <id> --output spec.md          # file
```

### Folders

Folders are hierarchical. The `folders` command renders a tree by walking children recursively.

```bash
hiai-docs folders                               # full tree from root
hiai-docs folders --parent <uuid>               # children of a folder

hiai-docs folder-create --name "Engineering"
hiai-docs folder-create --name "RFCs" --parent <uuid>
```

### Config

See [Configuration](#configuration).

```bash
hiai-docs config
hiai-docs config --url <url> --key <key>
hiai-docs config --show
hiai-docs init --url <url> --key <key>
```

## Output

- Default output uses ANSI colors when stdout is a TTY.
- When piped (CI, scripts, `| less`, etc.), colors are automatically disabled.
- Tables use `console.table`-style aligned columns.
- Errors are written to stderr; the process exits with code `1` on failure.

## API key resolution

The hiai-docs backend uses two authentication paths:

1. **API key** (`Authorization: Bearer <key>`) — the path the CLI uses.
2. **Better Auth session cookie** — used by the web UI.

Set `HIAI_DOCS_API_KEY` on the server side to enable the API-key path. The CLI must send a matching key.

## Troubleshooting

- **"Unauthorized"** — your key doesn't match the server's `HIAI_DOCS_API_KEY`. Run `hiai-docs config --key <key>` to update.
- **"ECONNREFUSED"** — server isn't reachable. Check `hiai-docs config --show` and confirm the host/port.
- **No output from `list`/`folders`** — the data really is empty, or the API key is for a different user (data is owner-scoped).

## Development

```bash
cd packages/cli

bun run typecheck         # tsc --noEmit
bun run dev -- <args>     # run from source
```

### Layout

```
src/
├── index.ts            # commander entry, command registration
├── client.ts           # REST client (fetch wrapper + typed methods)
├── config.ts           # ~/.hiai-docs/config.json loader
├── format.ts           # TTY-aware table/tree/color helpers
└── commands/
    ├── search.ts
    ├── list.ts
    ├── read.ts
    ├── create.ts
    ├── update.ts
    ├── delete.ts
    ├── snapshot.ts
    ├── history.ts
    ├── restore.ts
    ├── export.ts
    ├── folders.ts       # also `folder-create`
    └── config.ts
```

Each command module exports a `registerX(program, getClient)` function that wires up options and the action handler. `getClient` returns the singleton REST client so future changes (per-command auth, multi-tenant, etc.) can be injected without touching every command.