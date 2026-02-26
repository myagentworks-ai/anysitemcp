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
  const { url, port = 4000 } = (await req.json()) as {
    url: string;
    port?: number;
  };

  const instance = createInstance(url, port);

  // Delegate spawning to the registry so that Turbopack's static analysis of
  // this route file does not try to resolve the mcp-server path as a module.
  await spawnForInstance(instance);

  return NextResponse.json(instance, { status: 201 });
}
