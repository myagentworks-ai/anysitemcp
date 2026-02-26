# AnySiteMCP

> Turn any website into a live MCP server for AI agents — no manual API wrapping required.

AnySiteMCP analyzes any URL and automatically generates a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes that site's capabilities as callable tools. Discovered tools can be saved, managed, and called directly from the built-in Integration Hub or consumed by any MCP-compatible AI agent (Claude Desktop, custom agents, etc.).

---

## What's New in v0.1b

| Feature | Description |
|---|---|
| **Integration Hub** | Persistent dashboard to save, manage, and reconnect integrations across server restarts |
| **Save from Home** | Analyze any URL then save it as a named integration in one click |
| **Per-tool Code Snippets** | Every discovered tool shows a ready-to-copy `fetch` snippet |
| **Tool Call Panel** | Per-integration generic call snippet with placeholder substitution |
| **Notes** | Per-integration markdown notes, persisted to disk |
| **Offline Tools** | Tool definitions survive server restarts — stored integrations show "(last known)" tools |
| **Reconnect** | One-click reconnect for integrations that have gone offline |

---

## How It Works

AnySiteMCP runs a 3-stage discovery pipeline against any URL:

```
Stage 1 — API Spec Detection    Looks for OpenAPI / Swagger specs linked from the page
Stage 2 — HTML/DOM Analysis     Scrapes forms, links, and interactive elements
Stage 3 — LLM Enrichment        Claude generates rich, semantic tool definitions from raw candidates
```

Each `ToolDefinition` carries either an `httpConfig` (REST call) or `browserConfig` (Playwright step sequence), so the MCP server knows exactly how to execute it when an AI agent calls the tool at runtime.

---

## Architecture

```
URL Input
    │
    ▼
┌─────────────────────────────────────┐
│           Discovery Pipeline         │
│                                     │
│  Stage 1 ── API Spec Detection      │  ← OpenAPI / Swagger autodiscovery
│  Stage 2 ── HTML / DOM Analysis     │  ← Forms, links, interactive elements
│  Stage 3 ── LLM Enrichment (Claude) │  ← Semantic tool definitions
└────────────────┬────────────────────┘
                 │  ToolDefinition[]
                 ▼
┌─────────────────────────────────────┐
│             MCP Server              │
│                                     │
│  Transports:  stdio  |  HTTP/SSE   │
│  Executors:   HTTP   |  Playwright  │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│          Integration Hub            │
│  (in-process registry + JSON store) │
│                                     │
│  • Named integrations               │
│  • Persisted tool definitions       │
│  • Notes per integration            │
│  • REST API /api/integrations/*     │
└─────────────────────────────────────┘
```

---

## Packages

This is a pnpm monorepo. All packages are at version **0.1.0-beta**.

| Package | Description |
|---|---|
| [`packages/core`](packages/core) | Discovery pipeline, HTTP executor, Playwright browser executor, `ToolDefinition` types |
| [`packages/mcp-server`](packages/mcp-server) | Full MCP server with `stdio` and `HTTP/SSE` transports, tool dispatcher |
| [`packages/cli`](packages/cli) | `anysitemcp` CLI — `analyze` and `serve` commands |
| [`packages/web`](packages/web) | Next.js 15 dashboard — analyze, save integrations, Integration Hub, REST API |

---

## Prerequisites

- **Node.js 20+**
- **pnpm 9+**
- **Anthropic API key** — [get one here](https://console.anthropic.com) (used for LLM enrichment in Stage 3)

---

## Installation

```bash
git clone https://github.com/myagentworks-ai/anysitemcp.git
cd anysitemcp
pnpm install
pnpm build
```

---

## Web Dashboard

The web dashboard is the primary interface for AnySiteMCP. It combines a live URL analyzer with a full Integration Hub for managing saved sites.

### Start the dashboard

```bash
# 1. Add your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > packages/web/.env.local

# 2. Start the dev server
pnpm dev:web
```

Open **[http://localhost:3000](http://localhost:3000)**.

---

### Analyze any URL

1. Enter any URL in the home page input and click **Analyze**
2. The 3-stage discovery pipeline runs with real-time progress streaming
3. Discovered tools appear as an expandable list — each tool shows its name, description, and HTTP transport
4. A **Save as Integration** panel appears below the tool list once discovery is complete

---

### Save as Integration

After analyzing a URL:

1. The **Save as Integration** panel auto-fills the integration name from the URL hostname (e.g. `https://stripe.com/docs` → `stripe`)
2. Optionally add a description
3. Click **Save to Integrations** — this runs the full MCP connect and persists the integration to disk
4. A confirmation banner links directly to the Integration Hub

Saved integrations survive server restarts and reappear in the Integration Hub automatically.

---

### Integration Hub (`/integrations`)

The Integration Hub lists all saved integrations and their live status. Each card shows:

| Field | Description |
|---|---|
| **Name** | Slug identifier used in API calls |
| **URL** | The source URL that was analyzed |
| **Tool count** | Number of tools discovered |
| **Status** | `connected` (live in this process) or `saved` (persisted, offline) |
| **Connected at** | Timestamp of the last successful connection |

#### Per-integration actions

| Button | What it does |
|---|---|
| **tool call** | Opens an inline code panel with a generic `fetch` snippet for calling any tool on this integration — copy and paste into your app |
| **tools** | Expands the full tool list. Each tool shows its transport type, name, description, and a pre-filled `fetch` snippet ready to copy |
| **notes** | Opens a free-text notes editor for this integration, persisted to disk |
| **reconnect** | Re-runs the MCP connect for integrations with `saved` status (offline after a restart) |
| **✕** | Removes the integration from the hub and deletes it from the persisted store |

#### Offline / restart behaviour

When the server restarts, previously saved integrations are restored from `packages/web/data/integrations.json` with status `saved`. Their tool definitions were persisted at save time, so the **tools** panel still works and shows a "(last known)" amber notice. Click **reconnect** to bring them back live.

---

## REST API

The web package exposes a REST API for programmatic integration management.

### `GET /api/integrations`

Returns the merged list of live + saved integrations.

```jsonc
[
  {
    "name": "stripe",
    "url": "https://stripe.com/docs",
    "description": "Stripe payment API",
    "toolCount": 12,
    "connectedAt": "2025-01-01T12:00:00.000Z",
    "status": "connected",   // "connected" | "saved" | "error"
    "isLive": true,
    "notes": ""
  }
]
```

### `POST /api/integrations`

Connect a URL and save it as a named integration.

```jsonc
// Request
{
  "name": "stripe",          // required — slug identifier
  "url": "https://...",      // required
  "description": "...",      // optional
  "skipLlm": false           // optional — skip LLM enrichment for faster analysis
}

// Response 201
{
  "name": "stripe",
  "url": "https://...",
  "toolCount": 12,
  "connectedAt": "...",
  "status": "connected",
  "isLive": true
}
```

### `GET /api/integrations/:name`

Returns the integration details including full tool definitions. Falls back to persisted tools for offline integrations (`isStored: true`).

```jsonc
{
  "name": "stripe",
  "url": "https://...",
  "tools": [
    { "name": "list_charges", "description": "...", "transport": "http" }
  ],
  "status": "connected",
  "isStored": false   // true = served from disk (integration is offline)
}
```

### `PATCH /api/integrations/:name`

Update integration metadata (notes, description).

```jsonc
// Request
{ "notes": "Used by the billing agent." }
```

### `DELETE /api/integrations/:name`

Remove the integration from the hub and delete it from the persisted store.

### `POST /api/integrations/:name/call`

Call a specific tool on a live integration.

```jsonc
// Request
{
  "tool": "list_charges",
  "params": { "limit": 10 }
}

// Response
{
  "result": { ... }
}
```

---

## CLI

The CLI exposes the same discovery and serve capabilities without the web UI.

### Analyze a URL (preview tools)

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js analyze https://httpbin.org
```

### Serve as an MCP server over stdio

For use with **Claude Desktop** or any stdio-based MCP client:

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js serve https://httpbin.org
```

### Serve as an MCP server over HTTP

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js serve https://httpbin.org --transport http --port 4001
# → AnySiteMCP server running at http://localhost:4001/mcp
```

### Options

```
analyze <url>
  --skip-llm    Skip LLM enrichment (faster, fewer tools)

serve <url>
  --transport   stdio (default) | http
  --port        Port for HTTP transport (default: 4000)
  --skip-llm    Skip LLM enrichment
```

---

## Use with Claude Desktop

Add AnySiteMCP as an MCP server in your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stripe": {
      "command": "node",
      "args": [
        "/path/to/anysitemcp/packages/cli/dist/index.js",
        "serve",
        "https://stripe.com/docs"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Claude will have access to all discovered tools for that site as native MCP tools.

---

## Data Persistence

Integrations are persisted to **`packages/web/data/integrations.json`** automatically on every connect/save operation. This file includes:

- Integration name, URL, description, status
- Tool definitions (name, description, transport) — so tools are available even when offline
- Notes
- Timestamps (created, last connected)

The file is created automatically on first save. Do not commit it to version control if it contains sensitive integration URLs.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude (LLM enrichment in Stage 3) |

For the web package, create `packages/web/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the web dashboard with hot reload
pnpm dev:web

# Run all tests
pnpm test
```

### Project structure

```
anysitemcp/
├── packages/
│   ├── core/             # Discovery pipeline + executors + types
│   │   └── src/
│   │       ├── analyzer.ts        # 3-stage discovery orchestrator
│   │       ├── executor-http.ts   # HTTP tool executor
│   │       ├── executor-browser.ts # Playwright tool executor
│   │       └── types.ts           # ToolDefinition, ToolParameter, etc.
│   │
│   ├── mcp-server/       # MCP protocol server
│   │   └── src/
│   │       ├── index.ts           # Entry point, transport setup
│   │       └── server.ts          # Tool registration + dispatch
│   │
│   ├── cli/              # CLI (analyze + serve commands)
│   │   └── src/
│   │       └── index.ts
│   │
│   └── web/              # Next.js 15 App Router dashboard
│       ├── app/
│       │   ├── page.tsx                      # Home — URL analysis + save
│       │   ├── integrations/page.tsx         # Integration Hub
│       │   ├── api/analyze/route.ts          # SSE analysis stream
│       │   └── api/integrations/             # REST API
│       ├── lib/
│       │   ├── integration-registry.ts       # In-process IntegrationHub singleton
│       │   └── integration-store.ts          # JSON file persistence
│       └── data/
│           └── integrations.json             # Persisted integrations (auto-created)
│
├── package.json          # pnpm workspace root
└── README.md
```

---

## Changelog

### v0.1b — Integration Hub + Persistence
- Added Integration Hub dashboard (`/integrations`) with full CRUD for saved integrations
- Integrations persist across server restarts via `data/integrations.json`
- Tool definitions stored at save time — offline integrations retain full tool metadata
- Added per-integration **tool call** code panel (generic fetch snippet with placeholders)
- Added per-tool code snippets in the tools panel (pre-filled with tool name)
- Added per-integration **notes** editor, persisted to disk
- Added **reconnect** action for offline integrations
- Added **Save as Integration** panel on the home page analyze flow
- Name auto-filled from URL hostname on tool discovery
- Fixed tools button visibility after server restart (removed `isLive` gate)

### v0.1a — Initial Release
- 3-stage discovery pipeline (API spec detection, HTML/DOM analysis, LLM enrichment)
- MCP server with stdio and HTTP/SSE transports
- Playwright browser executor for JavaScript-heavy sites
- Next.js web dashboard with real-time streaming analysis
- CLI (`analyze` and `serve` commands)

---

## License

MIT
