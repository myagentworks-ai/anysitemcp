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
