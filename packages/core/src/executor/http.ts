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
