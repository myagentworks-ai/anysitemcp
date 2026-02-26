import { NextResponse } from "next/server";
import { getHub } from "@/lib/integration-registry";
import { getSavedIntegrations, saveIntegration } from "@/lib/integration-store";
import type { IntegrationConfig } from "@/lib/integration-registry";

// GET /api/integrations — merged live hub + persisted store
export async function GET() {
  const liveEntries = getHub().getAll();
  const savedEntries = getSavedIntegrations();
  const liveNames = new Set(liveEntries.map((e) => e.config.name));

  // Live entries (currently active in this process)
  const live = liveEntries.map(({ config, tools, connectedAt, status, error }) => {
    const saved = savedEntries.find((s) => s.name === config.name);
    return {
      name: config.name,
      url: config.url,
      description: config.description,
      toolCount: tools.length,
      connectedAt,
      status,
      error,
      notes: saved?.notes ?? "",
      isLive: true,
      savedAt: saved?.createdAt,
    };
  });

  // Saved-only entries (persisted but not in the current process — e.g. after a restart)
  const savedOnly = savedEntries
    .filter((s) => !liveNames.has(s.name))
    .map((s) => ({
      name: s.name,
      url: s.url,
      description: s.description,
      toolCount: s.lastToolCount ?? 0,
      connectedAt: s.lastConnectedAt ?? s.createdAt,
      status: "saved" as const,
      error: undefined as string | undefined,
      notes: s.notes ?? "",
      isLive: false,
      savedAt: s.createdAt,
      lastStatus: s.lastStatus,
    }));

  return NextResponse.json([...live, ...savedOnly]);
}

// POST /api/integrations — connect a site and persist it
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, url, description, skipLlm } = body as Partial<IntegrationConfig>;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 });
  }

  const entry = await getHub().connect({ name, url, description, skipLlm: !!skipLlm });

  // Persist every connect attempt (success or error) so it appears in the saved list
  saveIntegration({
    name: entry.config.name,
    url: entry.config.url,
    description: entry.config.description,
    status: entry.status,
    toolCount: entry.tools.length,
    connectedAt: entry.connectedAt,
    error: entry.error,
    tools: entry.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      transport: t.transport,
    })),
  });

  return NextResponse.json(
    {
      name: entry.config.name,
      url: entry.config.url,
      description: entry.config.description,
      toolCount: entry.tools.length,
      connectedAt: entry.connectedAt,
      status: entry.status,
      error: entry.error,
      isLive: true,
    },
    { status: entry.status === "connected" ? 201 : 200 }
  );
}
