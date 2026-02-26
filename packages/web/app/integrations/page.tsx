"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationRecord {
  name: string;
  url: string;
  description?: string;
  toolCount: number;
  connectedAt: string;
  status: "connected" | "error" | "saved";
  error?: string;
  notes: string;
  isLive: boolean;
  savedAt?: string;
  lastStatus?: "connected" | "error";
}

interface ToolDefinition {
  name: string;
  description: string;
  transport: "http" | "browser";
}

// ---------------------------------------------------------------------------
// NotesEditor — debounced auto-save with visual feedback
// ---------------------------------------------------------------------------

function NotesEditor({
  integration,
  onSaved,
}: {
  integration: IntegrationRecord;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(integration.notes ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        await fetch(`/api/integrations/${integration.name}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: value }),
        });
        setSaveState("saved");
        onSaved();
        setTimeout(() => setSaveState("idle"), 2500);
      } catch {
        setSaveState("idle");
      }
    },
    [integration.name, onSaved]
  );

  const handleChange = (value: string) => {
    setNotes(value);
    setSaveState("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(value), 800);
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-gray-400">
          Notes
        </span>
        <span
          className={`text-[11px] transition-opacity duration-300 ${
            saveState === "saving"
              ? "text-gray-400 opacity-100"
              : saveState === "saved"
              ? "text-emerald-500 opacity-100"
              : "opacity-0"
          }`}
        >
          {saveState === "saving" ? "Saving…" : "✓ Saved"}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add notes, credentials hints, integration details…"
        rows={3}
        className="w-full text-xs border border-amber-100 rounded-lg px-3 py-2 resize-none bg-amber-50/40
          placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-200
          focus:border-amber-300 transition-all leading-relaxed text-gray-700"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status indicator dot
// ---------------------------------------------------------------------------

function StatusDot({ status, isLive }: { status: IntegrationRecord["status"]; isLive: boolean }) {
  if (isLive && status === "connected") {
    return (
      <span className="relative inline-flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
    );
  }
  if (status === "error") {
    return <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-amber-300 shrink-0" />;
}

// ---------------------------------------------------------------------------
// ToolCallPanel — ready-to-use call snippet for this integration
// ---------------------------------------------------------------------------

function ToolCallPanel({ integrationName }: { integrationName: string }) {
  const [copied, setCopied] = useState(false);

  const snippet = `const res = await fetch("/api/integrations/${integrationName}/call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tool: "tool_name",
    params: { key: "value" },
  }),
});
const { result } = await res.json();`;

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-gray-400">
          Tool Call
        </span>
        <span className="text-[11px] text-gray-300">
          replace <code className="font-mono">tool_name</code> and <code className="font-mono">params</code>
        </span>
      </div>
      <div className="relative group">
        <pre className="bg-gray-900 text-gray-200 rounded-lg px-3 py-2.5 overflow-x-auto leading-relaxed font-mono text-[11px]">
          <code>{snippet}</code>
        </pre>
        <button
          onClick={copy}
          className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded transition-all ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-gray-700 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-600"
          }`}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolEntry — tool metadata + copy-able code snippet
// ---------------------------------------------------------------------------

function ToolEntry({
  tool,
  integrationName,
}: {
  tool: ToolDefinition;
  integrationName: string;
}) {
  const [copied, setCopied] = useState(false);

  const snippet = `const res = await fetch("/api/integrations/${integrationName}/call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tool: "${tool.name}",
    params: {},
  }),
});
const { result } = await res.json();`;

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="text-xs">
      {/* Tool header */}
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
            tool.transport === "http"
              ? "bg-blue-50 text-blue-500 border border-blue-100"
              : "bg-purple-50 text-purple-500 border border-purple-100"
          }`}
        >
          {tool.transport}
        </span>
        <div className="min-w-0">
          <code className="font-semibold text-gray-800">{tool.name}</code>
          {tool.description && (
            <p className="text-gray-400 mt-0.5 leading-relaxed">{tool.description}</p>
          )}
        </div>
      </div>
      {/* Code snippet */}
      <div className="relative group">
        <pre className="bg-gray-900 text-gray-200 rounded-lg px-3 py-2.5 overflow-x-auto leading-relaxed font-mono text-[11px]">
          <code>{snippet}</code>
        </pre>
        <button
          onClick={copy}
          className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded transition-all ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-gray-700 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-600"
          }`}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntegrationCard
// ---------------------------------------------------------------------------

function IntegrationCard({
  integration,
  onRefresh,
  onRemove,
  onReconnect,
  reconnecting,
}: {
  integration: IntegrationRecord;
  onRefresh: () => void;
  onRemove: (name: string) => void;
  onReconnect: (i: IntegrationRecord) => void;
  reconnecting: boolean;
}) {
  const [tools, setTools] = useState<ToolDefinition[] | null>(null);
  const [toolsIsStored, setToolsIsStored] = useState(false);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolCallOpen, setToolCallOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const isLive = integration.isLive && integration.status === "connected";
  const isError = integration.status === "error";
  const isSavedOffline = !integration.isLive;

  const toggleTools = async () => {
    if (tools) {
      setTools(null);
      setToolsIsStored(false);
      return;
    }
    setToolsLoading(true);
    try {
      const res = await fetch(`/api/integrations/${integration.name}`);
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools);
        setToolsIsStored(!!data.isStored);
      }
    } catch {
      /* silently fail */
    } finally {
      setToolsLoading(false);
    }
  };

  const borderColor = isLive
    ? "border-l-emerald-400"
    : isError
    ? "border-l-red-400"
    : "border-l-amber-300";

  return (
    <div
      className={`border border-l-4 ${borderColor} rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusDot status={integration.status} isLive={integration.isLive} />
              <span className="font-semibold text-sm text-gray-900">{integration.name}</span>

              {isLive && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                  {integration.toolCount} tool{integration.toolCount !== 1 ? "s" : ""} · live
                </span>
              )}
              {isError && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-50 text-red-600 border border-red-100 font-medium">
                  error
                </span>
              )}
              {isSavedOffline && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                  saved
                  {integration.lastStatus === "connected" && integration.toolCount > 0
                    ? ` · ${integration.toolCount} tools`
                    : ""}
                </span>
              )}
              {integration.notes?.trim() && (
                <span
                  title="Has notes"
                  className="text-amber-400 text-xs select-none"
                >
                  ✦
                </span>
              )}
            </div>

            {/* URL */}
            <p className="text-[11px] text-gray-400 mt-1 truncate font-mono">{integration.url}</p>

            {/* Description */}
            {integration.description && (
              <p className="text-xs text-gray-500 mt-0.5">{integration.description}</p>
            )}

            {/* Error message */}
            {integration.error && (
              <p className="text-[11px] text-red-400 mt-1 font-mono leading-relaxed">
                {integration.error}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            <button
              onClick={() => setToolCallOpen((o) => !o)}
              className={`text-xs transition-colors ${
                toolCallOpen
                  ? "text-violet-600 font-medium"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              tool call
            </button>
            {integration.toolCount > 0 && (
              <button
                onClick={toggleTools}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                {toolsLoading ? "…" : tools ? "hide tools" : "tools"}
              </button>
            )}
            <button
              onClick={() => setNotesOpen((o) => !o)}
              className={`text-xs transition-colors ${
                notesOpen
                  ? "text-amber-500 font-medium"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              notes
            </button>
            {isSavedOffline && (
              <button
                onClick={() => onReconnect(integration)}
                disabled={reconnecting}
                className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50 transition-colors"
              >
                {reconnecting ? "connecting…" : "reconnect"}
              </button>
            )}
            <button
              onClick={() => onRemove(integration.name)}
              aria-label={`Remove ${integration.name}`}
              className="text-xs text-gray-300 hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tool call panel */}
        {toolCallOpen && (
          <ToolCallPanel integrationName={integration.name} />
        )}

        {/* Expanded tools */}
        {tools && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
            {toolsIsStored && (
              <p className="text-[11px] text-amber-500 flex items-center gap-1">
                <span>⚡</span>
                <span>Last known tools — reconnect to refresh</span>
              </p>
            )}
            {tools.map((tool) => (
              <ToolEntry
                key={tool.name}
                tool={tool}
                integrationName={integration.name}
              />
            ))}
          </div>
        )}

        {/* Notes */}
        {notesOpen && <NotesEditor integration={integration} onSaved={onRefresh} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Add-integration form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [reconnectingName, setReconnectingName] = useState<string | null>(null);
  const [addError, setAddError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) setIntegrations(await res.json());
    } catch {
      setPageError("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Connect a new integration or reconnect a saved one */
  const connect = async (config?: {
    name: string;
    url: string;
    description?: string;
  }) => {
    const n = config?.name ?? name.trim();
    const u = config?.url ?? url.trim();
    const d = config?.description ?? (description.trim() || undefined);

    if (!n || !u) return;

    if (config) {
      setReconnectingName(n);
    } else {
      setConnecting(true);
      setAddError("");
    }

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, url: u, description: d }),
      });
      const data = await res.json();
      if (res.status >= 400) {
        if (!config) setAddError(data.error ?? "Failed to connect");
        return;
      }
      if (!config) {
        setName("");
        setUrl("");
        setDescription("");
      }
      await load();
    } catch {
      if (!config) setAddError("Network error — could not connect");
    } finally {
      setConnecting(false);
      setReconnectingName(null);
    }
  };

  const remove = async (integrationName: string) => {
    try {
      await fetch(`/api/integrations/${integrationName}`, { method: "DELETE" });
      await load();
    } catch {
      setPageError("Failed to remove integration");
    }
  };

  // Derived stats
  const liveCount = integrations.filter((i) => i.isLive && i.status === "connected").length;
  const savedCount = integrations.length;
  const withNotesCount = integrations.filter((i) => i.notes?.trim()).length;

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">
          Integrations
        </h1>
        <p className="text-sm text-gray-500">
          Connect external sites, discover their tools, and call them from your application.
          All integrations are saved and survive server restarts.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      {savedCount > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            {
              label: "Total saved",
              value: savedCount,
              valueClass: "text-gray-900",
            },
            {
              label: "Live now",
              value: liveCount,
              valueClass: liveCount > 0 ? "text-emerald-600" : "text-gray-300",
            },
            {
              label: "With notes",
              value: withNotesCount,
              valueClass: withNotesCount > 0 ? "text-amber-500" : "text-gray-300",
            },
          ].map(({ label, value, valueClass }) => (
            <div
              key={label}
              className="border rounded-xl px-4 py-3 bg-white shadow-sm"
            >
              <div className={`text-2xl font-bold tabular-nums ${valueClass}`}>
                {value}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 font-medium tracking-wide uppercase">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add integration form                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="border rounded-xl p-5 mb-8 bg-white shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Connect a site</h2>
        <div className="space-y-2.5">
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Integration name"
              className="border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300
                transition-all placeholder:text-gray-300"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              aria-label="Site URL"
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !connecting &&
                name.trim() &&
                url.trim() &&
                connect()
              }
              className="border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300
                transition-all placeholder:text-gray-300"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Description"
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300
                transition-all placeholder:text-gray-300"
            />
            <button
              onClick={() => connect()}
              disabled={connecting || !name.trim() || !url.trim()}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium
                disabled:opacity-40 hover:bg-gray-700 active:scale-95 transition-all
                whitespace-nowrap"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </div>
        </div>
        {addError && <p className="text-red-500 text-xs mt-2.5">{addError}</p>}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Integrations list                                                   */}
      {/* ------------------------------------------------------------------ */}
      {pageError && (
        <p className="text-red-500 text-sm mb-4">{pageError}</p>
      )}

      {loading ? (
        /* Skeleton */
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-xl p-4 animate-pulse bg-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-gray-100" />
                <div className="h-4 bg-gray-100 rounded w-28" />
                <div className="h-4 bg-gray-100 rounded w-16" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-64" />
            </div>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        /* Empty state */
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">No integrations yet.</p>
          <p className="text-gray-300 text-xs mt-1">
            Connect your first site above — it will be saved automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.name}
              integration={integration}
              onRefresh={load}
              onRemove={remove}
              onReconnect={connect}
              reconnecting={reconnectingName === integration.name}
            />
          ))}
        </div>
      )}

    </main>
  );
}
