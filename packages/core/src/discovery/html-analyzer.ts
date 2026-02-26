import * as cheerio from "cheerio";

export interface FormCandidate {
  formAction: string;
  method: "GET" | "POST";
  fields: Array<{ name: string; type: string; placeholder?: string }>;
  submitLabel?: string;
}

export function analyzeHtml(html: string, baseUrl: string): FormCandidate[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const candidates: FormCandidate[] = [];

  $("form").each((_, el) => {
    const form = $(el);
    const action = form.attr("action") ?? "/";
    const method = (form.attr("method") ?? "GET").toUpperCase() as "GET" | "POST";

    const fields: FormCandidate["fields"] = [];
    form.find("input, textarea, select").each((_, input) => {
      const name = $(input).attr("name");
      if (!name) return;
      const type = $(input).attr("type") ?? "text";
      if (["submit", "reset", "button", "hidden"].includes(type)) return;
      fields.push({
        name,
        type,
        placeholder: $(input).attr("placeholder"),
      });
    });

    if (fields.length === 0) return;

    const formAction = action.startsWith("http")
      ? action
      : `${base.origin}${action.startsWith("/") ? action : `/${action}`}`;

    const submitLabel = form.find('[type="submit"], button').first().text().trim() || undefined;

    candidates.push({ formAction, method, fields, submitLabel });
  });

  return candidates;
}
