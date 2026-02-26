import Anthropic from "@anthropic-ai/sdk";
import type { FormCandidate } from "./html-analyzer.js";
import type { ToolDefinition } from "../types.js";

const MODEL = "claude-sonnet-4-6" as const;
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are an expert at analyzing websites and generating MCP tool definitions. Given a website URL, its HTML content, and detected form candidates, produce a JSON array of ToolDefinition objects. Each ToolDefinition must have: name (snake_case), description, inputSchema, transport ("http" or "browser"), httpConfig or browserConfig. Also suggest additional tools based on site context. Return ONLY valid JSON array, no explanation.`;

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  // Try increasingly shorter substrings from the last ']' backwards
  let end = text.lastIndexOf("]");
  while (end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // try shorter
    }
    end = text.lastIndexOf("]", end - 1);
  }
  return null;
}

export async function enrichWithLlm(
  candidates: FormCandidate[],
  url: string,
  htmlSnippet: string,
  client?: Anthropic
): Promise<ToolDefinition[]> {
  const anthropic = client ?? new Anthropic();
  const userMessage = `Website URL: ${url}\n\nDetected form candidates:\n${JSON.stringify(candidates, null, 2)}\n\nHTML snippet (first 3000 chars):\n${htmlSnippet.slice(0, 3000)}\n\nGenerate ToolDefinitions for this website.`;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const extracted = extractJsonArray(text);
    if (!extracted) return [];
    if (!Array.isArray(extracted)) return [];
    return extracted as ToolDefinition[];
  } catch (err) {
    console.error("[enrichWithLlm] error:", err instanceof Error ? err.message : err);
    return [];
  }
}
