import { chromium } from "playwright";
import type { ToolDefinition } from "../types.js";

export async function executeBrowserTool(
  tool: ToolDefinition,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!tool.browserConfig) throw new Error(`Tool "${tool.name}" has no browserConfig`);
  if (!tool.browserConfig.steps.length) throw new Error(`Tool "${tool.name}" has no steps`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    let extractedContent: string | null = null;

    for (const step of tool.browserConfig.steps) {
      switch (step.action) {
        case "navigate":
          await page.goto(step.value!);
          break;
        case "fill": {
          const value = step.paramRef ? String(args[step.paramRef] ?? "") : step.value ?? "";
          await page.fill(step.selector!, value);
          break;
        }
        case "click":
          await page.click(step.selector!);
          break;
        case "waitFor":
          await page.waitForSelector(step.selector!);
          break;
        case "extract": {
          const el = await page.$(step.selector ?? "body");
          extractedContent = await el?.textContent() ?? null;
          break;
        }
      }
    }

    return extractedContent ?? { success: true, url: page.url() };
  } finally {
    await browser.close();
  }
}
