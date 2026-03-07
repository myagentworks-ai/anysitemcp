"use client";
import { useState, useEffect, useCallback } from "react";
import { ServerCard } from "@/components/ServerCard";
import type { ServerInstance } from "@/lib/server-registry";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [url, setUrl] = useState("");
  const [port, setPort] = useState("4000");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/servers");
      if (res.ok) setServers(await res.json());
    } catch {
      // silently ignore poll errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + poll every 3 s so servers started from integration cards appear
  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  const start = async () => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setError("Port must be between 1024 and 65535");
      return;
    }
    setError("");
    setStarting(true);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, port: portNum }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to start server");
        return;
      }
      setUrl("");
      setPort("4000");
      await load();
    } catch {
      setError("Failed to start server");
    } finally {
      setStarting(false);
    }
  };

  const stop = async (id: string) => {
    try {
      await fetch(`/api/servers/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Failed to stop server");
    }
  };

  const STATUS_ORDER: Record<string, number> = { running: 0, starting: 1, stopped: 2 };
  const sortedServers = [...servers].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
  );
  const runningCount = servers.filter((s) => s.status === "running").length;

  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">MCP Servers</h1>
        {!loading && servers.length > 0 && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {runningCount} running
          </span>
        )}
      </div>

      {/* Add server form */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-8 bg-white dark:bg-slate-900">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Start a new MCP server
        </p>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && url && !starting && start()}
            placeholder="https://example.com"
            aria-label="Website URL"
            className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/50 focus:border-sky-300 dark:focus:border-sky-700 transition-all"
          />
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="4000"
            aria-label="Port number"
            min={1024}
            max={65535}
            className="w-24 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/50 focus:border-sky-300 dark:focus:border-sky-700 transition-all"
          />
          <button
            onClick={start}
            disabled={!url || starting}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-700 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium disabled:opacity-40 whitespace-nowrap transition-colors cursor-pointer"
          >
            {starting ? "Starting…" : "Start"}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* Server list */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">Loading…</p>
        ) : servers.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">No servers running.</p>
        ) : (
          sortedServers.map((s) => <ServerCard key={s.id} server={s} onStop={stop} />)
        )}
      </div>
    </main>
  );
}
