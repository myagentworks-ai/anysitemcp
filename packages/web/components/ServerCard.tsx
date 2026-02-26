import type { ServerInstance } from "@/lib/server-registry";

interface Props {
  server: ServerInstance;
  onStop: (id: string) => void;
}

export function ServerCard({ server, onStop }: Props) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm truncate">{server.url}</span>
        <span className={`px-2 py-0.5 text-xs rounded-full
          ${server.status === "running" ? "bg-green-100 text-green-700" :
            server.status === "starting" ? "bg-yellow-100 text-yellow-700" :
            "bg-gray-100 text-gray-500"}`}>
          {server.status}
        </span>
      </div>

      {server.status === "running" && (
        <div className="flex items-center gap-2 mt-2">
          <code className="text-xs bg-gray-100 rounded px-2 py-1 flex-1">{server.connectionString}</code>
          <button
            onClick={() => navigator.clipboard.writeText(server.connectionString)}
            className="text-xs text-blue-600 hover:underline"
          >
            Copy
          </button>
        </div>
      )}

      <button
        onClick={() => onStop(server.id)}
        className="mt-3 text-xs text-red-500 hover:underline"
      >
        Stop
      </button>
    </div>
  );
}
