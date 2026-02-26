"use client";
import { useState, useEffect, useCallback } from "react";

interface IntegrationSummary {
  name: string;
  url: string;
  description?: string;
  toolCount: number;
  connectedAt: string;
  status: "connected" | "error";
  error?: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  transport: "http" | "browser";
}

interface ToolsDetail {
  tools: ToolDefinition[];
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [addError, setAddError] = useState("");

  // Expanded tools per card
  const [expandedTools, setExpandedTools] = useState<Record<string, ToolDefinition[]>>({});
  const [expandLoading, setExpandLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) setIntegrations(await res.json());
    } catch {
      setError("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    if (!name.trim() || !url.trim()) return;
    setConnecting(true);
    setAddError("");
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 200) {
        setAddError(data.error ?? "Failed to connect");
        return;
      }
      setName("");
      setUrl("");
      setDescription("");
      await load();
    } catch {
      setAddError("Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const remove = async (integrationName: string) => {
    try {
      await fetch(`/api/integrations/${integrationName}`, { method: "DELETE" });
      setExpandedTools((prev) => { const next = { ...prev }; delete next[integrationName]; return next; });
      await load();
    } catch {
      setError("Failed to remove integration");
    }
  };

  const toggleTools = async (integrationName: string) => {
    if (expandedTools[integrationName]) {
      setExpandedTools((prev) => { const next = { ...prev }; delete next[integrationName]; return next; });
      return;
    }
    setExpandLoading((prev) => ({ ...prev, [integrationName]: true }));
    try {
      const res = await fetch(`/api/integrations/${integrationName}`);
      if (res.ok) {
        const data: ToolsDetail = await res.json();
        setExpandedTools((prev) => ({ ...prev, [integrationName]: data.tools }));
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setExpandLoading((prev) => ({ ...prev, [integrationName]: false }));
    }
  };

  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-2">Integrations</h1>
      <p className="text-gray-500 text-sm mb-8">Connect to external sites and call their tools from your application.</p>

      {/* Add Integration */}
      <div className="border rounded-lg p-4 mb-8 bg-gray-50">
        <h2 className="text-sm font-semibold mb-3">Connect a site</h2>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. shopify)"
              aria-label="Integration name"
              className="w-36 border rounded-lg px-3 py-2 text-sm bg-white"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              aria-label="Site URL"
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Description"
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            />
            <button
              onClick={connect}
              disabled={connecting || !name.trim() || !url.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>
        {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
      </div>

      {/* List */}
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="space-y-3">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : integrations.length === 0 ? (
          <p className="text-gray-400 text-sm">No integrations yet. Connect a site above.</p>
        ) : (
          integrations.map((integration) => (
            <div key={integration.name} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{integration.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      integration.status === "connected"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {integration.status === "connected" ? `${integration.toolCount} tools` : "error"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{integration.url}</p>
                  {integration.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{integration.description}</p>
                  )}
                  {integration.error && (
                    <p className="text-xs text-red-500 mt-1">{integration.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {integration.status === "connected" && integration.toolCount > 0 && (
                    <button
                      onClick={() => toggleTools(integration.name)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {expandLoading[integration.name]
                        ? "Loading..."
                        : expandedTools[integration.name]
                        ? "Hide tools"
                        : "View tools"}
                    </button>
                  )}
                  <button
                    onClick={() => remove(integration.name)}
                    aria-label={`Remove ${integration.name}`}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Expanded tools */}
              {expandedTools[integration.name] && (
                <div className="mt-3 space-y-1.5 border-t pt-3">
                  {expandedTools[integration.name].map((tool) => (
                    <div key={tool.name} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded font-mono uppercase ${
                        tool.transport === "http"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {tool.transport}
                      </span>
                      <div>
                        <code className="font-semibold">{tool.name}</code>
                        <p className="text-gray-500 mt-0.5">{tool.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Usage snippet */}
      {integrations.some((i) => i.status === "connected") && (
        <div className="mt-8 border rounded-lg p-4 bg-gray-50">
          <h2 className="text-sm font-semibold mb-2">Call a tool from your app</h2>
          <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-x-auto"><code>{`// POST /api/integrations/{name}/call
fetch("/api/integrations/${integrations.find((i) => i.status === "connected")?.name ?? "mysite"}/call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tool: "tool_name",
    params: { key: "value" }
  })
})`}</code></pre>
        </div>
      )}
    </main>
  );
}
