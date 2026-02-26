import { describe, it, expect } from "vitest";
import { parseOpenApiSpec } from "../spec-parser.js";

// ---------------------------------------------------------------------------
// toSnakeCase is not exported, so we exercise it indirectly through operationId
// and through the `name` field of the returned ToolDefinition.
// ---------------------------------------------------------------------------

describe("parseOpenApiSpec", () => {
  // -------------------------------------------------------------------------
  // Original tests (must still pass)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Issue #3 – PATCH support
  // -------------------------------------------------------------------------

  it("converts a PATCH endpoint to a tool definition with method PATCH", () => {
    const spec = {
      paths: {
        "/users/{id}": {
          patch: {
            operationId: "updateUser",
            summary: "Partially update a user",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools).toHaveLength(1);
    expect(tools[0].httpConfig?.method).toBe("PATCH");
    expect(tools[0].name).toBe("update_user");
  });

  // -------------------------------------------------------------------------
  // Issue #4 – POST method conversion
  // -------------------------------------------------------------------------

  it("converts a POST endpoint and sets method to POST in httpConfig", () => {
    const spec = {
      paths: {
        "/items": {
          post: {
            operationId: "createItem",
            summary: "Create an item",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools).toHaveLength(1);
    expect(tools[0].httpConfig?.method).toBe("POST");
  });

  // -------------------------------------------------------------------------
  // Issue #4 – Missing operationId falls back to auto-generated name
  // -------------------------------------------------------------------------

  it("generates a name from method + path when operationId is missing", () => {
    const spec = {
      paths: {
        "/products/list": {
          get: {
            summary: "List products",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools).toHaveLength(1);
    // operationId absent → `get__products_list` → toSnakeCase → `get__products_list`
    // The auto-generated id is `get_/products/list` with slashes replaced by underscores.
    // After toSnakeCase the leading/non-alnum chars become underscores.
    expect(tools[0].name).toMatch(/get/);
    expect(tools[0].name).toMatch(/products/);
    expect(tools[0].name).toMatch(/list/);
  });

  // -------------------------------------------------------------------------
  // Issue #4 – Missing summary/description falls back to path string
  // -------------------------------------------------------------------------

  it("falls back to path string when summary and description are both absent", () => {
    const spec = {
      paths: {
        "/health": {
          get: {
            operationId: "healthCheck",
            parameters: [],
            // no summary, no description
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("/health");
  });

  it("prefers summary over description", () => {
    const spec = {
      paths: {
        "/ping": {
          get: {
            operationId: "ping",
            summary: "Ping the server",
            description: "A longer description",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools[0].description).toBe("Ping the server");
  });

  it("uses description when summary is absent", () => {
    const spec = {
      paths: {
        "/ping": {
          get: {
            operationId: "ping",
            description: "A longer description",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools[0].description).toBe("A longer description");
  });

  // -------------------------------------------------------------------------
  // Issue #4 – Optional parameters are NOT in inputSchema.required
  // -------------------------------------------------------------------------

  it("does not include optional parameters in inputSchema.required", () => {
    const spec = {
      paths: {
        "/search": {
          get: {
            operationId: "search",
            parameters: [
              { name: "q", in: "query", required: true, schema: { type: "string" } },
              { name: "limit", in: "query", required: false, schema: { type: "integer" } },
              { name: "offset", in: "query", schema: { type: "integer" } }, // no `required` field
            ],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");
    const req = tools[0].inputSchema.required ?? [];

    expect(req).toContain("q");
    expect(req).not.toContain("limit");
    expect(req).not.toContain("offset");
  });

  // -------------------------------------------------------------------------
  // Issue #6 – Empty required array is omitted from inputSchema
  // -------------------------------------------------------------------------

  it("omits required from inputSchema when no parameters are required", () => {
    const spec = {
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
            parameters: [
              { name: "page", in: "query", required: false, schema: { type: "integer" } },
            ],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    expect(tools[0].inputSchema).not.toHaveProperty("required");
  });

  // -------------------------------------------------------------------------
  // Issue #4 – Non-allowed HTTP methods are skipped
  // -------------------------------------------------------------------------

  it("skips non-allowed HTTP methods such as HEAD", () => {
    const spec = {
      paths: {
        "/health": {
          head: {
            operationId: "healthHead",
            parameters: [],
          },
          get: {
            operationId: "healthGet",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");

    // Only GET should be converted; HEAD must be skipped.
    expect(tools).toHaveLength(1);
    expect(tools[0].httpConfig?.method).toBe("GET");
  });

  it("skips OPTIONS method", () => {
    const spec = {
      paths: {
        "/items": {
          options: {
            operationId: "optionsItems",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");
    expect(tools).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Issue #2 – Invalid baseUrl throws a descriptive error
  // -------------------------------------------------------------------------

  it("throws a descriptive error for an invalid baseUrl", () => {
    const spec = { paths: {} };
    expect(() => parseOpenApiSpec(spec, "not-a-valid-url")).toThrow(
      /invalid baseUrl/
    );
  });

  it("throws for an empty baseUrl string", () => {
    const spec = { paths: {} };
    expect(() => parseOpenApiSpec(spec, "")).toThrow(/invalid baseUrl/);
  });

  // -------------------------------------------------------------------------
  // Issue #1 – toSnakeCase edge cases (exercised via operationId / name)
  // -------------------------------------------------------------------------

  it("handles consecutive uppercase letters in operationId (e.g. parseHTTPRequest)", () => {
    const spec = {
      paths: {
        "/req": {
          get: {
            operationId: "parseHTTPRequest",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");
    // "parseHTTPRequest" → "parse_http_request"
    expect(tools[0].name).toBe("parse_http_request");
  });

  it("handles operationId with non-alphanumeric characters", () => {
    const spec = {
      paths: {
        "/req": {
          get: {
            operationId: "get-user.profile",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");
    // hyphens and dots become underscores
    expect(tools[0].name).toBe("get_user_profile");
  });

  it("handles operationId that starts with an uppercase letter", () => {
    const spec = {
      paths: {
        "/req": {
          get: {
            operationId: "GetUser",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");
    // Leading underscore should be stripped
    expect(tools[0].name).toBe("get_user");
    expect(tools[0].name).not.toMatch(/^_/);
  });

  it("handles operationId with mixed non-alphanumeric chars and consecutive caps", () => {
    const spec = {
      paths: {
        "/req": {
          get: {
            operationId: "fetchAPIResponse",
            parameters: [],
          },
        },
      },
    };

    const tools = parseOpenApiSpec(spec, "https://api.example.com");
    // "fetchAPIResponse" → "fetch_api_response"
    expect(tools[0].name).toBe("fetch_api_response");
  });

  // -------------------------------------------------------------------------
  // URL construction uses only the origin (strips path/query from baseUrl)
  // -------------------------------------------------------------------------

  it("strips trailing path from baseUrl when constructing endpoint URL", () => {
    const spec = {
      paths: {
        "/users": {
          get: {
            operationId: "listUsers",
            parameters: [],
          },
        },
      },
    };

    // baseUrl contains a path component – only the origin should be used.
    const tools = parseOpenApiSpec(spec, "https://api.example.com/v1/ignored");
    expect(tools[0].httpConfig?.url).toBe("https://api.example.com/users");
  });
});
