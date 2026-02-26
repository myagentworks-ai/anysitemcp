import type { ToolDefinition } from "@webmcp/core";

export function ToolList({ tools }: { tools: ToolDefinition[] }) {
  return (
    <div className="space-y-2">
      {tools.map((tool) => (
        <div key={tool.name} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded font-mono
              ${tool.transport === "http" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
              {tool.transport.toUpperCase()}
            </span>
            <code className="font-mono text-sm font-semibold">{tool.name}</code>
          </div>
          <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
        </div>
      ))}
    </div>
  );
}
