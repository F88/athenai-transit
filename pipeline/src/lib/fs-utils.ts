/**
 * File system utilities.
 */

import { existsSync, mkdirSync } from 'node:fs';

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
