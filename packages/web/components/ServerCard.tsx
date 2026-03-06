"use client";
import { useState } from "react";
import type { ServerInstance } from "@/lib/server-registry";

interface Props {
  server: ServerInstance;
  onStop: (id: string) => void;
}

export function ServerCard({ server, onStop }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(server.connectionString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const isRunning = server.status === "running";
  const isStarting = server.status === "starting";
  const isStopped = server.status === "stopped";

  return (
    <div className={`rounded-xl border px-4 py-3 transition-opacity ${isStopped ? "opacity-40" : ""}`}>
      {/* Row 1 — URL + port */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium truncate">{server.url}</span>
        <span className="text-xs text-gray-400 shrink-0">:{server.port}</span>
      </div>

      {/* Row 2 — connection string (running only) */}
      {isRunning && (
        <div className="mt-2 flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-1.5">
          <span className="font-mono text-[11px] text-emerald-300 flex-1 truncate">
            {server.connectionString}
          </span>
          <button
            onClick={handleCopy}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded transition-all ${
              copied ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
      )}

      {/* Row 3 — action + status pill */}
      <div className="mt-2.5 flex items-center justify-end">
        {isStarting ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full" />
            starting…
          </span>
        ) : isRunning ? (
          /* Two-pill segmented control: [Stop] [● running] */
          <div className="inline-flex rounded-full border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => onStop(server.id)}
              className="px-3 py-1 bg-white hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors border-r border-gray-200"
            >
              Stop
            </button>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 font-medium">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              running
            </span>
          </div>
        ) : (
          /* Stopped — dim dismiss button */
          <button
            onClick={() => onStop(server.id)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
