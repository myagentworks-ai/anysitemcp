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
