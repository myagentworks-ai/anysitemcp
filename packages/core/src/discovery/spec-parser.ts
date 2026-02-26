import type { ToolDefinition, JSONSchema } from "../types.js";

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/[^a-z0-9_]/g, "_");
}

export function parseOpenApiSpec(
  spec: Record<string, unknown>,
  baseUrl: string
): ToolDefinition[] {
  // Validate baseUrl upfront so callers get a descriptive error immediately.
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    throw new Error(`parseOpenApiSpec: invalid baseUrl "${baseUrl}"`);
  }

  const tools: ToolDefinition[] = [];
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;

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
        inputSchema: {
          type: "object",
          properties,
          ...(required.length ? { required } : {}),
        },
        transport: "http",
        httpConfig: {
          url: `${origin}${path}`,
          method: method.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
          paramMapping: Object.fromEntries(params.map((p) => [p.name as string, p.name as string])),
        },
      });
    }
  }

  return tools;
}
