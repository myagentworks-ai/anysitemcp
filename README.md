# AnySiteMCP

> Turn any website into a live MCP server for AI agents.

AnySiteMCP analyzes any website URL and automatically generates a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes that site's capabilities as callable tools — no manual API wrapping required.

---

## How it works

AnySiteMCP runs a 3-stage discovery pipeline:

1. **API Spec Detection** — looks for OpenAPI / Swagger specs linked from the page
2. **HTML/DOM Analysis** — scrapes forms, links, and interactive elements
3. **LLM Enrichment** — uses Claude to generate rich, semantic tool definitions from the raw candidates

Tools execute at runtime via **HTTP requests** or a **headless Playwright browser** depending on what the site requires.

---

## Packages

This is a pnpm monorepo with four packages:

| Package | Description |
|---|---|
| [`packages/core`](packages/core) | Discovery pipeline, HTTP executor, Playwright browser executor |
| [`packages/mcp-server`](packages/mcp-server) | MCP server with stdio and HTTP/SSE transports |
| [`packages/cli`](packages/cli) | `anysitemcp` CLI — `analyze` and `serve` commands |
| [`packages/web`](packages/web) | Next.js 15 dashboard for browser-based analysis and server management |

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- An [Anthropic API key](https://console.anthropic.com) (for LLM enrichment)

---

## Installation

```bash
git clone https://github.com/your-username/anysitemcp.git
cd anysitemcp
pnpm install
pnpm build
```

---

## Usage

### CLI

**Analyze a website and print discovered tools:**

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js analyze https://httpbin.org
```

**Start an MCP server over stdio** (for use with Claude Desktop / any MCP client):

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js serve https://httpbin.org
```

**Start an MCP server over HTTP:**

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/cli/dist/index.js serve https://httpbin.org --transport http --port 4001
# → AnySiteMCP server running at http://localhost:4001/mcp
```

**Options:**

```
analyze <url>
  --skip-llm    Skip LLM enrichment (faster, fewer tools)

serve <url>
  --transport   stdio (default) or http
  --port        Port for HTTP transport (default: 4000)
  --skip-llm    Skip LLM enrichment
```

### Web Dashboard

```bash
# 1. Add your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > packages/web/.env.local

# 2. Start the dev server
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000), enter any URL, and click **Analyze**. Discovered tools stream back in real time. The **Servers** page lets you launch and manage live MCP server instances.

### Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-site": {
      "command": "node",
      "args": ["/path/to/anysitemcp/packages/cli/dist/index.js", "serve", "https://example.com"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

---

## Development

```bash
# Run all tests
pnpm test

# Build all packages
pnpm build

# Start web dev server with hot reload
pnpm dev:web
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude (LLM enrichment) |

For the web package, create `packages/web/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Architecture

```
URL input
    │
    ▼
┌─────────────────────────────────┐
│         Discovery Pipeline       │
│                                 │
│  Stage 1: API Spec Detection    │  ← OpenAPI/Swagger autodiscovery
│  Stage 2: HTML/DOM Analysis     │  ← Forms, links, actions
│  Stage 3: LLM Enrichment        │  ← Claude generates tool definitions
└─────────────┬───────────────────┘
              │  ToolDefinition[]
              ▼
┌─────────────────────────────────┐
│           MCP Server            │
│                                 │
│  transport: stdio  │  http/SSE  │
│  executor:  HTTP   │  Playwright│
└─────────────────────────────────┘
```

Each `ToolDefinition` carries either an `httpConfig` (REST call) or `browserConfig` (Playwright step sequence) so the MCP server knows exactly how to execute it when an AI agent calls the tool.

---

## License

MIT
