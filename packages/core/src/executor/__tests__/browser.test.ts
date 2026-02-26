import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolDefinition } from "../../types.js";

// Mock playwright before importing the module under test
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { chromium } from "playwright";
import { executeBrowserTool } from "../browser.js";

const loginTool: ToolDefinition = {
  name: "login",
  description: "Log in",
  inputSchema: { type: "object", properties: { email: { type: "string" }, password: { type: "string" } }, required: ["email", "password"] },
  transport: "browser",
  browserConfig: {
    steps: [
      { action: "navigate", value: "https://example.com/login" },
      { action: "fill", selector: "input[name=email]", paramRef: "email" },
      { action: "fill", selector: "input[name=password]", paramRef: "password" },
      { action: "click", selector: "button[type=submit]" },
      { action: "waitFor", selector: ".dashboard" },
      { action: "extract", selector: "body" },
    ],
  },
};

describe("executeBrowserTool", () => {
  // Set up mock browser/page before each test
  let mockPage: Record<string, ReturnType<typeof vi.fn>>;
  let mockBrowser: { newPage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      $: vi.fn().mockResolvedValue({ textContent: vi.fn().mockResolvedValue("page content") }),
      url: vi.fn().mockReturnValue("https://example.com/dashboard"),
    };
    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as never);
  });

  it("throws when tool has no browserConfig", async () => {
    const badTool: ToolDefinition = { ...loginTool, browserConfig: undefined };
    await expect(executeBrowserTool(badTool, {})).rejects.toThrow('Tool "login" has no browserConfig');
  });

  it("throws when no steps provided", async () => {
    const emptyTool: ToolDefinition = { ...loginTool, browserConfig: { steps: [] } };
    await expect(executeBrowserTool(emptyTool, {})).rejects.toThrow('Tool "login" has no steps');
  });

  it("executes navigate step", async () => {
    const navTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [{ action: "navigate", value: "https://example.com" }] },
    };
    await executeBrowserTool(navTool, {});
    expect(mockPage.goto).toHaveBeenCalledWith("https://example.com");
  });

  it("fills input using paramRef from args", async () => {
    const fillTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "fill", selector: "input[name=email]", paramRef: "email" },
      ]},
    };
    await executeBrowserTool(fillTool, { email: "user@test.com" });
    expect(mockPage.fill).toHaveBeenCalledWith("input[name=email]", "user@test.com");
  });

  it("returns extracted text content from extract step", async () => {
    const extractTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "extract", selector: "body" },
      ]},
    };
    const result = await executeBrowserTool(extractTool, {});
    expect(result).toBe("page content");
  });

  it("always closes browser even if a step throws", async () => {
    mockPage.goto = vi.fn().mockRejectedValue(new Error("Navigation failed"));
    const navTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [{ action: "navigate", value: "https://example.com" }] },
    };
    await expect(executeBrowserTool(navTool, {})).rejects.toThrow("Navigation failed");
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
