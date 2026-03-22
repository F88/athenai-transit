/**
 * Write v2 bundle JSON files with atomic writes.
 *
 * Uses a temp file + rename pattern to ensure that readers never see
 * a partially written file.
 *
 * Note: renameSync overwrites existing files on POSIX (macOS/Linux).
 * Windows is not supported as a pipeline execution environment.
 */

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  DataBundle,
  InsightsBundle,
  ServiceGroupEntry,
  ShapePointV2,
  ShapesBundle,
} from '../../../../../src/types/data/transit-v2-json';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Atomically write JSON to a file (temp + rename).
 *
 * @param dir - Output directory (created recursively if absent).
 * @param filename - Target filename (e.g. `"data.json"`, `"shapes.json"`).
 * @param data - Serializable object.
 */
function writeAtomicJson(dir: string, filename: string, data: unknown): void {
  mkdirSync(dir, { recursive: true });

  const finalPath = join(dir, filename);
  const tmpPath = finalPath + '.tmp';

  writeFileSync(tmpPath, JSON.stringify(data));
  renameSync(tmpPath, finalPath);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
  writeAtomicJson(dir, 'data.json', data);
}

/**
 * Write a ShapesBundle to `{dir}/shapes.json` atomically.
 *
 * Creates the output directory if it does not exist.
 *
 * @param dir - Output directory (e.g. `pipeline/workspace/_build/data-v2/{prefix}`).
 * @param shapes - Route shapes data (`route_id -> polylines`).
 */
export function writeShapesBundle(dir: string, shapes: Record<string, ShapePointV2[][]>): void {
  const bundle: ShapesBundle = {
    bundle_version: 2,
    kind: 'shapes',
    shapes: { v: 2, data: shapes },
  };
  writeAtomicJson(dir, 'shapes.json', bundle);
}

/**
 * Write an InsightsBundle to `{dir}/insights.json` atomically.
 *
 * Creates the output directory if it does not exist.
 *
 * @param dir - Output directory (e.g. `pipeline/workspace/_build/data-v2/{prefix}`).
 * @param serviceGroups - Service group entries produced by {@link buildServiceGroups}.
 */
export function writeInsightsBundle(dir: string, serviceGroups: ServiceGroupEntry[]): void {
  const bundle: InsightsBundle = {
    bundle_version: 2,
    kind: 'insights',
    serviceGroups: { v: 1, data: serviceGroups },
  };
  writeAtomicJson(dir, 'insights.json', bundle);
}
