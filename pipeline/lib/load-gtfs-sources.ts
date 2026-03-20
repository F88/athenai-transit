/**
 * Load GTFS source definitions from pipeline/config/resources/gtfs/.
 *
 * Each .ts file in the resources directory is a single resource definition.
 * The filename (without .ts) serves as the source identifier for CLI usage.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { GtfsSourceDefinition } from '../types/gtfs-resource';
import { RESOURCES_DIR as BASE_RESOURCES_DIR } from './paths';

const RESOURCES_DIR = join(BASE_RESOURCES_DIR, 'gtfs');

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
  const mod = (await import(pathToFileURL(filePath).href)) as { default: GtfsSourceDefinition };
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
