/**
 * Validate a WebApp data path (`VITE_TRANSIT_DATA_PATH`), preventing directory
 * traversal.
 *
 * The path is a client-side URL path, so it allows slash-separated segments
 * (e.g. `a/data-v3`) to serve data from a nested path. Each segment must be a
 * simple name: lowercase alphanumeric, hyphens, and underscores. Empty
 * segments, `.`, and `..` (traversal) are rejected.
 *
 * Distinct from the pipeline `sanitizeDirName`
 * (`pipeline/scripts/pipeline/lib/file-utils.ts`), which validates a single
 * on-disk directory name and rejects slashes; it cannot be imported here across
 * project boundaries (`.vercelignore` excludes `pipeline/`, `scripts/` is
 * outside `src/`).
 *
 * @param value - Path to validate (slash-separated simple names).
 * @param label - Environment variable name for error messages.
 * @returns The validated path (unchanged).
 * @throws {Error} if the value is invalid.
 */
export function validatePathSegments(value: string, label: string): string {
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
