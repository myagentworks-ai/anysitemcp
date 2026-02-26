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

  it("fills input using static step.value when no paramRef", async () => {
    const fillTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "fill", selector: "input[name=search]", value: "default text" },
      ]},
    };
    await executeBrowserTool(fillTool, {});
    expect(mockPage.fill).toHaveBeenCalledWith("input[name=search]", "default text");
  });

  it("executes click step", async () => {
    const clickTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "click", selector: "button[type=submit]" },
      ]},
    };
    await executeBrowserTool(clickTool, {});
    expect(mockPage.click).toHaveBeenCalledWith("button[type=submit]");
  });

  it("executes waitFor step", async () => {
    const waitTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "waitFor", selector: ".dashboard" },
      ]},
    };
    await executeBrowserTool(waitTool, {});
    expect(mockPage.waitForSelector).toHaveBeenCalledWith(".dashboard");
  });

  it("throws when navigate step is missing value", async () => {
    const badTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [{ action: "navigate" }] },
    };
    await expect(executeBrowserTool(badTool, {})).rejects.toThrow('navigate step in tool "login" is missing required "value"');
  });

  it("throws when extract step element is not found", async () => {
    mockPage.$ = vi.fn().mockResolvedValue(null);
    const extractTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "extract", selector: ".missing-element" },
      ]},
    };
    await expect(executeBrowserTool(extractTool, {})).rejects.toThrow('could not find element');
  });

  it("throws when extracted element has no text content", async () => {
    mockPage.$ = vi.fn().mockResolvedValue({ textContent: vi.fn().mockResolvedValue(null) });
    const extractTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "extract", selector: "img" },
      ]},
    };
    await expect(executeBrowserTool(extractTool, {})).rejects.toThrow("has no text content");
  });

  it("throws when fill step has paramRef but arg is not provided", async () => {
    const fillTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "fill", selector: "input[name=email]", paramRef: "email" },
      ]},
    };
    // Note: no "email" in args
    await expect(executeBrowserTool(fillTool, {})).rejects.toThrow('references paramRef "email" but it was not provided');
  });

  it("throws when fill step is missing selector", async () => {
    const badTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "fill", value: "text" },
      ]},
    };
    await expect(executeBrowserTool(badTool, {})).rejects.toThrow('fill step in tool "login" is missing required "selector"');
  });

  it("throws when click step is missing selector", async () => {
    const badTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "click" },
      ]},
    };
    await expect(executeBrowserTool(badTool, {})).rejects.toThrow('click step in tool "login" is missing required "selector"');
  });

  it("throws when waitFor step is missing selector", async () => {
    const badTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "waitFor" },
      ]},
    };
    await expect(executeBrowserTool(badTool, {})).rejects.toThrow('waitFor step in tool "login" is missing required "selector"');
  });

  it("throws when fill step has neither paramRef nor value", async () => {
    const badTool: ToolDefinition = {
      ...loginTool,
      browserConfig: { steps: [
        { action: "navigate", value: "https://example.com" },
        { action: "fill", selector: "input[name=email]" },
      ]},
    };
    await expect(executeBrowserTool(badTool, {})).rejects.toThrow(
      'fill step in tool "login" requires either "paramRef" or "value"'
    );
  });
});
