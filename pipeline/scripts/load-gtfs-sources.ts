/**
 * Load GTFS source definitions from pipeline/resources/gtfs/.
 *
 * Each .ts file in the resources directory is a single resource definition.
 * The filename (without .ts) serves as the source identifier for CLI usage.
 */

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { GtfsSourceDefinition } from '../types/gtfs-resource';

const RESOURCES_DIR = resolve(import.meta.dirname, '..', 'resources', 'gtfs');

/**
 * List available GTFS source names (filenames without .ts extension).
 *
 * @returns Sorted array of source names (e.g. ["suginami-gsm", "toei-bus", "toei-train"]).
 */
export function listGtfsSourceNames(): string[] {
  return readdirSync(RESOURCES_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

/**
 * Load a single GTFS source definition by name.
 *
 * @param name - Source name matching the filename without .ts (e.g. "toei-bus").
 * @returns The source definition.
 * @throws If the file does not exist.
 */
export async function loadGtfsSource(name: string): Promise<GtfsSourceDefinition> {
  const filePath = join(RESOURCES_DIR, `${name}.ts`);
  const mod = (await import(filePath)) as { default: GtfsSourceDefinition };
  return mod.default;
}

/**
 * Load all GTFS source definitions.
 *
 * @returns Array of all GtfsSourceDefinition sorted by name.
 */
export async function loadAllGtfsSources(): Promise<GtfsSourceDefinition[]> {
  const names = listGtfsSourceNames();
  const sources: GtfsSourceDefinition[] = [];
  for (const name of names) {
    sources.push(await loadGtfsSource(name));
  }
  return sources;
}
