import { describe, it, expect, vi } from "vitest";
import { detectApiSpec } from "../spec-detector.js";

describe("detectApiSpec", () => {
  it("returns null when no spec found at common paths", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    const result = await detectApiSpec("https://example.com", mockFetch);
    expect(result).toBeNull();
  });

  it("returns parsed spec when openapi.json found", async () => {
    const spec = { openapi: "3.0.0", paths: { "/search": { get: {} } } };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false } as Response) // /openapi.json - not found first
      .mockResolvedValueOnce({
        ok: true,
        json: async () => spec,
      } as unknown as Response);
    const result = await detectApiSpec("https://example.com", mockFetch);
    expect(result).toEqual(spec);
  });

  it("detects swagger.json", async () => {
    const spec = { swagger: "2.0", paths: {} };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => spec } as unknown as Response);
    const result = await detectApiSpec("https://example.com", mockFetch);
    expect(result).toEqual(spec);
  });
});
