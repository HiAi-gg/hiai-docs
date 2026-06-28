# @hiai-docs/mcp-server

MCP (Model Context Protocol) server for [hiai-docs](https://github.com/hiai-labs/hiai-docs).
Exposes hiai-docs operations as MCP tools over the **stdio** transport so any
MCP-compatible client (Claude Desktop, Cursor, OpenCode, etc.) can read,
search, and modify a hiai-docs knowledge base.

> Bun-native, ESM-only, TypeScript strict.

---

## Installation

From the hiai-docs monorepo root:

```bash
bun install
```

The package is registered as a workspace and resolves its dependencies
(`@modelcontextprotocol/sdk`) automatically.

## Configuration

The server reads two environment variables:

| Variable             | Default                       | Description                                |
| -------------------- | ----------------------------- | ------------------------------------------ |
| `HIAI_DOCS_URL`      | `http://localhost:50700`      | Base URL of the hiai-docs API.             |
| `HIAI_DOCS_API_KEY`  | _(unset)_                     | Bearer token sent as `Authorization` header. |

If `HIAI_DOCS_API_KEY` is unset, requests are sent without an Authorization
header (the server still works for any unauthenticated public routes).

## Running locally

```bash
cd packages/mcp-server
bun run dev
```

The server speaks MCP over stdio, so you'll typically configure it as a child
process inside an MCP client — see the examples below.

---

## Usage with MCP clients

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "hiai-docs": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/hiai-docs/packages/mcp-server/src/index.ts"],
      "env": {
        "HIAI_DOCS_URL": "http://localhost:50700",
        "HIAI_DOCS_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "hiai-docs": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/hiai-docs/packages/mcp-server/src/index.ts"],
      "env": {
        "HIAI_DOCS_URL": "http://localhost:50700",
        "HIAI_DOCS_API_KEY": "your-api-key"
      }
    }
  }
}
```

### OpenCode

Add to `~/.config/opencode/opencode.json` (or your project-local equivalent):

```json
{
  "mcp": {
    "hiai-docs": {
      "type": "stdio",
      "command": ["bun", "run", "/absolute/path/to/hiai-docs/packages/mcp-server/src/index.ts"],
      "env": {
        "HIAI_DOCS_URL": "http://localhost:50700",
        "HIAI_DOCS_API_KEY": "your-api-key"
      }
    }
  }
}
```

---

## Available tools

| Tool                   | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `search_documents`     | Hybrid search (full-text + semantic) with optional folder/tags filter. |
| `get_document`         | Fetch a single document by ID, including content and tags.        |
| `create_document`      | Create a new document with optional initial content and folder.   |
| `update_document`      | Update an existing document's title and/or content.              |
| `list_documents`       | List documents with pagination, filterable by folder or tag.      |
| `list_folders`         | List folders, optionally scoped to a parent.                      |
| `create_folder`        | Create a new folder, optionally nested under a parent.            |
| `create_snapshot`      | Create a named snapshot (versioned checkpoint) of a document.     |
| `get_version_history`  | List the version history of a document.                           |
| `export_document`      | Export a document as markdown.                                    |

## Typecheck

```bash
bun run typecheck
```

## License

MIT
