import { NextRequest } from "next/server";
import { discover } from "@webmcp/core";

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
