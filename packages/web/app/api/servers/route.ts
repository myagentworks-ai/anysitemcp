import { NextRequest, NextResponse } from "next/server";
import {
  createInstance,
  getAll,
  ServerInstance,
  spawnForInstance,
} from "@/lib/server-registry";

export function GET() {
  return NextResponse.json(getAll());
}

export async function POST(req: NextRequest) {
  // Fix 2: Wrap req.json() in try/catch
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fix 3: Runtime validation — url must be a non-empty string
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>)["url"] !== "string" ||
    ((body as Record<string, unknown>)["url"] as string).trim() === ""
  ) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { url, port = 4000 } = body as { url: string; port?: number };

  // Fix 1 (SSRF): Validate url is http or https
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fix 3: Validate port is a number in range 1024-65535
  if (
    typeof port !== "number" ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  ) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const instance = createInstance(url, port);

  // Delegate spawning to the registry so that Turbopack's static analysis of
  // this route file does not try to resolve the mcp-server path as a module.
  await spawnForInstance(instance);

  return NextResponse.json(instance, { status: 201 });
}
