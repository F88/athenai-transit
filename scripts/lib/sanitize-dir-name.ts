/**
 * Sanitize a directory name to prevent path traversal (for scripts).
 *
 * Intentionally duplicated across project boundaries (src/, scripts/, pipeline/).
 * Each boundary has its own copy because cross-boundary imports are not possible
 * (`.vercelignore` excludes `pipeline/`, `scripts/` is outside `src/`).
 *
 * Only simple directory names are allowed: lowercase alphanumeric,
 * hyphens, and underscores. Rejects path traversal (`..`), absolute
 * paths, slashes, and empty values.
 *
 * @param value - Directory name to validate.
 * @param label - Environment variable name for error messages.
 * @returns The validated directory name (unchanged).
 * @throws {Error} if the value is invalid.
 */
export function sanitizeDirName(value: string, label: string): string {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". ` +
        'Must be a simple directory name (lowercase alphanumeric, hyphens, underscores).',
    );
  }
  return value;
}
