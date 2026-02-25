# WebMCP Design Document
**Date:** 2026-02-25
**Status:** Approved

## Overview

WebMCP is an application that takes any website URL and automatically generates a live MCP (Model Context Protocol) server exposing that website's capabilities as callable tools for AI agents.

---

## Architecture

Monorepo using **pnpm workspaces**, **Node.js + TypeScript** throughout.

```
webmcp/
├── packages/
│   ├── core/          ← analysis engine (framework-agnostic)
│   │   ├── discovery/ ← finds capabilities (API spec, HTML, LLM)
│   │   ├── tools/     ← converts capabilities → MCP tool definitions
│   │   └── executor/  ← runs tools via HTTP or Playwright
│   ├── mcp-server/    ← MCP server (stdio + HTTP/SSE transports)
│   ├── web/           ← Next.js dashboard
│   └── cli/           ← CLI (commander.js)
├── package.json
└── pnpm-workspace.yaml
```

**Key dependencies:**
- `@modelcontextprotocol/sdk` — MCP server primitives
- `playwright` — headless browser execution
- `@anthropic-ai/sdk` (`claude-sonnet-4-6`) — LLM-powered capability extraction
- `next` + `tailwindcss` — web dashboard
- `commander` — CLI argument parsing

---

## Core Analysis Engine

The heart of the system. Runs a **3-stage discovery pipeline** for any given URL.

### Stage 1 — API Spec Detection
- Fetch the URL, probe common spec locations: `/openapi.json`, `/swagger.json`, `/api-docs`, `/.well-known/`
- Scan `<link>` and `<script>` tags for API doc references
- If a spec is found → parse it → skip stages 2 & 3, go directly to tool generation

### Stage 2 — HTML/DOM Analysis
- Parse forms: extract `action`, `method`, `input` fields → each form becomes a candidate tool
- Parse navigation links → infer site sections
- Detect common UI patterns: search bars, login forms, product listings, pagination

### Stage 3 — LLM Enrichment (Claude)
- Send page content + discovered candidates to Claude
- Claude produces: meaningful tool names, descriptions, input schemas, transport type recommendations
- Also suggests tools the HTML alone can't detect based on site context

### Output: ToolDefinition

```ts
interface ToolDefinition {
  name: string
  description: string
  inputSchema: JSONSchema
  transport: "http" | "browser"
  httpConfig?: {
    url: string
    method: string
    paramMapping: Record<string, string>
  }
  browserConfig?: {
    steps: BrowserStep[]
  }
}
```

---

## MCP Server (`packages/mcp-server`)

Wraps `core` and exposes discovered tools over the MCP protocol.

### Startup Flow
1. Receive URL (CLI arg or HTTP request from web UI)
2. Run `core` discovery pipeline
3. Dynamically register each `ToolDefinition` as an MCP tool
4. Begin listening for agent connections

### Transports
- **stdio** — for local agents (Claude Desktop, scripts). Default.
- **HTTP/SSE** — for remote agents and web UI connections. Configurable port.

### Tool Execution
```
Agent calls tool → executor checks ToolDefinition.transport
  "http"    → fire HTTP request to site API, return response
  "browser" → launch Playwright, execute BrowserSteps, return scraped result
```

### Scoping
- One server instance = one website URL
- Discovery runs once at startup; tools are cached
- `--refresh` flag re-runs discovery on demand

---

## Web UI (`packages/web`)

Next.js dashboard for exploring, managing, and connecting to MCP servers.

### Views

**Home / New Analysis**
- URL input + "Analyze" button
- Real-time progress (Stage 1 → 2 → 3) via SSE stream
- Navigates to Server View on completion

**Server View (per URL)**
- Lists all tools: name, description, schema (expandable), transport badge
- "Start MCP Server" → spawns instance, shows connection string
- Live log panel: incoming tool calls + responses
- "Re-analyze" button

**Servers Dashboard**
- All active/past instances
- Start / Stop / Copy connection string per instance

### API Routes
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/analyze` | Run discovery, stream progress via SSE |
| `POST` | `/api/servers` | Start an MCP server for a URL |
| `DELETE` | `/api/servers/:id` | Stop an instance |
| `GET` | `/api/servers/:id/logs` | Stream live logs via SSE |

---

## CLI (`packages/cli`)

Thin wrapper for headless/automated use.

### Commands

```bash
# Analyze and print discovered tools
webmcp analyze <url>

# Analyze and start an MCP server
webmcp serve <url> [options]
  --transport  stdio | http  (default: stdio)
  --port       <number>      (default: 4000, HTTP only)
  --refresh                  re-run discovery even if cached
```

### Example `analyze` Output
```
Analyzing https://example.com...
  ✓ Stage 1: No API spec found
  ✓ Stage 2: Found 3 forms, 12 links
  ✓ Stage 3: LLM extracted 5 tools

Tools discovered:
  • search_products       [HTTP]    Search the product catalog
  • get_product_detail    [HTTP]    Get details for a product by ID
  • add_to_cart           [Browser] Add a product to the cart
  • login                 [Browser] Log in with email and password
  • submit_contact_form   [Browser] Send a message via contact form
```

---

## Data Flow (End to End)

```
User provides URL
  → core: Stage 1 (API spec?) → Stage 2 (HTML) → Stage 3 (LLM)
  → ToolDefinition[] produced
  → mcp-server registers tools dynamically
  → Agent connects (stdio or HTTP/SSE)
  → Agent calls tool with args
  → executor routes to HTTP client or Playwright
  → Result returned to agent
```

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | MCP SDK is TS-first; Playwright native |
| Monorepo tool | pnpm workspaces | Lightweight, no Turborepo overhead initially |
| LLM | claude-sonnet-4-6 | Best balance of intelligence and speed for extraction |
| MCP transport | stdio (default) + HTTP/SSE | Covers both local and remote agent use |
| One server per URL | Yes | Clean isolation; avoids tool namespace collisions |
| Discovery caching | Yes (with --refresh) | Avoid re-hitting sites on every startup |
