/**
 * Sanitize a directory name to prevent path traversal (for pipeline).
 *
 * Kept per-boundary rather than shared via import: cross-boundary imports are
 * not possible (`.vercelignore` excludes `pipeline/` from the Vercel build, and
 * `scripts/` / repo-root files are outside `src/`). A boundary that needs it
 * keeps its own copy. This pipeline copy is currently the only one; the former
 * `scripts/lib/sanitize-dir-name.ts` was removed when its sole consumer
 * (`copy-pipeline-data`) moved into `pipeline/`.
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
