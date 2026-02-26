import { NextResponse } from "next/server";
import { getHub } from "@/lib/integration-registry";
import { deleteSavedIntegration, updateNotes, getSavedIntegrations } from "@/lib/integration-store";

type RouteContext = { params: Promise<{ name: string }> };

// GET /api/integrations/:name — get tools for a live integration
export async function GET(_req: Request, { params }: RouteContext) {
  const { name } = await params;
  const entry = getHub().get(name);
  if (!entry) {
    return NextResponse.json({ error: `Integration "${name}" not found` }, { status: 404 });
  }
  return NextResponse.json({
    name: entry.config.name,
    url: entry.config.url,
    tools: entry.tools,
    status: entry.status,
  });
}

// PATCH /api/integrations/:name — update notes (creates store record if needed)
export async function PATCH(req: Request, { params }: RouteContext) {
  const { name } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { notes } = body as { notes?: string };
  if (typeof notes !== "string") {
    return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
  }

  // Try to update existing record
  const updated = updateNotes(name, notes);
  if (!updated) {
    // Integration exists in hub but hasn't been persisted yet — shouldn't happen
    // in normal flow, but guard anyway
    const entry = getHub().get(name);
    if (!entry) {
      return NextResponse.json({ error: `Integration "${name}" not found` }, { status: 404 });
    }
    // Persist it first then update notes
    const { saveIntegration } = await import("@/lib/integration-store");
    saveIntegration({
      name: entry.config.name,
      url: entry.config.url,
      description: entry.config.description,
      status: entry.status,
      toolCount: entry.tools.length,
      connectedAt: entry.connectedAt,
      error: entry.error,
    });
    updateNotes(name, notes);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/integrations/:name — remove from live hub AND from the store
export async function DELETE(_req: Request, { params }: RouteContext) {
  const { name } = await params;
  const removedLive = getHub().disconnect(name);
  const removedSaved = deleteSavedIntegration(name);

  if (!removedLive && !removedSaved) {
    return NextResponse.json({ error: `Integration "${name}" not found` }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
