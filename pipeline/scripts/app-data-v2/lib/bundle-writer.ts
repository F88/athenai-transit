/**
 * Write v2 DataBundle JSON files with atomic writes.
 *
 * Uses a temp file + rename pattern to ensure that readers never see
 * a partially written file. Each call writes a single data.json file.
 *
 * Note: renameSync overwrites existing files on POSIX (macOS/Linux).
 * Windows is not supported as a pipeline execution environment.
 */

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DataBundle } from '../../../../src/types/data/transit-v2-json';

/**
 * Write a DataBundle to `{dir}/data.json` atomically.
 *
 * Creates the output directory if it does not exist.
 * Writes to a temp file first, then renames — so the target file
 * is always complete or absent.
 *
 * @param dir - Output directory (e.g. `pipeline/workspace/_build/data-v2/{prefix}`).
 * @param data - The DataBundle to serialize.
 */
export function writeDataBundle(dir: string, data: DataBundle): void {
  mkdirSync(dir, { recursive: true });

  const finalPath = join(dir, 'data.json');
  const tmpPath = join(dir, 'data.json.tmp');

  writeFileSync(tmpPath, JSON.stringify(data));
  renameSync(tmpPath, finalPath);
}
