"use client";
import { useState } from "react";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { ToolList } from "@/components/ToolList";
import type { ToolDefinition } from "@webmcp/core";

/** Derive a slug-safe name from a URL hostname, e.g. "https://stripe.com/docs" → "stripe" */
function hostnameToName(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "");
    return host.split(".")[0] ?? host;
  } catch {
    return "";
  }
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [stageMsg, setStageMsg] = useState("");
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [error, setError] = useState("");

  // Save-as-integration state
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedOk, setSavedOk] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setTools([]);
    setError("");
    setSavedOk(false);
    setSaveError("");
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
          if (data.done && data.result?.tools) {
            setTools(data.result.tools as ToolDefinition[]);
            // Pre-fill name from URL when tools land
            setSaveName(hostnameToName(url));
          }
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

  const saveIntegration = async () => {
    if (!saveName.trim()) { setSaveError("Name is required"); return; }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), url, description: saveDesc.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? `Save failed: ${res.statusText}`);
      }
      setSavedOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
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

          {/* ── Save as integration ── */}
          <div className="mt-6 border rounded-lg p-4 bg-gray-50">
            {savedOk ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-700 font-medium">
                  ✓ Saved as <span className="font-semibold">{saveName}</span>
                </p>
                <a
                  href="/integrations"
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  View integrations →
                </a>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium mb-3">Save as integration</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => { setSaveName(e.target.value); if (saveError) setSaveError(""); }}
                    placeholder="integration-name"
                    aria-label="Integration name"
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={saveDesc}
                    onChange={(e) => setSaveDesc(e.target.value)}
                    placeholder="Description (optional)"
                    aria-label="Integration description"
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {saveError && <p className="text-red-500 text-xs">{saveError}</p>}
                  <button
                    onClick={saveIntegration}
                    disabled={saving || !saveName.trim()}
                    className="self-start px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
                  >
                    {saving ? "Saving…" : "Save to Integrations"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
