"use client";
import { useState } from "react";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { ToolList } from "@/components/ToolList";
import type { ToolDefinition } from "@webmcp/core";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [stageMsg, setStageMsg] = useState("");
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [error, setError] = useState("");

  const analyze = async () => {
    setLoading(true);
    setTools([]);
    setError("");
    setStage(1);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Request failed: ${res.statusText}`);
      }

      if (!res.body) throw new Error("Response body is not readable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;
          let data: { stage?: number; message?: string; done?: boolean; result?: { tools: unknown[] }; error?: string };
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (data.stage) { setStage(data.stage); setStageMsg(data.message ?? ""); }
          if (data.done && data.result?.tools) setTools(data.result.tools as ToolDefinition[]);
          if (data.error) setError(data.error);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setStage(0);
    }
  };

  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-2">AnySiteMCP</h1>
      <p className="text-gray-500 mb-8">Turn any website into an MCP server for AI agents.</p>

      <div className="flex gap-2 mb-6">
        <input
          id="url-input"
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (error) setError(""); }}
          placeholder="https://example.com"
          aria-label="Website URL to analyze"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && !loading && url && analyze()}
        />
        <button
          onClick={analyze}
          disabled={loading || !url}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {loading && <AnalysisProgress stage={stage} message={stageMsg} />}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {tools.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{tools.length} tools discovered</p>
          <ToolList tools={tools} />
        </div>
      )}
    </main>
  );
}
