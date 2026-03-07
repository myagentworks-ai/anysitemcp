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

  /* ── Running ─────────────────────────────────────────────────────────── */
  if (isRunning) {
    return (
      <div className="rounded-xl border-2 border-emerald-400 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative inline-flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">Running</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{server.url}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-slate-400 dark:text-slate-500">port {server.port}</span>
            <button
              onClick={() => onStop(server.id)}
              className="text-xs px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer font-medium"
            >
              Stop
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 rounded-lg px-3 py-2">
          <span className="font-mono text-[11px] text-emerald-300 flex-1 truncate">
            {server.connectionString}
          </span>
          <button
            onClick={handleCopy}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer ${
              copied ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
      </div>
    );
  }

  /* ── Starting ────────────────────────────────────────────────────────── */
  if (isStarting) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0">Starting…</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{server.url}</span>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2">port {server.port}</span>
        </div>
      </div>
    );
  }

  /* ── Stopped ─────────────────────────────────────────────────────────── */
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
          <span className="text-sm text-slate-400 dark:text-slate-500 truncate">{server.url}</span>
          <span className="text-xs text-slate-300 dark:text-slate-600 shrink-0">port {server.port}</span>
        </div>
        <button
          onClick={() => onStop(server.id)}
          className="shrink-0 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-1 rounded transition-colors cursor-pointer"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
