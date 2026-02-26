import { NextResponse } from "next/server";
import { getHub } from "@/lib/integration-registry";
import type { IntegrationConfig } from "@/lib/integration-registry";

// GET /api/integrations — list all integrations
export async function GET() {
  const entries = getHub().getAll().map(({ config, tools, connectedAt, status, error }) => ({
    name: config.name,
    url: config.url,
    description: config.description,
    toolCount: tools.length,
    connectedAt,
    status,
    error,
  }));
  return NextResponse.json(entries);
}

// POST /api/integrations — add a new integration
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
  return NextResponse.json({
    name: entry.config.name,
    url: entry.config.url,
    description: entry.config.description,
    toolCount: entry.tools.length,
    connectedAt: entry.connectedAt,
    status: entry.status,
    error: entry.error,
  }, { status: entry.status === "connected" ? 201 : 200 });
}
