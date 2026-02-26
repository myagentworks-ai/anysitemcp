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
          if (!step.value) throw new Error(`navigate step in tool "${tool.name}" is missing required "value"`);
          await page.goto(step.value);
          break;
        case "fill": {
          if (!step.selector) throw new Error(`fill step in tool "${tool.name}" is missing required "selector"`);
          const value = step.paramRef ? String(args[step.paramRef] ?? "") : step.value ?? "";
          await page.fill(step.selector, value);
          break;
        }
        case "click":
          if (!step.selector) throw new Error(`click step in tool "${tool.name}" is missing required "selector"`);
          await page.click(step.selector);
          break;
        case "waitFor":
          if (!step.selector) throw new Error(`waitFor step in tool "${tool.name}" is missing required "selector"`);
          await page.waitForSelector(step.selector);
          break;
        case "extract": {
          const selector = step.selector ?? "body";
          const el = await page.$(selector);
          if (!el) throw new Error(`extract step in tool "${tool.name}" could not find element: "${selector}"`);
          extractedContent = await el.textContent() ?? null;
          break;
        }
        default: {
          const _exhaustive: never = step.action;
          throw new Error(`Unknown browser step action: ${_exhaustive}`);
        }
      }
    }

    return extractedContent ?? { success: true, url: page.url() };
  } finally {
    await browser.close();
  }
}
