/**
 * Load ODPT JSON source definitions from pipeline/resources/odpt-json/.
 *
 * Each .ts file in the resources directory is a single resource definition.
 * The filename (without .ts) serves as the source identifier for CLI usage.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { OdptJsonSourceDefinition } from '../types/odpt-json-resource';
import { RESOURCES_DIR as BASE_RESOURCES_DIR } from './paths';

const RESOURCES_DIR = join(BASE_RESOURCES_DIR, 'odpt-json');

/**
 * List available ODPT JSON source names (filenames without .ts extension).
 *
 * @returns Sorted array of source names (e.g. ["yurikamome-railway", "yurikamome-station"]).
 */
export function listOdptJsonSourceNames(): string[] {
  return readdirSync(RESOURCES_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

/**
 * Load a single ODPT JSON source definition by name.
 *
 * @param name - Source name matching the filename without .ts (e.g. "yurikamome-station").
 * @returns The source definition.
 * @throws If the file does not exist.
 */
export async function loadOdptJsonSource(name: string): Promise<OdptJsonSourceDefinition> {
  const filePath = join(RESOURCES_DIR, `${name}.ts`);
  const mod = (await import(pathToFileURL(filePath).href)) as { default: OdptJsonSourceDefinition };
  return mod.default;
}

/**
 * Load all ODPT JSON source definitions.
 *
 * @returns Array of all OdptJsonSourceDefinition sorted by name.
 */
export async function loadAllOdptJsonSources(): Promise<OdptJsonSourceDefinition[]> {
  const names = listOdptJsonSourceNames();
  const sources: OdptJsonSourceDefinition[] = [];
  for (const name of names) {
    sources.push(await loadOdptJsonSource(name));
  }
  return sources;
}
