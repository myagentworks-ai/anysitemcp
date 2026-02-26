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
