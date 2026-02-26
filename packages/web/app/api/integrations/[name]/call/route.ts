import { NextResponse } from "next/server";
import { getHub } from "@/lib/integration-registry";

// POST /api/integrations/:name/call — call a tool on an integration
export async function POST(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tool, params: toolParams } = body as { tool?: string; params?: Record<string, unknown> };

  if (!tool || typeof tool !== "string") {
    return NextResponse.json({ error: "tool name is required" }, { status: 400 });
  }

  try {
    const result = await getHub().call(name, tool, toolParams ?? {});
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool call failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
