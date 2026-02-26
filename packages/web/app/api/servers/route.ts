import { NextRequest, NextResponse } from "next/server";
import {
  createInstance,
  getAll,
  ServerInstance,
  spawnForInstance,
} from "@/lib/server-registry";

// Block loopback and link-local hostnames
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // AWS/GCP/Azure metadata
  "metadata.google.internal",
]);

function isPrivateHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;
  // RFC 1918 / loopback / link-local CIDR checks
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a === 127) return true;                        // 127.0.0.0/8
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local
  }
  return false;
}

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
  if (isPrivateHost(parsed.hostname)) {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
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
