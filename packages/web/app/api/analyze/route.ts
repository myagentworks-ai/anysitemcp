import { NextRequest } from "next/server";
import { discover } from "@webmcp/core";

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

export async function POST(req: NextRequest): Promise<Response> {
  let url: string;
  try {
    const body = await req.json() as { url?: unknown };
    if (typeof body.url !== "string" || body.url.trim() === "") {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    url = body.url;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response(
        JSON.stringify({ error: "Invalid URL: must be http or https" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (isPrivateHost(parsed.hostname)) {
      return new Response(
        JSON.stringify({ error: "Invalid URL" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid URL: must be http or https" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ stage: 1, message: "Detecting API spec..." });
        // Small delay so the client sees the progress
        await new Promise((r) => setTimeout(r, 100));

        send({ stage: 2, message: "Analyzing HTML..." });
        await new Promise((r) => setTimeout(r, 100));

        send({ stage: 3, message: "Enriching with LLM..." });

        const result = await Promise.race([
          discover(url),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Discovery timed out after 60 seconds")), 60000)
          ),
        ]);

        send({ done: true, result });
      } catch (err) {
        send({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
