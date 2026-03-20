/**
 * General-purpose utility functions.
 *
 * Small, dependency-free helpers used across pipeline library modules
 * and scripts. Unlike pipeline-utils.ts (CLI/batch infrastructure),
 * these are pure utility functions with no process-level side effects.
 */

import { existsSync, mkdirSync } from 'node:fs';

/**
 * Format a byte count into a human-readable string.
 *
 * @param bytes - Number of bytes.
 * @returns Formatted string (e.g. "1.2 KB", "3.4 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 *
 * @param dir - Directory path to ensure.
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
