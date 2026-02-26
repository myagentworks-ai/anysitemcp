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

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));
        if (data.stage) { setStage(data.stage); setStageMsg(data.message); }
        if (data.done) setTools(data.result.tools);
        if (data.error) setError(data.error);
      }
    }
    setLoading(false);
    setStage(0);
  };

  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-2">WebMCP</h1>
      <p className="text-gray-500 mb-8">Turn any website into an MCP server for AI agents.</p>

      <div className="flex gap-2 mb-6">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && analyze()}
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
