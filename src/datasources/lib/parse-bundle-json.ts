export interface ParseBundleJsonResult {
  json: unknown;
  parseMs: number;
}

export function parseBundleJson(text: string): ParseBundleJsonResult {
  const startedAt = performance.now();
  const json = JSON.parse(text) as unknown;

  return {
    json,
    parseMs: Math.round(performance.now() - startedAt),
  };
}
