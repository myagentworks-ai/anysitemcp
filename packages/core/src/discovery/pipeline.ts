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
