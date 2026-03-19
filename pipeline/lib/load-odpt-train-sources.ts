/**
 * Discover and load ODPT Train source definitions.
 *
 * Groups ODPT JSON resource definitions by outDir and filters
 * to those with all 3 required types (Station, Railway, StationTimetable).
 *
 * Extracted from build-app-data-from-odpt-train.ts for reuse by both
 * v1 and v2 pipeline builders.
 */

import { join, resolve } from 'node:path';

import type { OdptJsonSourceDefinition } from '../types/odpt-json-resource';
import type { Provider } from '../types/resource-common';
import { loadAllOdptJsonSources } from './load-odpt-json-sources';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '..');
const DATA_BASE_DIR = join(ROOT, 'data/odpt-json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Required ODPT data types for a valid Train source. */
const REQUIRED_ODPT_TYPES = ['odpt:Station', 'odpt:Railway', 'odpt:StationTimetable'] as const;

/** Resolved ODPT Train source with all required resources. */
export interface OdptTrainSource {
  /** Source identifier (outDir name, e.g. "yurikamome"). */
  name: string;
  /** Output prefix (e.g. "yrkm"). */
  prefix: string;
  /** Data provider info. */
  provider: Provider;
  /** Path to the data directory. */
  dataDir: string;
  /** Resource definitions grouped by odptType. */
  resources: {
    station: OdptJsonSourceDefinition;
    railway: OdptJsonSourceDefinition;
    stationTimetable: OdptJsonSourceDefinition;
  };
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover available ODPT Train sources by grouping resources by outDir.
 * A valid source must have all 3 required types.
 *
 * @returns Resolved ODPT Train sources sorted by name, each containing
 *   all required resource definitions (Station, Railway, StationTimetable).
 */
export async function discoverOdptTrainSources(): Promise<OdptTrainSource[]> {
  const allDefs = await loadAllOdptJsonSources();

  // Group by outDir
  const groups = new Map<string, OdptJsonSourceDefinition[]>();
  for (const def of allDefs) {
    const key = def.pipeline.outDir;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(def);
  }

  // Filter to groups that have all 3 required types
  const sources: OdptTrainSource[] = [];
  for (const [outDir, defs] of groups) {
    const byType = new Map(defs.map((d) => [d.resource.odptType, d]));
    const hasAll = REQUIRED_ODPT_TYPES.every((t) => byType.has(t));
    if (!hasAll) {
      continue;
    }

    const station = byType.get('odpt:Station')!;
    const railway = byType.get('odpt:Railway')!;
    const stationTimetable = byType.get('odpt:StationTimetable')!;

    sources.push({
      name: outDir,
      prefix: station.pipeline.prefix,
      provider: station.resource.provider,
      dataDir: join(DATA_BASE_DIR, outDir),
      resources: { station, railway, stationTimetable },
    });
  }

  return sources.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List available ODPT Train source names.
 *
 * @returns Sorted array of source name strings (outDir identifiers).
 */
export async function listOdptTrainSourceNames(): Promise<string[]> {
  const sources = await discoverOdptTrainSources();
  return sources.map((s) => s.name);
}

/**
 * Load a single ODPT Train source by name.
 *
 * @param name - Source identifier (outDir name, e.g. "yurikamome").
 * @returns The resolved ODPT Train source with all required resources.
 * @throws {Error} If the source name is not found among available sources.
 */
export async function loadOdptTrainSource(name: string): Promise<OdptTrainSource> {
  const sources = await discoverOdptTrainSources();
  const source = sources.find((s) => s.name === name);
  if (!source) {
    const available = sources.map((s) => s.name).join(', ');
    throw new Error(`Unknown ODPT Train source: "${name}". Available: ${available || '(none)'}`);
  }
  return source;
}
