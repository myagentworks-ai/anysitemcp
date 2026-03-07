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

interface JSONSchema {
  type: string;
  properties?: Record<string, { type: string; description?: string }>;
  required?: string[];
}

interface RunningServer {
  id: string;
  url: string;
  connectionString: string;
  status: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  transport: "http" | "browser";
  inputSchema?: JSONSchema;
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
    <div className="mt-3 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 dark:text-slate-500">
          Notes
        </span>
        <span
          className={`text-[11px] transition-opacity duration-300 ${
            saveState === "saving"
              ? "text-slate-400 opacity-100"
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
        className="w-full text-xs border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2 resize-none
          bg-amber-50/60 dark:bg-amber-950/20
          placeholder:text-slate-300 dark:placeholder:text-slate-600
          focus:outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/50
          focus:border-amber-300 dark:focus:border-amber-800
          transition-all leading-relaxed text-slate-700 dark:text-slate-300"
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
  return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />;
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
    <div className="mt-3 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 dark:text-slate-500">
          Tool Call
        </span>
        <span className="text-[11px] text-slate-300 dark:text-slate-600">
          replace <code className="font-mono">tool_name</code> and <code className="font-mono">params</code>
        </span>
      </div>
      <div className="relative group">
        <pre className="bg-slate-950 text-slate-200 rounded-lg px-3 py-2.5 overflow-x-auto leading-relaxed font-mono text-[11px]">
          <code>{snippet}</code>
        </pre>
        <button
          onClick={copy}
          className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-slate-700 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-600"
          }`}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolEntry — tool metadata + params table + copy-able code snippet
// ---------------------------------------------------------------------------

function defaultForType(type: string): string {
  switch (type) {
    case "number":
    case "integer":
      return "0";
    case "boolean":
      return "false";
    case "array":
      return "[]";
    case "object":
      return "{}";
    default:
      return '""';
  }
}

function buildParamsSnippet(schema: JSONSchema | undefined): string {
  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    return "{}";
  }
  const lines = Object.entries(schema.properties).map(([key, prop]) => {
    const isRequired = schema.required?.includes(key) ?? false;
    const comment = isRequired
      ? "  // required"
      : prop.description
      ? `  // ${prop.description}`
      : "";
    return `      ${key}: ${defaultForType(prop.type)},${comment}`;
  });
  return `{\n${lines.join("\n")}\n    }`;
}

function ToolEntry({
  tool,
  integrationName,
}: {
  tool: ToolDefinition;
  integrationName: string;
}) {
  const [copied, setCopied] = useState(false);

  const paramsSnippet = buildParamsSnippet(tool.inputSchema);
  const hasParams =
    !!tool.inputSchema?.properties &&
    Object.keys(tool.inputSchema.properties).length > 0;

  const snippet = `const res = await fetch("/api/integrations/${integrationName}/call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tool: "${tool.name}",
    params: ${paramsSnippet},
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
              ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900"
              : "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900"
          }`}
        >
          {tool.transport}
        </span>
        <div className="min-w-0">
          <code className="font-semibold text-slate-800 dark:text-slate-200">{tool.name}</code>
          {tool.description && (
            <p className="text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{tool.description}</p>
          )}
        </div>
      </div>

      {/* Parameters table */}
      {hasParams && (
        <div className="mb-2.5 overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="pb-1 pr-4 font-medium">Parameter</th>
                <th className="pb-1 pr-4 font-medium">Type</th>
                <th className="pb-1 pr-4 font-medium">Req</th>
                <th className="pb-1 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tool.inputSchema!.properties!).map(([key, prop]) => {
                const isRequired = tool.inputSchema?.required?.includes(key) ?? false;
                return (
                  <tr key={key} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-1 pr-4 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{key}</td>
                    <td className="py-1 pr-4 font-mono text-sky-600 dark:text-sky-400 whitespace-nowrap">{prop.type}</td>
                    <td className="py-1 pr-4">
                      {isRequired ? (
                        <span className="text-red-400 font-semibold">✓</span>
                      ) : (
                        <span className="text-slate-200 dark:text-slate-700">—</span>
                      )}
                    </td>
                    <td className="py-1 text-slate-400 dark:text-slate-500">{prop.description ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Code snippet */}
      <div className="relative group">
        <pre className="bg-slate-950 text-slate-200 rounded-lg px-3 py-2.5 overflow-x-auto leading-relaxed font-mono text-[11px]">
          <code>{snippet}</code>
        </pre>
        <button
          onClick={copy}
          className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-slate-700 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-600"
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
  runningServer,
  onRefresh,
  onRemove,
  onReconnect,
  reconnecting,
}: {
  integration: IntegrationRecord;
  runningServer: RunningServer | null;
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
  const [mcpServer, setMcpServer] = useState<{
    id: string;
    connectionString: string;
    status: string;
  } | null>(null);
  const [mcpStarting, setMcpStarting] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);

  // Sync running server state from parent polling — keeps card in sync when
  // navigating away/back, or when a server is stopped from the Servers page.
  useEffect(() => {
    if (runningServer && runningServer.status !== "stopped") {
      setMcpServer({
        id: runningServer.id,
        connectionString: runningServer.connectionString,
        status: runningServer.status,
      });
    } else if (!mcpStarting) {
      setMcpServer(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningServer]);

  const isLive = integration.isLive && integration.status === "connected";
  const isError = integration.status === "error";
  const isSavedOffline = !integration.isLive;

  const startMcp = async () => {
    setMcpStarting(true);
    try {
      const port = 4000 + Math.floor(Math.random() * 900);
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: integration.url, port }),
      });
      const data = await res.json();
      if (res.ok) {
        setMcpServer({
          id: data.id,
          connectionString: data.connectionString,
          status: data.status,
        });
        // Auto-load tools when MCP starts
        if (!tools) {
          setToolsLoading(true);
          try {
            const toolsRes = await fetch(`/api/integrations/${integration.name}`);
            if (toolsRes.ok) {
              const td = await toolsRes.json();
              setTools(td.tools ?? []);
              setToolsIsStored(!!td.isStored);
            }
          } catch { /* silently fail */ }
          finally { setToolsLoading(false); }
        }
      }
    } catch {
      /* silently fail */
    } finally {
      setMcpStarting(false);
    }
  };

  const stopMcp = async () => {
    if (!mcpServer) return;
    await fetch(`/api/servers/${mcpServer.id}`, { method: "DELETE" });
    setMcpServer(null);
  };

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

  // Use inline style for left border color to prevent dark:border-* shorthand override
  const lBorderColor = isLive ? "#4ade80" : isError ? "#f87171" : "#fbbf24";

  return (
    <div
      className="border border-l-4 border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm hover:shadow-md dark:hover:shadow-none transition-shadow"
      style={{ borderLeftColor: lBorderColor }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusDot status={integration.status} isLive={integration.isLive} />
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{integration.name}</span>

              {isLive && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 font-medium">
                  {integration.toolCount} tool{integration.toolCount !== 1 ? "s" : ""} · live
                </span>
              )}
              {isError && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 font-medium">
                  error
                </span>
              )}
              {isSavedOffline && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 font-medium">
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
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate font-mono">{integration.url}</p>

            {/* Description */}
            {integration.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{integration.description}</p>
            )}

            {/* Error message */}
            {integration.error && (
              <p className="text-[11px] text-red-400 mt-1 font-mono leading-relaxed">
                {integration.error}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5 flex-wrap">
            {/* Code snippet toggle */}
            <button
              onClick={() => setToolCallOpen((o) => !o)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer font-medium ${
                toolCallOpen
                  ? "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Code
            </button>

            {/* Tools toggle */}
            {integration.toolCount > 0 && (
              <button
                onClick={toggleTools}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer font-medium ${
                  tools
                    ? "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-200 dark:hover:border-sky-800 hover:text-sky-600 dark:hover:text-sky-400"
                }`}
              >
                {toolsLoading ? "…" : `${integration.toolCount} tool${integration.toolCount !== 1 ? "s" : ""}`}
              </button>
            )}

            {/* Notes toggle */}
            <button
              onClick={() => setNotesOpen((o) => !o)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer font-medium ${
                notesOpen
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-200 dark:hover:border-amber-800 hover:text-amber-600 dark:hover:text-amber-400"
              }`}
            >
              Notes
            </button>

            {/* Reconnect (saved offline only) */}
            {isSavedOffline && (
              <button
                onClick={() => onReconnect(integration)}
                disabled={reconnecting}
                className="text-[11px] px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 transition-colors cursor-pointer font-medium"
              >
                {reconnecting ? "Connecting…" : "Reconnect"}
              </button>
            )}

            {/* Remove */}
            <button
              onClick={() => onRemove(integration.name)}
              aria-label={`Remove ${integration.name}`}
              className="text-[11px] px-2 py-1 rounded-full border border-transparent text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-800 hover:text-red-400 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tool call panel */}
        {toolCallOpen && (
          <ToolCallPanel integrationName={integration.name} />
        )}

        {/* Expanded tools (only shown when MCP section is not active) */}
        {tools && !mcpServer && !mcpStarting && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
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

      {/* MCP footer — always visible, primary action */}
      <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 rounded-b-xl">
        {mcpStarting ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Starting MCP server…
          </div>
        ) : mcpServer ? (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                MCP Active
              </span>
              <button
                onClick={stopMcp}
                className="text-[11px] px-2 py-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                Stop
              </button>
            </div>
            <div className="flex items-center gap-2 bg-slate-950 rounded-lg px-3 py-2 mb-3">
              <span className="font-mono text-[11px] text-emerald-300 flex-1 truncate">
                {mcpServer.connectionString}
              </span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(mcpServer.connectionString);
                  setMcpCopied(true);
                  setTimeout(() => setMcpCopied(false), 2000);
                }}
                className={`shrink-0 text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer ${
                  mcpCopied
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {mcpCopied ? "✓ copied" : "copy"}
              </button>
            </div>
            {toolsLoading ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Loading tools…</p>
            ) : tools && tools.length > 0 ? (
              <div className="space-y-4">
                {toolsIsStored && (
                  <p className="text-[11px] text-amber-500 flex items-center gap-1">
                    <span>⚡</span>
                    <span>Last known tools — reconnect to refresh</span>
                  </p>
                )}
                {tools.map((tool) => (
                  <ToolEntry key={tool.name} tool={tool} integrationName={integration.name} />
                ))}
              </div>
            ) : tools && tools.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">No tools found.</p>
            ) : null}
          </div>
        ) : (
          <button
            onClick={startMcp}
            className="w-full flex items-center gap-2 py-2 px-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
              <path d="M3 3.732a1.5 1.5 0 0 1 2.305-1.265l6.706 4.267a1.5 1.5 0 0 1 0 2.531l-6.706 4.268A1.5 1.5 0 0 1 3 12.267V3.732Z" />
            </svg>
            Start MCP
            {integration.toolCount > 0 && (
              <span className="ml-auto text-[11px] text-slate-300 dark:text-slate-600">
                {integration.toolCount} tool{integration.toolCount !== 1 ? "s" : ""} available
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PendingDelete {
  integration: IntegrationRecord;
  timerId: ReturnType<typeof setTimeout>;
}

export default function Home() {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [runningServers, setRunningServers] = useState<RunningServer[]>([]);

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

  // Poll running MCP servers so cards stay in sync across tab navigation
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/servers");
        if (res.ok) setRunningServers(await res.json());
      } catch { /* silently fail */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

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

  const remove = (integrationName: string) => {
    const target = integrations.find((i) => i.name === integrationName);
    if (!target) return;

    // Cancel any existing pending delete first
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      // Commit the previous pending delete immediately
      fetch(`/api/integrations/${pendingDelete.integration.name}`, { method: "DELETE" }).catch(() => {});
    }

    // Optimistically remove from list
    setIntegrations((prev) => prev.filter((i) => i.name !== integrationName));

    const timerId = setTimeout(async () => {
      try {
        await fetch(`/api/integrations/${integrationName}`, { method: "DELETE" });
      } catch {
        setPageError("Failed to remove integration");
        await load();
      }
      setPendingDelete(null);
    }, 5000);

    setPendingDelete({ integration: target, timerId });
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    // Restore the integration back into the list in its original position
    setIntegrations((prev) => {
      const restored = [...prev, pendingDelete.integration];
      return restored;
    });
    setPendingDelete(null);
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-1">
          Integrations
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
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
              valueClass: "text-slate-900 dark:text-slate-100",
            },
            {
              label: "Live now",
              value: liveCount,
              valueClass: liveCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-700",
            },
            {
              label: "With notes",
              value: withNotesCount,
              valueClass: withNotesCount > 0 ? "text-amber-500 dark:text-amber-400" : "text-slate-300 dark:text-slate-700",
            },
          ].map(({ label, value, valueClass }) => (
            <div
              key={label}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 bg-white dark:bg-slate-900 shadow-sm"
            >
              <div className={`text-2xl font-bold tabular-nums ${valueClass}`}>
                {value}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium tracking-wide uppercase">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add integration form                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-8 bg-white dark:bg-slate-900 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Connect a site</h2>
        <div className="space-y-2.5">
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Integration name"
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm
                bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100
                focus:bg-white dark:focus:bg-slate-800
                focus:outline-none focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/50 focus:border-sky-300 dark:focus:border-sky-700
                transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
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
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm
                bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100
                focus:bg-white dark:focus:bg-slate-800
                focus:outline-none focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/50 focus:border-sky-300 dark:focus:border-sky-700
                transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Description"
              className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm
                bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100
                focus:bg-white dark:focus:bg-slate-800
                focus:outline-none focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/50 focus:border-sky-300 dark:focus:border-sky-700
                transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
            <button
              onClick={() => connect()}
              disabled={connecting || !name.trim() || !url.trim()}
              className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium
                disabled:opacity-40 hover:bg-slate-700 dark:hover:bg-white active:scale-95 transition-all
                whitespace-nowrap cursor-pointer"
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
            <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-28" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-16" />
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-64" />
            </div>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        /* Empty state */
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">No integrations yet.</p>
          <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">
            Connect your first site above — it will be saved automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.name}
              integration={integration}
              runningServer={runningServers.find((s) => s.url === integration.url) ?? null}
              onRefresh={load}
              onRemove={remove}
              onReconnect={connect}
              reconnecting={reconnectingName === integration.name}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Undo delete toast                                                   */}
      {/* ------------------------------------------------------------------ */}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-slate-900 dark:bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-xl border border-slate-700 dark:border-slate-700">
            <span className="text-slate-300">
              Removed <span className="font-semibold text-white">{pendingDelete.integration.name}</span>
            </span>
            <button
              onClick={undoDelete}
              className="px-3 py-1 rounded-lg bg-white text-slate-900 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Undo
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
