# AnySiteMCP

> Turn any website into a live MCP server for AI agents — no manual API wrapping required.

AnySiteMCP analyzes any URL and automatically generates a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes that site's capabilities as callable tools. Discovered tools can be saved, managed, and called directly from the built-in Integration Hub or consumed by any MCP-compatible AI agent (Claude Desktop, custom agents, etc.).

---

## What's New in v0.1d

| Feature | Description |
|---|---|
| **Light & Dark Theme** | Full light/dark mode with a slate-based palette, sky-blue accents, and CSS custom properties |
| **Theme Toggle** | One-click toggle in the navbar switches between light and dark mode |
| **Slate Palette** | Blue-gray slate tones replace neutral grays for a sharper, developer-tool aesthetic |
| **Always-dark Code Blocks** | Code and connection-string panels stay dark in both light and dark mode for readability |
| **Accessible Contrast** | All text meets WCAG 4.5:1 minimum contrast ratios in both modes |

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

## Quick Start

The fastest way to go from a URL to a working MCP server is through the web dashboard.

```bash
# 1. Set your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > packages/web/.env.local

# 2. Start the dashboard
pnpm dev:web
```

Open **[http://localhost:3000](http://localhost:3000)** and follow the steps below.

---

## Using the Web Dashboard

### Step 1 — Analyze a URL

1. Paste any URL into the input on the home page and click **Analyze**
2. The 3-stage discovery pipeline runs with live progress output:
   - **Stage 1** — looks for OpenAPI / Swagger specs linked from the page
   - **Stage 2** — scrapes forms, links, and interactive elements
   - **Stage 3** — Claude generates rich, semantic tool definitions from the raw candidates
3. Discovered tools appear as an expandable list showing name, description, and transport type

> **Tip:** Point AnySiteMCP at API documentation pages (e.g. `https://stripe.com/docs/api`, `https://docs.github.com/en/rest`) for the richest tool discovery. It also works on any site with forms or interactive elements.

---

### Step 2 — Save as Integration

Once analysis finishes a **Save as Integration** panel appears below the tool list:

1. The integration name is auto-filled from the URL hostname — edit it if needed
2. Add an optional description
3. Click **Save to Integrations** — this runs the full MCP connect and writes the integration to disk

Saved integrations persist across server restarts and reappear in the Integration Hub automatically.

---

### Step 3 — Launch an MCP Server

Open the **Integration Hub** at `/integrations` and find your saved integration. Click **start mcp** on its card:

- A live MCP proxy starts on a random port (4000–4899)
- The connection string (e.g. `http://localhost:4551/mcp`) appears inline with a copy button
- Click **stop mcp** to shut it down when you're done

Copy the connection string and use it in any MCP-compatible AI agent (see [Connecting AI Agents](#connecting-ai-agents) below).

---

### Integration Hub (`/integrations`)

The Integration Hub lists all saved integrations with their live status.

| Field | Description |
|---|---|
| **Name** | Slug identifier used in API calls |
| **URL** | The source URL that was analyzed |
| **Tool count** | Number of tools discovered |
| **Status** | `connected` — live in this process / `saved` — persisted, offline |
| **Connected at** | Timestamp of the last successful connection |

#### Actions on each card

| Button | What it does |
|---|---|
| **tool call** | Shows a ready-to-copy `fetch` snippet for calling any tool on this integration |
| **tools** | Expands the full tool list — each tool shows its name, description, parameter schema table, transport type, and a pre-filled `fetch` code snippet |
| **notes** | Opens a markdown notes editor for this integration, persisted to disk |
| **start mcp** | Spawns a live MCP proxy on a random port; shows the connection string with a copy button |
| **reconnect** | Re-runs the MCP connect for `saved` (offline) integrations |
| **✕** | Removes the integration with a 5-second **Undo** toast — the DELETE only commits if you don't undo |

#### After a server restart

Previously saved integrations reload from `packages/web/data/integrations.json` with status `saved`. Their tool definitions were stored at save time, so the **tools** panel still works — you'll see a "(last known)" amber notice. Click **reconnect** to bring them back live.

---

## Connecting AI Agents

Once you have a running MCP server (from **start mcp** or the CLI), plug the connection string into any MCP-compatible client.

### Claude Desktop (stdio — recommended for local use)

Edit your `claude_desktop_config.json` (usually at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

Restart Claude Desktop — it will have all discovered tools available as native MCP tools. You can add multiple sites as separate entries.

### Claude Desktop (HTTP/SSE — use the dashboard's start mcp)

If you prefer to manage servers from the dashboard rather than the config file:

1. Click **start mcp** on an integration card — note the connection string (e.g. `http://localhost:4551/mcp`)
2. In `claude_desktop_config.json`, add an HTTP entry:

```json
{
  "mcpServers": {
    "stripe": {
      "url": "http://localhost:4551/mcp"
    }
  }
}
```

3. Restart Claude Desktop

### Claude Code

Add the server as an MCP remote in your project or user config:

```bash
claude mcp add stripe --url http://localhost:4551/mcp
```

Or add it to `.claude/mcp.json` in your project:

```json
{
  "mcpServers": {
    "stripe": {
      "url": "http://localhost:4551/mcp"
    }
  }
}
```

### Any MCP-compatible client (HTTP/SSE)

Any client that supports the MCP HTTP/SSE transport can connect using the URL shown by **start mcp**:

```
http://localhost:<port>/mcp
```

The server speaks the standard MCP protocol — tool listing, tool calls, and streaming results all work out of the box.

---

## CLI

Use the CLI for scripting, automation, or headless environments where the web dashboard isn't needed.

### Preview discovered tools for a URL

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js analyze https://httpbin.org
```

This runs the full 3-stage pipeline and prints all discovered tools to stdout — no server is started.

### Serve as an MCP server over stdio

For use directly with Claude Desktop or any stdio MCP client:

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js serve https://httpbin.org
```

### Serve as an MCP server over HTTP

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js serve https://httpbin.org --transport http --port 4001
# → AnySiteMCP server running at http://localhost:4001/mcp
```

### CLI options

```
analyze <url>
  --skip-llm    Skip LLM enrichment (faster, fewer tools)

serve <url>
  --transport   stdio (default) | http
  --port        Port for HTTP transport (default: 4000)
  --skip-llm    Skip LLM enrichment
```

> **When to use `--skip-llm`:** If the target URL has a machine-readable OpenAPI spec, Stage 3 enrichment adds little value and you can skip it to save time and API credits.

---

## REST API

The web package exposes a REST API for programmatic integration management. All endpoints are available at `http://localhost:3000/api/integrations`.

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

Returns integration details including full tool definitions. Falls back to persisted tools for offline integrations.

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
{ "result": { ... } }
```

---

## Tips & Best Practices

**Choose the right URL**
Point AnySiteMCP at API reference or documentation pages, not marketing homepages. Pages like `https://docs.github.com/en/rest` or `https://stripe.com/docs/api` yield far more tools than `https://github.com`.

**Use `--skip-llm` for speed**
If the target site has an OpenAPI spec (visible in Stage 1 output), skip LLM enrichment — the spec alone produces complete, accurate tool definitions in seconds.

**Keep the dashboard running for live connections**
Integration cards show `connected` only while the Next.js process is running. The `start mcp` proxy also lives inside that process. For long-running agent workflows, run the dashboard in a persistent terminal session or deploy it to a server.

**Save notes per integration**
Use the **notes** button to document what each integration is for, which tools matter most, and any quirks — notes persist to disk and survive restarts.

**Multiple integrations, one dashboard**
There's no limit on saved integrations. You can have dozens of sites analyzed and saved, each with their own MCP server spawned on demand from the dashboard.

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

### v0.1d — Light & Dark Theme Redesign
- Introduced full light/dark mode with a slate-based palette (`slate-50` → `slate-950`) replacing neutral grays
- Sky-blue accent color (`sky-`) for active nav links, focus rings, and transport badges
- CSS custom properties (`--background`, `--foreground`) drive theme switching via `.dark` class on `<html>`
- Always-dark code blocks (`bg-slate-950`) for readability in both modes
- Theme toggle button in the navbar with sun/moon SVG icons
- Inverted primary action buttons adapt correctly per theme (dark in light mode, light in dark mode)
- Inline `borderLeftColor` fix for integration status pills to avoid Tailwind dark-mode cascade conflict
- Accessible contrast: all text meets WCAG 4.5:1 minimum in both modes

### v0.1c — MCP Launch, Undo Delete, Tool Schemas
- Added **Start MCP Server** button on each integration card — spawns a live MCP proxy on a random port, shows the connection string inline, and allows one-click stop
- Added **Undo Delete** — removing an integration is optimistic with a 5-second undo toast; the DELETE API is only called if undo is not clicked
- Added **tool parameter schema tables** in the expanded tools panel — shows parameter name, type, required status, and description before each code snippet
- Code snippets in the tools panel now pre-fill required parameters with typed defaults

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
