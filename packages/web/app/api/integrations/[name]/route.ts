import { NextResponse } from "next/server";
import { getHub } from "@/lib/integration-registry";

// GET /api/integrations/:name — get tools for an integration
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
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

// DELETE /api/integrations/:name — remove an integration
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const removed = getHub().disconnect(name);
  if (!removed) {
    return NextResponse.json({ error: `Integration "${name}" not found` }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
