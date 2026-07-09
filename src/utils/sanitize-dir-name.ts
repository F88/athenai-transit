/**
 * Sanitize a WebApp data path, preventing directory traversal.
 *
 * NOTE: this WebApp copy intentionally DIFFERS from the `scripts/lib/` and
 * `pipeline/scripts/pipeline/lib/` copies. Those validate a single on-disk
 * directory name and reject slashes. This copy validates a client-side URL
 * path (`VITE_TRANSIT_DATA_PATH`), so it allows slash-separated segments (e.g.
 * `a/data-v3`) to serve data from a nested path. The copies stay separate
 * because the three codebases cannot share imports across project boundaries
 * (`.vercelignore` excludes `pipeline/`, `scripts/` is outside `src/`).
 *
 * Each `/`-separated segment must be a simple name: lowercase alphanumeric,
 * hyphens, and underscores. Empty segments, `.`, and `..` (traversal) are
 * rejected.
 *
 * @param value - Path to validate (slash-separated simple names).
 * @param label - Environment variable name for error messages.
 * @returns The validated path (unchanged).
 * @throws {Error} if the value is invalid.
 */
export function sanitizeDirName(value: string, label: string): string {
  // Each path segment must be a simple name. Requiring an alphanumeric first
  // char also rejects empty segments and "."/".." (directory traversal).
  const isSimpleName = (segment: string): boolean => /^[a-z0-9][a-z0-9_-]*$/.test(segment);
  if (!value.split('/').every(isSimpleName)) {
    throw new Error(
      `Invalid ${label}: "${value}". ` +
        'Must be a slash-separated path of simple names (lowercase alphanumeric, hyphens, underscores).',
    );
  }
  return value;
}
