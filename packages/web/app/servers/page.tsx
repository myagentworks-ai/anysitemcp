"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ServerCard } from "@/components/ServerCard";
import type { ServerInstance } from "@/lib/server-registry";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [url, setUrl] = useState("");
  const [port, setPort] = useState("4000");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/servers");
      if (res.ok) setServers(await res.json());
    } catch {
      setError("Failed to load servers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setError("Port must be a number between 1024 and 65535");
      return;
    }
    try {
      setError("");
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
      await load();
    } catch {
      setError("Failed to start server");
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

  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-6">MCP Servers</h1>

      <div className="flex gap-2 mb-8">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          aria-label="Website URL"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="4000"
          aria-label="Port number"
          min={1024}
          max={65535}
          className="w-24 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={start}
          disabled={!url}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          Start
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : servers.length === 0 ? (
          <p className="text-gray-400 text-sm">No servers running.</p>
        ) : (
          servers.map((s) => <ServerCard key={s.id} server={s} onStop={stop} />)
        )}
      </div>
    </main>
  );
}
