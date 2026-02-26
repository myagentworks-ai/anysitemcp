import { NextRequest, NextResponse } from "next/server";
import { stopInstance } from "@/lib/server-registry";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stopped = stopInstance(id);
  if (!stopped) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
