/**
 * File system utilities.
 */

import { mkdirSync } from 'node:fs';

/**
 * Ensure a directory exists, creating it recursively if needed.
 *
 * `mkdirSync` with `{ recursive: true }` is a no-op when the directory
 * already exists (Node >= 10), so no pre-check is needed.
 *
 * @param dir - Directory path to ensure.
 */
export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}
