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

  it("returns empty array when LLM call rejects", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("network error")),
      },
    };
    const result = await enrichWithLlm([], "https://example.com", "", mockClient as never);
    expect(result).toEqual([]);
  });

  it("handles LLM response with JSON array wrapped in prose", async () => {
    const mockTools = [{ name: "search", description: "Search", inputSchema: { type: "object", properties: {} }, transport: "http" }];
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: `Here are the tools: ${JSON.stringify(mockTools)} Let me know if you need changes.` }],
        }),
      },
    };
    const result = await enrichWithLlm([], "https://example.com", "", mockClient as never);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("search");
  });
});
