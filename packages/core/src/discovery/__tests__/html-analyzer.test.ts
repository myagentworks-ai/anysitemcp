import { describe, it, expect } from "vitest";
import { analyzeHtml } from "../html-analyzer.js";

describe("analyzeHtml", () => {
  it("extracts a search form as a candidate tool", () => {
    const html = `
      <html><body>
        <form action="/search" method="GET">
          <input name="q" type="text" placeholder="Search..." />
          <button type="submit">Search</button>
        </form>
      </body></html>
    `;

    const candidates = analyzeHtml(html, "https://example.com");

    expect(candidates).toHaveLength(1);
    expect(candidates[0].formAction).toBe("https://example.com/search");
    expect(candidates[0].method).toBe("GET");
    expect(candidates[0].fields).toContainEqual(expect.objectContaining({ name: "q" }));
  });

  it("extracts multiple forms", () => {
    const html = `
      <html><body>
        <form action="/search" method="GET"><input name="q" /></form>
        <form action="/login" method="POST">
          <input name="email" type="email" />
          <input name="password" type="password" />
        </form>
      </body></html>
    `;
    const candidates = analyzeHtml(html, "https://example.com");
    expect(candidates).toHaveLength(2);
  });

  it("ignores forms with no inputs", () => {
    const html = `<form action="/empty"></form>`;
    const candidates = analyzeHtml(html, "https://example.com");
    expect(candidates).toHaveLength(0);
  });
});
