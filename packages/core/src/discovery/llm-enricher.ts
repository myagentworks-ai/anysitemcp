import Anthropic from "@anthropic-ai/sdk";
import type { FormCandidate } from "./html-analyzer.js";
import type { ToolDefinition } from "../types.js";

const SYSTEM_PROMPT = `You are an expert at analyzing websites and generating MCP tool definitions. Given a website URL, its HTML content, and detected form candidates, produce a JSON array of ToolDefinition objects. Each ToolDefinition must have: name (snake_case), description, inputSchema, transport ("http" or "browser"), httpConfig or browserConfig. Also suggest additional tools based on site context. Return ONLY valid JSON array, no explanation.`;

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
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as ToolDefinition[];
  } catch {
    return [];
  }
}
