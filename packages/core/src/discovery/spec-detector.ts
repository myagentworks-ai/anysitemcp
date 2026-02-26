const SPEC_PATHS = [
  "/openapi.json",
  "/swagger.json",
  "/api-docs",
  "/api-docs.json",
  "/.well-known/openapi.json",
];

export async function detectApiSpec(
  baseUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<Record<string, unknown> | null> {
  const url = new URL(baseUrl);

  for (const path of SPEC_PATHS) {
    try {
      const res = await fetchFn(`${url.origin}${path}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.openapi || data.swagger)) {
          return data as Record<string, unknown>;
        }
      }
    } catch {
      // ignore network errors, try next path
    }
  }

  return null;
}
