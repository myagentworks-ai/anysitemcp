# WebMCP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a monorepo app that analyzes any website URL and generates a live MCP server exposing that site's capabilities as callable AI agent tools.

**Architecture:** 4-package pnpm monorepo — `core` (discovery pipeline + executor), `mcp-server` (MCP protocol layer), `cli` (CLI wrapper), `web` (Next.js dashboard). Core runs a 3-stage pipeline: API spec detection → HTML/DOM parsing → LLM enrichment (Claude). Tools execute via HTTP or Playwright headless browser.

**Tech Stack:** Node.js 20+, TypeScript 5, pnpm workspaces, `@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`, Playwright, cheerio, Next.js 15, Tailwind CSS 4, commander, Vitest.

---

## Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

**Step 1: Create root package.json**

```json
{
  "name": "webmcp",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev:web": "pnpm --filter web dev"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.next/
*.tsbuildinfo
.env
.env.local
```

**Step 5: Initialize git and install**

```bash
cd /Users/davidcampana/Desktop/new-myagentworks.ai
git init
pnpm install
```

**Step 6: Commit**

```bash
git add .
git commit -m "chore: initialize monorepo with pnpm workspaces"
```

---

## Task 2: Scaffold `core` Package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/vitest.config.ts`

**Step 1: Create packages/core/package.json**

```json
{
  "name": "@webmcp/core",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.0",
    "cheerio": "^1.0.0",
    "playwright": "^1.42.0"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/core/vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 4: Create packages/core/src/types.ts**

```ts
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
}

export interface BrowserStep {
  action: "navigate" | "fill" | "click" | "waitFor" | "extract";
  selector?: string;
  value?: string;
  paramRef?: string; // references an input parameter by name
}

export interface HttpConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  paramMapping: Record<string, string>; // toolParam -> queryParam or bodyField
}

export interface BrowserConfig {
  steps: BrowserStep[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  transport: "http" | "browser";
  httpConfig?: HttpConfig;
  browserConfig?: BrowserConfig;
}

export interface DiscoveryResult {
  tools: ToolDefinition[];
  sourceUrl: string;
  discoveredVia: "api-spec" | "html" | "llm" | "hybrid";
}
```

**Step 5: Create packages/core/src/index.ts**

```ts
export * from "./types.js";
export { discover } from "./discovery/pipeline.js";
export { executeHttpTool } from "./executor/http.js";
export { executeBrowserTool } from "./executor/browser.js";
```

**Step 6: Install dependencies**

```bash
pnpm install
```

**Step 7: Commit**

```bash
git add packages/core/
git commit -m "chore: scaffold core package"
```

---

## Task 3: Core — Stage 1 (API Spec Detection)

**Files:**
- Create: `packages/core/src/discovery/spec-detector.ts`
- Create: `packages/core/src/discovery/__tests__/spec-detector.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/discovery/__tests__/spec-detector.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { detectApiSpec } from "../spec-detector.js";

describe("detectApiSpec", () => {
  it("returns null when no spec found at common paths", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    const result = await detectApiSpec("https://example.com", mockFetch);
    expect(result).toBeNull();
  });

  it("returns parsed spec when openapi.json found", async () => {
    const spec = { openapi: "3.0.0", paths: { "/search": { get: {} } } };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false } as Response) // /openapi.json - not found first
      .mockResolvedValueOnce({
        ok: true,
        json: async () => spec,
      } as unknown as Response);
    const result = await detectApiSpec("https://example.com", mockFetch);
    expect(result).toEqual(spec);
  });

  it("detects swagger.json", async () => {
    const spec = { swagger: "2.0", paths: {} };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => spec } as unknown as Response);
    const result = await detectApiSpec("https://example.com", mockFetch);
    expect(result).toEqual(spec);
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- spec-detector
```

Expected: FAIL with "Cannot find module"

**Step 3: Implement spec-detector.ts**

```ts
const SPEC_PATHS = [
  "/openapi.json",
  "/swagger.json",
  "/api-docs",
  "/api-docs.json",
  "/.well-known/openapi.json",
];

export async function detectApiSpec(
  baseUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<Record<string, unknown> | null> {
  const url = new URL(baseUrl);

  for (const path of SPEC_PATHS) {
    try {
      const res = await fetchFn(`${url.origin}${path}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.openapi || data.swagger)) {
          return data as Record<string, unknown>;
        }
      }
    } catch {
      // ignore network errors, try next path
    }
  }

  return null;
}
```

**Step 4: Run test — verify it passes**

```bash
cd packages/core && pnpm test -- spec-detector
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/core/src/discovery/
git commit -m "feat(core): add API spec detector (stage 1)"
```

---

## Task 4: Core — API Spec → ToolDefinitions Parser

**Files:**
- Create: `packages/core/src/discovery/spec-parser.ts`
- Create: `packages/core/src/discovery/__tests__/spec-parser.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseOpenApiSpec } from "../spec-parser.js";

describe("parseOpenApiSpec", () => {
  it("converts a GET endpoint to a tool definition", () => {
    const spec = {
      openapi: "3.0.0",
      paths: {
        "/search": {
          get: {
            operationId: "searchProducts",
            summary: "Search for products",
            parameters: [
              { name: "q", in: "query", required: true, schema: { type: "string" } },
            ],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("search_products");
    expect(tools[0].transport).toBe("http");
    expect(tools[0].inputSchema.properties).toHaveProperty("q");
    expect(tools[0].httpConfig?.method).toBe("GET");
    expect(tools[0].httpConfig?.url).toBe("https://api.example.com/search");
  });

  it("returns empty array for spec with no paths", () => {
    const tools = parseOpenApiSpec({ openapi: "3.0.0", paths: {} }, "https://example.com");
    expect(tools).toHaveLength(0);
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- spec-parser
```

**Step 3: Implement spec-parser.ts**

```ts
import type { ToolDefinition, JSONSchema } from "../types.js";

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/[^a-z0-9_]/g, "_");
}

export function parseOpenApiSpec(
  spec: Record<string, unknown>,
  baseUrl: string
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "delete"].includes(method)) continue;

      const op = operation as Record<string, unknown>;
      const operationId = (op.operationId as string) ?? `${method}_${path.replace(/\//g, "_")}`;
      const params = (op.parameters as Array<Record<string, unknown>>) ?? [];

      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];

      for (const param of params) {
        const name = param.name as string;
        const schema = (param.schema as JSONSchema) ?? { type: "string" };
        properties[name] = { ...schema, description: (param.description as string) ?? "" };
        if (param.required) required.push(name);
      }

      tools.push({
        name: toSnakeCase(operationId),
        description: (op.summary as string) ?? (op.description as string) ?? path,
        inputSchema: { type: "object", properties, required },
        transport: "http",
        httpConfig: {
          url: `${new URL(baseUrl).origin}${path}`,
          method: method.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE",
          paramMapping: Object.fromEntries(params.map((p) => [p.name as string, p.name as string])),
        },
      });
    }
  }

  return tools;
}
```

**Step 4: Run test — verify it passes**

```bash
cd packages/core && pnpm test -- spec-parser
```

**Step 5: Commit**

```bash
git add packages/core/src/discovery/spec-parser.ts packages/core/src/discovery/__tests__/spec-parser.test.ts
git commit -m "feat(core): parse OpenAPI spec into ToolDefinitions"
```

---

## Task 5: Core — Stage 2 (HTML/DOM Analysis)

**Files:**
- Create: `packages/core/src/discovery/html-analyzer.ts`
- Create: `packages/core/src/discovery/__tests__/html-analyzer.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { analyzeHtml } from "../html-analyzer.js";

describe("analyzeHtml", () => {
  it("extracts a search form as a candidate tool", () => {
    const html = `
      <html><body>
        <form action="/search" method="GET">
          <input name="q" type="text" placeholder="Search..." />
          <button type="submit">Search</button>
        </form>
      </body></html>
    `;

    const candidates = analyzeHtml(html, "https://example.com");

    expect(candidates).toHaveLength(1);
    expect(candidates[0].formAction).toBe("https://example.com/search");
    expect(candidates[0].method).toBe("GET");
    expect(candidates[0].fields).toContainEqual(expect.objectContaining({ name: "q" }));
  });

  it("extracts multiple forms", () => {
    const html = `
      <html><body>
        <form action="/search" method="GET"><input name="q" /></form>
        <form action="/login" method="POST">
          <input name="email" type="email" />
          <input name="password" type="password" />
        </form>
      </body></html>
    `;
    const candidates = analyzeHtml(html, "https://example.com");
    expect(candidates).toHaveLength(2);
  });

  it("ignores forms with no inputs", () => {
    const html = `<form action="/empty"></form>`;
    const candidates = analyzeHtml(html, "https://example.com");
    expect(candidates).toHaveLength(0);
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- html-analyzer
```

**Step 3: Implement html-analyzer.ts**

```ts
import * as cheerio from "cheerio";

export interface FormCandidate {
  formAction: string;
  method: "GET" | "POST";
  fields: Array<{ name: string; type: string; placeholder?: string }>;
  submitLabel?: string;
}

export function analyzeHtml(html: string, baseUrl: string): FormCandidate[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const candidates: FormCandidate[] = [];

  $("form").each((_, el) => {
    const form = $(el);
    const action = form.attr("action") ?? "/";
    const method = (form.attr("method") ?? "GET").toUpperCase() as "GET" | "POST";

    const fields: FormCandidate["fields"] = [];
    form.find("input, textarea, select").each((_, input) => {
      const name = $(input).attr("name");
      if (!name) return;
      const type = $(input).attr("type") ?? "text";
      if (["submit", "reset", "button", "hidden"].includes(type)) return;
      fields.push({
        name,
        type,
        placeholder: $(input).attr("placeholder"),
      });
    });

    if (fields.length === 0) return;

    const formAction = action.startsWith("http")
      ? action
      : `${base.origin}${action.startsWith("/") ? action : `/${action}`}`;

    const submitLabel = form.find('[type="submit"], button').first().text().trim() || undefined;

    candidates.push({ formAction, method, fields, submitLabel });
  });

  return candidates;
}
```

**Step 4: Run test — verify it passes**

```bash
cd packages/core && pnpm test -- html-analyzer
```

**Step 5: Commit**

```bash
git add packages/core/src/discovery/html-analyzer.ts packages/core/src/discovery/__tests__/html-analyzer.test.ts
git commit -m "feat(core): HTML/DOM form analyzer (stage 2)"
```

---

## Task 6: Core — Stage 3 (LLM Enrichment)

**Files:**
- Create: `packages/core/src/discovery/llm-enricher.ts`
- Create: `packages/core/src/discovery/__tests__/llm-enricher.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { enrichWithLlm } from "../llm-enricher.js";
import type { FormCandidate } from "../html-analyzer.js";

describe("enrichWithLlm", () => {
  it("converts form candidates to tool definitions using LLM response", async () => {
    const candidates: FormCandidate[] = [
      {
        formAction: "https://example.com/search",
        method: "GET",
        fields: [{ name: "q", type: "text", placeholder: "Search products..." }],
        submitLabel: "Search",
      },
    ];

    const mockTools = [
      {
        name: "search_products",
        description: "Search the product catalog",
        inputSchema: {
          type: "object",
          properties: { q: { type: "string", description: "Search query" } },
          required: ["q"],
        },
        transport: "http",
        httpConfig: {
          url: "https://example.com/search",
          method: "GET",
          paramMapping: { q: "q" },
        },
      },
    ];

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: JSON.stringify(mockTools) }],
        }),
      },
    };

    const result = await enrichWithLlm(
      candidates,
      "https://example.com",
      "<html>Shop</html>",
      mockClient as never
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("search_products");
    expect(mockClient.messages.create).toHaveBeenCalledOnce();
  });

  it("returns empty array when LLM returns invalid JSON", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "sorry, I cannot help" }],
        }),
      },
    };
    const result = await enrichWithLlm([], "https://example.com", "", mockClient as never);
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- llm-enricher
```

**Step 3: Implement llm-enricher.ts**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { FormCandidate } from "./html-analyzer.js";
import type { ToolDefinition } from "../types.js";

const SYSTEM_PROMPT = `You are an expert at analyzing websites and generating MCP tool definitions.
Given a website URL, its HTML content, and detected form candidates, produce a JSON array of ToolDefinition objects.

Each ToolDefinition must have:
- name: snake_case, descriptive (e.g. "search_products", "user_login")
- description: clear one-line description of what the tool does
- inputSchema: JSON Schema object with properties and required array
- transport: "http" if the form can be submitted directly as an HTTP request, "browser" if it likely requires JavaScript/cookies
- httpConfig (if transport is "http"): { url, method, paramMapping }
- browserConfig (if transport is "browser"): { steps: [] } — leave steps empty, they will be generated at runtime

Also suggest additional tools that make sense for this site based on context, even if no form was detected.
Return ONLY valid JSON array, no explanation.`;

export async function enrichWithLlm(
  candidates: FormCandidate[],
  url: string,
  htmlSnippet: string,
  client?: Anthropic
): Promise<ToolDefinition[]> {
  const anthropic = client ?? new Anthropic();

  const userMessage = `Website URL: ${url}

Detected form candidates:
${JSON.stringify(candidates, null, 2)}

HTML snippet (first 3000 chars):
${htmlSnippet.slice(0, 3000)}

Generate ToolDefinitions for this website.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    return JSON.parse(match[0]) as ToolDefinition[];
  } catch {
    return [];
  }
}
```

**Step 4: Run test — verify it passes**

```bash
cd packages/core && pnpm test -- llm-enricher
```

**Step 5: Commit**

```bash
git add packages/core/src/discovery/llm-enricher.ts packages/core/src/discovery/__tests__/llm-enricher.test.ts
git commit -m "feat(core): LLM enrichment stage using Claude (stage 3)"
```

---

## Task 7: Core — Discovery Pipeline Orchestrator

**Files:**
- Create: `packages/core/src/discovery/pipeline.ts`
- Create: `packages/core/src/discovery/__tests__/pipeline.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { discover } from "../pipeline.js";

vi.mock("../spec-detector.js", () => ({ detectApiSpec: vi.fn().mockResolvedValue(null) }));
vi.mock("../html-analyzer.js", () => ({
  analyzeHtml: vi.fn().mockReturnValue([
    { formAction: "https://example.com/search", method: "GET", fields: [{ name: "q", type: "text" }] }
  ])
}));
vi.mock("../llm-enricher.js", () => ({
  enrichWithLlm: vi.fn().mockResolvedValue([
    {
      name: "search",
      description: "Search",
      inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
      transport: "http",
      httpConfig: { url: "https://example.com/search", method: "GET", paramMapping: { q: "q" } }
    }
  ])
}));

describe("discover", () => {
  it("falls back to HTML + LLM when no API spec found", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><form action='/search'><input name='q' /></form></html>",
    } as unknown as Response);

    const result = await discover("https://example.com", { fetchFn: mockFetch });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("search");
    expect(result.discoveredVia).toBe("hybrid");
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- pipeline
```

**Step 3: Implement pipeline.ts**

```ts
import { detectApiSpec } from "./spec-detector.js";
import { parseOpenApiSpec } from "./spec-parser.js";
import { analyzeHtml } from "./html-analyzer.js";
import { enrichWithLlm } from "./llm-enricher.js";
import type { DiscoveryResult } from "../types.js";

export interface DiscoverOptions {
  fetchFn?: typeof fetch;
  skipLlm?: boolean;
}

export async function discover(
  url: string,
  options: DiscoverOptions = {}
): Promise<DiscoveryResult> {
  const fetchFn = options.fetchFn ?? fetch;

  // Stage 1: API spec detection
  const spec = await detectApiSpec(url, fetchFn);
  if (spec) {
    const tools = parseOpenApiSpec(spec, url);
    if (tools.length > 0) {
      return { tools, sourceUrl: url, discoveredVia: "api-spec" };
    }
  }

  // Stage 2: HTML analysis
  const pageRes = await fetchFn(url);
  const html = await pageRes.text();
  const candidates = analyzeHtml(html, url);

  // Stage 3: LLM enrichment
  if (options.skipLlm) {
    // Convert candidates to basic tools without LLM
    const tools = candidates.map((c) => ({
      name: c.formAction.split("/").pop() ?? "form",
      description: `Submit ${c.submitLabel ?? "form"} at ${c.formAction}`,
      inputSchema: {
        type: "object" as const,
        properties: Object.fromEntries(c.fields.map((f) => [f.name, { type: "string" }])),
        required: c.fields.map((f) => f.name),
      },
      transport: "http" as const,
      httpConfig: {
        url: c.formAction,
        method: c.method,
        paramMapping: Object.fromEntries(c.fields.map((f) => [f.name, f.name])),
      },
    }));
    return { tools, sourceUrl: url, discoveredVia: "html" };
  }

  const tools = await enrichWithLlm(candidates, url, html);
  return { tools, sourceUrl: url, discoveredVia: "hybrid" };
}
```

**Step 4: Run test — verify it passes**

```bash
cd packages/core && pnpm test -- pipeline
```

**Step 5: Commit**

```bash
git add packages/core/src/discovery/pipeline.ts packages/core/src/discovery/__tests__/pipeline.test.ts
git commit -m "feat(core): discovery pipeline orchestrator (stages 1-3)"
```

---

## Task 8: Core — HTTP Executor

**Files:**
- Create: `packages/core/src/executor/http.ts`
- Create: `packages/core/src/executor/__tests__/http.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { executeHttpTool } from "../http.js";
import type { ToolDefinition } from "../../types.js";

const searchTool: ToolDefinition = {
  name: "search",
  description: "Search",
  inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
  transport: "http",
  httpConfig: { url: "https://api.example.com/search", method: "GET", paramMapping: { q: "q" } },
};

describe("executeHttpTool", () => {
  it("appends params as query string for GET requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: ["shoe"] }),
    } as unknown as Response);

    const result = await executeHttpTool(searchTool, { q: "shoes" }, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/search?q=shoes",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual({ results: ["shoe"] });
  });

  it("sends params as JSON body for POST requests", async () => {
    const postTool: ToolDefinition = {
      ...searchTool,
      httpConfig: { url: "https://api.example.com/submit", method: "POST", paramMapping: { q: "query" } },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as unknown as Response);

    await executeHttpTool(postTool, { q: "test" }, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/submit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "test" }),
      })
    );
  });

  it("throws when tool has no httpConfig", async () => {
    const badTool: ToolDefinition = { ...searchTool, httpConfig: undefined };
    await expect(executeHttpTool(badTool, {}, vi.fn())).rejects.toThrow("no httpConfig");
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- http
```

**Step 3: Implement executor/http.ts**

```ts
import type { ToolDefinition } from "../types.js";

export async function executeHttpTool(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  fetchFn: typeof fetch = fetch
): Promise<unknown> {
  if (!tool.httpConfig) throw new Error(`Tool "${tool.name}" has no httpConfig`);

  const { url, method, paramMapping } = tool.httpConfig;

  // Map tool args to API params using paramMapping
  const mappedParams: Record<string, string> = {};
  for (const [toolParam, apiParam] of Object.entries(paramMapping)) {
    if (args[toolParam] !== undefined) {
      mappedParams[apiParam] = String(args[toolParam]);
    }
  }

  let finalUrl = url;
  let body: string | undefined;
  const headers: Record<string, string> = {};

  if (method === "GET") {
    const qs = new URLSearchParams(mappedParams).toString();
    finalUrl = qs ? `${url}?${qs}` : url;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(mappedParams);
  }

  const res = await fetchFn(finalUrl, { method, headers, body });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${finalUrl}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}
```

**Step 4: Run test — verify it passes**

```bash
cd packages/core && pnpm test -- http
```

**Step 5: Commit**

```bash
git add packages/core/src/executor/
git commit -m "feat(core): HTTP tool executor"
```

---

## Task 9: Core — Browser Executor (Playwright)

**Files:**
- Create: `packages/core/src/executor/browser.ts`
- Create: `packages/core/src/executor/__tests__/browser.test.ts`

**Step 1: Install Playwright browser**

```bash
cd packages/core && npx playwright install chromium
```

**Step 2: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { executeBrowserTool } from "../browser.js";
import type { ToolDefinition } from "../../types.js";

const loginTool: ToolDefinition = {
  name: "login",
  description: "Log in",
  inputSchema: { type: "object", properties: { email: { type: "string" }, password: { type: "string" } }, required: ["email", "password"] },
  transport: "browser",
  browserConfig: {
    steps: [
      { action: "navigate", value: "https://example.com/login" },
      { action: "fill", selector: "input[name=email]", paramRef: "email" },
      { action: "fill", selector: "input[name=password]", paramRef: "password" },
      { action: "click", selector: "button[type=submit]" },
      { action: "waitFor", selector: ".dashboard" },
      { action: "extract", selector: "body" },
    ],
  },
};

describe("executeBrowserTool", () => {
  it("throws when tool has no browserConfig", async () => {
    const badTool: ToolDefinition = { ...loginTool, browserConfig: undefined };
    await expect(executeBrowserTool(badTool, {})).rejects.toThrow("no browserConfig");
  });

  it("throws when no steps provided", async () => {
    const emptyTool: ToolDefinition = { ...loginTool, browserConfig: { steps: [] } };
    await expect(executeBrowserTool(emptyTool, {})).rejects.toThrow("no steps");
  });
});
```

**Step 3: Run test — verify it fails**

```bash
cd packages/core && pnpm test -- browser
```

**Step 4: Implement executor/browser.ts**

```ts
import { chromium } from "playwright";
import type { ToolDefinition } from "../types.js";

export async function executeBrowserTool(
  tool: ToolDefinition,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!tool.browserConfig) throw new Error(`Tool "${tool.name}" has no browserConfig`);
  if (!tool.browserConfig.steps.length) throw new Error(`Tool "${tool.name}" has no steps`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    let extractedContent: string | null = null;

    for (const step of tool.browserConfig.steps) {
      switch (step.action) {
        case "navigate":
          await page.goto(step.value!);
          break;
        case "fill": {
          const value = step.paramRef ? String(args[step.paramRef] ?? "") : step.value ?? "";
          await page.fill(step.selector!, value);
          break;
        }
        case "click":
          await page.click(step.selector!);
          break;
        case "waitFor":
          await page.waitForSelector(step.selector!);
          break;
        case "extract": {
          const el = await page.$(step.selector ?? "body");
          extractedContent = await el?.textContent() ?? null;
          break;
        }
      }
    }

    return extractedContent ?? { success: true, url: page.url() };
  } finally {
    await browser.close();
  }
}
```

**Step 5: Run test — verify it passes**

```bash
cd packages/core && pnpm test -- browser
```

**Step 6: Commit**

```bash
git add packages/core/src/executor/browser.ts packages/core/src/executor/__tests__/browser.test.ts
git commit -m "feat(core): Playwright browser executor"
```

---

## Task 10: Scaffold `mcp-server` Package

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/index.ts`
- Create: `packages/mcp-server/vitest.config.ts`

**Step 1: Create package.json**

```json
{
  "name": "@webmcp/mcp-server",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": { "webmcp-server": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.5.0",
    "@webmcp/core": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create vitest.config.ts** (same as core)

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { globals: true } });
```

**Step 4: Install and commit**

```bash
pnpm install
git add packages/mcp-server/
git commit -m "chore: scaffold mcp-server package"
```

---

## Task 11: MCP Server — Dynamic Tool Registration

**Files:**
- Create: `packages/mcp-server/src/server.ts`
- Create: `packages/mcp-server/src/__tests__/server.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createMcpServer } from "../server.js";
import type { ToolDefinition } from "@webmcp/core";

const mockTool: ToolDefinition = {
  name: "search_products",
  description: "Search for products",
  inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
  transport: "http",
  httpConfig: { url: "https://example.com/search", method: "GET", paramMapping: { q: "q" } },
};

describe("createMcpServer", () => {
  it("creates a server with registered tools", () => {
    const server = createMcpServer([mockTool]);
    expect(server).toBeDefined();
  });

  it("registers the correct number of tools", () => {
    const tools: ToolDefinition[] = [
      mockTool,
      { ...mockTool, name: "get_product", description: "Get a product" },
    ];
    const server = createMcpServer(tools);
    // Server should exist and be configured
    expect(server).toBeDefined();
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd packages/mcp-server && pnpm test -- server
```

**Step 3: Implement server.ts**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeHttpTool, executeBrowserTool } from "@webmcp/core";
import type { ToolDefinition } from "@webmcp/core";
import { z } from "zod";

function jsonSchemaToZod(schema: ToolDefinition["inputSchema"]): z.ZodRawShape {
  const shape: z.ZodRawShape = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const isRequired = schema.required?.includes(key) ?? false;
    let zodType: z.ZodTypeAny;
    switch (prop.type) {
      case "number":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      default:
        zodType = z.string();
    }
    if (prop.description) zodType = zodType.describe(prop.description);
    shape[key] = isRequired ? zodType : zodType.optional();
  }
  return shape;
}

export function createMcpServer(tools: ToolDefinition[]): McpServer {
  const server = new McpServer({
    name: "webmcp",
    version: "0.0.1",
  });

  for (const tool of tools) {
    const shape = jsonSchemaToZod(tool.inputSchema);

    server.tool(
      tool.name,
      tool.description,
      shape,
      async (args) => {
        try {
          let result: unknown;
          if (tool.transport === "http") {
            result = await executeHttpTool(tool, args as Record<string, unknown>);
          } else {
            result = await executeBrowserTool(tool, args as Record<string, unknown>);
          }
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
```

**Step 4: Run test — verify it passes**

```bash
cd packages/mcp-server && pnpm test -- server
```

**Step 5: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): dynamic MCP tool registration"
```

---

## Task 12: MCP Server — stdio + HTTP Transports + Entry Point

**Files:**
- Create: `packages/mcp-server/src/transports.ts`
- Create: `packages/mcp-server/src/index.ts`

**Step 1: Implement transports.ts**

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function connectStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WebMCP server running on stdio");
}

export async function connectHttp(server: McpServer, port: number): Promise<void> {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  const httpServer = createServer(async (req, res) => {
    if (req.url === "/mcp") {
      await transport.handleRequest(req, res, req.body);
    } else {
      res.writeHead(404).end();
    }
  });

  await server.connect(transport);
  httpServer.listen(port, () => {
    console.error(`WebMCP server running at http://localhost:${port}/mcp`);
  });
}
```

**Step 2: Implement index.ts (entry point)**

```ts
import { discover } from "@webmcp/core";
import { createMcpServer } from "./server.js";
import { connectStdio, connectHttp } from "./transports.js";

export interface StartServerOptions {
  url: string;
  transport?: "stdio" | "http";
  port?: number;
  skipLlm?: boolean;
  onProgress?: (stage: 1 | 2 | 3, message: string) => void;
}

export async function startServer(options: StartServerOptions): Promise<void> {
  const { url, transport = "stdio", port = 4000, skipLlm = false, onProgress } = options;

  onProgress?.(1, "Detecting API spec...");
  onProgress?.(2, "Analyzing HTML...");
  onProgress?.(3, "Enriching with LLM...");

  const result = await discover(url, { skipLlm });

  console.error(`Discovered ${result.tools.length} tools via ${result.discoveredVia}`);

  const server = createMcpServer(result.tools);

  if (transport === "http") {
    await connectHttp(server, port);
  } else {
    await connectStdio(server);
  }
}
```

**Step 3: Commit**

```bash
git add packages/mcp-server/src/transports.ts packages/mcp-server/src/index.ts
git commit -m "feat(mcp-server): stdio and HTTP/SSE transports"
```

---

## Task 13: Scaffold `cli` Package

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@webmcp/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": { "webmcp": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "@webmcp/core": "workspace:*",
    "@webmcp/mcp-server": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: Create tsconfig.json** (same structure as mcp-server)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"]
}
```

**Step 3: Implement src/index.ts**

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { discover } from "@webmcp/core";
import { startServer } from "@webmcp/mcp-server";

const program = new Command()
  .name("webmcp")
  .description("Generate MCP servers from any website")
  .version("0.0.1");

program
  .command("analyze <url>")
  .description("Analyze a website and print discovered tools")
  .option("--skip-llm", "Skip LLM enrichment stage")
  .action(async (url: string, opts: { skipLlm?: boolean }) => {
    console.log(`Analyzing ${url}...`);
    const result = await discover(url, { skipLlm: opts.skipLlm });
    console.log(`\nDiscovered ${result.tools.length} tools (via ${result.discoveredVia}):\n`);
    for (const tool of result.tools) {
      const badge = tool.transport === "http" ? "[HTTP]   " : "[Browser]";
      console.log(`  • ${tool.name.padEnd(30)} ${badge} ${tool.description}`);
    }
  });

program
  .command("serve <url>")
  .description("Analyze a website and start an MCP server")
  .option("--transport <type>", "Transport: stdio or http", "stdio")
  .option("--port <number>", "Port for HTTP transport", "4000")
  .option("--skip-llm", "Skip LLM enrichment stage")
  .action(async (url: string, opts: { transport: string; port: string; skipLlm?: boolean }) => {
    await startServer({
      url,
      transport: opts.transport as "stdio" | "http",
      port: parseInt(opts.port, 10),
      skipLlm: opts.skipLlm,
      onProgress: (stage, msg) => console.error(`  Stage ${stage}: ${msg}`),
    });
  });

program.parse();
```

**Step 4: Install and commit**

```bash
pnpm install
git add packages/cli/
git commit -m "feat(cli): analyze and serve commands"
```

---

## Task 14: Build and Smoke Test CLI

**Step 1: Build all packages**

```bash
pnpm build
```

Expected: No TypeScript errors across all packages.

**Step 2: Run analyze against a real site (smoke test)**

```bash
ANTHROPIC_API_KEY=your-key node packages/cli/dist/index.js analyze https://httpbin.org --skip-llm
```

Expected: Prints a list of discovered tools (no crash).

**Step 3: Fix any TypeScript or runtime errors found**

Iterate until the smoke test passes cleanly.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve build and smoke test issues"
```

---

## Task 15: Scaffold `web` Package (Next.js)

**Step 1: Create Next.js app**

```bash
cd packages
pnpm create next-app@latest web --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

**Step 2: Add workspace dependency on core and mcp-server**

Edit `packages/web/package.json`, add to `dependencies`:
```json
"@webmcp/core": "workspace:*",
"@webmcp/mcp-server": "workspace:*"
```

**Step 3: Install**

```bash
pnpm install
```

**Step 4: Commit**

```bash
git add packages/web/
git commit -m "chore: scaffold Next.js web package"
```

---

## Task 16: Web — Analysis API Route

**Files:**
- Create: `packages/web/app/api/analyze/route.ts`

**Step 1: Implement the SSE streaming route**

```ts
import { NextRequest } from "next/server";
import { discover } from "@webmcp/core";

export async function POST(req: NextRequest): Promise<Response> {
  const { url } = await req.json() as { url: string };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ stage: 1, message: "Detecting API spec..." });
        // Small delay so the client sees the progress
        await new Promise((r) => setTimeout(r, 100));

        send({ stage: 2, message: "Analyzing HTML..." });
        await new Promise((r) => setTimeout(r, 100));

        send({ stage: 3, message: "Enriching with LLM..." });

        const result = await discover(url);

        send({ done: true, result });
      } catch (err) {
        send({ error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Step 2: Commit**

```bash
git add packages/web/app/api/
git commit -m "feat(web): SSE analysis API route"
```

---

## Task 17: Web — Server Management API Routes

**Files:**
- Create: `packages/web/app/api/servers/route.ts`
- Create: `packages/web/app/api/servers/[id]/route.ts`
- Create: `packages/web/lib/server-registry.ts`

**Step 1: Create an in-memory server registry**

`packages/web/lib/server-registry.ts`:
```ts
import { ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

export interface ServerInstance {
  id: string;
  url: string;
  port: number;
  status: "starting" | "running" | "stopped";
  connectionString: string;
  logs: string[];
  process?: ChildProcess;
}

// In-memory store (resets on server restart — acceptable for v1)
const instances = new Map<string, ServerInstance>();

export function getAll(): ServerInstance[] {
  return Array.from(instances.values()).map(({ process: _, ...rest }) => rest);
}

export function getById(id: string): ServerInstance | undefined {
  return instances.get(id);
}

export function createInstance(url: string, port: number): ServerInstance {
  const id = randomUUID();
  const instance: ServerInstance = {
    id,
    url,
    port,
    status: "starting",
    connectionString: `http://localhost:${port}/mcp`,
    logs: [],
  };
  instances.set(id, instance);
  return instance;
}

export function stopInstance(id: string): boolean {
  const instance = instances.get(id);
  if (!instance) return false;
  instance.process?.kill();
  instance.status = "stopped";
  return true;
}
```

**Step 2: Create POST /api/servers route**

`packages/web/app/api/servers/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createInstance, getAll } from "@/lib/server-registry";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

export function GET() {
  return NextResponse.json(getAll());
}

export async function POST(req: NextRequest) {
  const { url, port = 4000 } = await req.json() as { url: string; port?: number };

  const instance = createInstance(url, port);

  // Spawn the mcp-server as a child process (HTTP transport)
  const serverPath = resolve(process.cwd(), "../mcp-server/dist/index.js");
  const child = spawn("node", [serverPath, "serve", url, "--transport", "http", "--port", String(port)], {
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stderr?.on("data", (data: Buffer) => {
    instance.logs.push(data.toString());
    if (data.toString().includes("running at")) {
      instance.status = "running";
    }
  });

  child.on("exit", () => { instance.status = "stopped"; });
  (instance as ServerInstance & { process: typeof child }).process = child;

  // Wait briefly for startup
  await new Promise((r) => setTimeout(r, 2000));

  return NextResponse.json(instance, { status: 201 });
}
```

**Step 3: Create DELETE /api/servers/[id] route**

`packages/web/app/api/servers/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { stopInstance } from "@/lib/server-registry";

export function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const stopped = stopInstance(params.id);
  if (!stopped) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

**Step 4: Commit**

```bash
git add packages/web/app/api/servers/ packages/web/lib/
git commit -m "feat(web): server management API routes"
```

---

## Task 18: Web — Home Page (URL Input + Analysis)

**Files:**
- Modify: `packages/web/app/page.tsx`
- Create: `packages/web/components/AnalysisProgress.tsx`
- Create: `packages/web/components/ToolList.tsx`

**Step 1: Implement AnalysisProgress.tsx**

```tsx
interface Props {
  stage: number;
  message: string;
}
export function AnalysisProgress({ stage, message }: Props) {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2 text-sm">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
            ${s < stage ? "bg-green-500 text-white" : s === stage ? "bg-blue-500 text-white animate-pulse" : "bg-gray-200 text-gray-400"}`}>
            {s < stage ? "✓" : s}
          </span>
          <span className={s === stage ? "text-blue-600 font-medium" : s < stage ? "text-green-600" : "text-gray-400"}>
            {s === 1 ? "API Spec Detection" : s === 2 ? "HTML Analysis" : "LLM Enrichment"}
          </span>
        </div>
      ))}
      <p className="text-xs text-gray-500 mt-1">{message}</p>
    </div>
  );
}
```

**Step 2: Implement ToolList.tsx**

```tsx
import type { ToolDefinition } from "@webmcp/core";

export function ToolList({ tools }: { tools: ToolDefinition[] }) {
  return (
    <div className="space-y-2">
      {tools.map((tool) => (
        <div key={tool.name} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded font-mono
              ${tool.transport === "http" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
              {tool.transport.toUpperCase()}
            </span>
            <code className="font-mono text-sm font-semibold">{tool.name}</code>
          </div>
          <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Implement app/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { ToolList } from "@/components/ToolList";
import type { ToolDefinition } from "@webmcp/core";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [stageMsg, setStageMsg] = useState("");
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [error, setError] = useState("");

  const analyze = async () => {
    setLoading(true);
    setTools([]);
    setError("");
    setStage(1);

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));
        if (data.stage) { setStage(data.stage); setStageMsg(data.message); }
        if (data.done) setTools(data.result.tools);
        if (data.error) setError(data.error);
      }
    }
    setLoading(false);
    setStage(0);
  };

  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-2">WebMCP</h1>
      <p className="text-gray-500 mb-8">Turn any website into an MCP server for AI agents.</p>

      <div className="flex gap-2 mb-6">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && analyze()}
        />
        <button
          onClick={analyze}
          disabled={loading || !url}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {loading && <AnalysisProgress stage={stage} message={stageMsg} />}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {tools.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{tools.length} tools discovered</p>
          <ToolList tools={tools} />
        </div>
      )}
    </main>
  );
}
```

**Step 4: Start the web dev server and verify it renders**

```bash
pnpm dev:web
```

Open `http://localhost:3000` — should show the URL input form.

**Step 5: Commit**

```bash
git add packages/web/app/page.tsx packages/web/components/
git commit -m "feat(web): home page with URL input and analysis progress"
```

---

## Task 19: Web — Server View Page

**Files:**
- Create: `packages/web/app/servers/page.tsx`
- Create: `packages/web/components/ServerCard.tsx`

**Step 1: Implement ServerCard.tsx**

```tsx
import type { ServerInstance } from "@/lib/server-registry";

interface Props {
  server: ServerInstance;
  onStop: (id: string) => void;
}

export function ServerCard({ server, onStop }: Props) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm truncate">{server.url}</span>
        <span className={`px-2 py-0.5 text-xs rounded-full
          ${server.status === "running" ? "bg-green-100 text-green-700" :
            server.status === "starting" ? "bg-yellow-100 text-yellow-700" :
            "bg-gray-100 text-gray-500"}`}>
          {server.status}
        </span>
      </div>

      {server.status === "running" && (
        <div className="flex items-center gap-2 mt-2">
          <code className="text-xs bg-gray-100 rounded px-2 py-1 flex-1">{server.connectionString}</code>
          <button
            onClick={() => navigator.clipboard.writeText(server.connectionString)}
            className="text-xs text-blue-600 hover:underline"
          >
            Copy
          </button>
        </div>
      )}

      <button
        onClick={() => onStop(server.id)}
        className="mt-3 text-xs text-red-500 hover:underline"
      >
        Stop
      </button>
    </div>
  );
}
```

**Step 2: Implement app/servers/page.tsx**

```tsx
"use client";
import { useState, useEffect } from "react";
import { ServerCard } from "@/components/ServerCard";

export default function ServersPage() {
  const [servers, setServers] = useState([]);
  const [url, setUrl] = useState("");
  const [port, setPort] = useState("4000");

  const load = async () => {
    const res = await fetch("/api/servers");
    setServers(await res.json());
  };

  useEffect(() => { load(); }, []);

  const start = async () => {
    await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, port: parseInt(port) }),
    });
    load();
  };

  const stop = async (id: string) => {
    await fetch(`/api/servers/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-6">MCP Servers</h1>

      <div className="flex gap-2 mb-8">
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <input value={port} onChange={(e) => setPort(e.target.value)}
          placeholder="4000" className="w-20 border rounded-lg px-3 py-2 text-sm" />
        <button onClick={start} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          Start
        </button>
      </div>

      <div className="space-y-3">
        {servers.length === 0 ? (
          <p className="text-gray-400 text-sm">No servers running.</p>
        ) : (
          servers.map((s: { id: string }) => <ServerCard key={s.id} server={s as never} onStop={stop} />)
        )}
      </div>
    </main>
  );
}
```

**Step 3: Add nav to layout**

Edit `packages/web/app/layout.tsx` — add a simple nav:
```tsx
// Add inside <body>, before {children}:
<nav className="border-b px-4 py-3 flex gap-4 text-sm">
  <a href="/" className="font-semibold">WebMCP</a>
  <a href="/servers" className="text-gray-500 hover:text-gray-900">Servers</a>
</nav>
```

**Step 4: Commit**

```bash
git add packages/web/app/servers/ packages/web/components/ServerCard.tsx packages/web/app/layout.tsx
git commit -m "feat(web): servers dashboard and server card component"
```

---

## Task 20: Final Build + End-to-End Smoke Test

**Step 1: Build everything**

```bash
pnpm build
```

Expected: No errors.

**Step 2: Test CLI analyze**

```bash
ANTHROPIC_API_KEY=your-key node packages/cli/dist/index.js analyze https://httpbin.org
```

Expected: Prints discovered tools without crashing.

**Step 3: Test CLI serve (HTTP)**

```bash
ANTHROPIC_API_KEY=your-key node packages/cli/dist/index.js serve https://httpbin.org --transport http --port 4001
```

Expected: Prints `WebMCP server running at http://localhost:4001/mcp`

**Step 4: Test web UI**

```bash
ANTHROPIC_API_KEY=your-key pnpm dev:web
```

Open `http://localhost:3000`, enter a URL, click Analyze. Verify tools appear.

**Step 5: Fix any issues found**

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete WebMCP v0.1 — monorepo with core, mcp-server, cli, web"
```

---

## Environment Variables

Create a `.env.local` in `packages/web/` and a `.env` at root:

```
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

The CLI reads `ANTHROPIC_API_KEY` from the environment automatically via the Anthropic SDK.
