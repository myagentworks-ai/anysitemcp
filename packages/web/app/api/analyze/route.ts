import { NextRequest } from "next/server";
import { discover } from "@webmcp/core";

export async function POST(req: NextRequest): Promise<Response> {
  const { url } = await req.json() as { url: string };

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

        const result = await discover(url);

        send({ done: true, result });
      } catch (err) {
        send({ error: (err as Error).message });
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
