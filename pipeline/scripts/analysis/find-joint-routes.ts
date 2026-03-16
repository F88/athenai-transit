/**
 * Finds potential joint operation routes (共同運行路線) by detecting
 * route_short_name matches across different GTFS sources, then compares
 * stop names and coordinates between sources for each candidate.
 *
 * Usage:
 *   npx tsx pipeline/scripts/analysis/find-joint-routes.ts
 *
 * Reads routes.json, timetable.json, and stops.json from each source
 * in public/data/. Full-width/half-width normalization is applied to
 * catch variants like "渋６６" vs "渋66".
 *
 * Output shows both raw (pre-normalization) and normalized differences,
 * plus geographic distances between matched/unmatched stop pairs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeStopName } from '../../lib/normalize-stop-name';

// --- Types (matching transit-json.ts) ---

interface RouteJson {
  i: string; // route_id
  s: string; // route_short_name
  l: string; // route_long_name
  t: number; // route_type
  c: string; // route_color
  tc: string; // route_text_color
  ai: string; // agency_id
}

interface StopJson {
  i: string; // stop_id
  n: string; // stop_name
  a: number; // stop_lat
  o: number; // stop_lon
  l: number; // location_type
  ai: string; // agency_id
}

interface TimetableGroupJson {
  r: string; // route_id
  h: string; // trip_headsign
  d: Record<string, number[]>; // service_id -> departure minutes
  ai: string; // agency_id
}

type TimetableJson = Record<string, TimetableGroupJson[]>;

/** Stop info with name and coordinates. */
interface StopInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

// --- Helpers ---

const DATA_DIR = path.resolve(import.meta.dirname, '../../../public/data');

/**
 * Normalizes full-width alphanumeric/symbols to half-width for comparison.
 * e.g. "渋６６" → "渋66", "Ａ１" → "A1"
 */
function normalizeWidth(s: string): string {
  return s.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function loadJson<T>(source: string, file: string): T | null {
  const filePath = path.join(DATA_DIR, source, file);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

/** Approximate distance in meters between two lat/lon points (~35N). */
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlat = (lat1 - lat2) * 111_000;
  const dlon = (lon1 - lon2) * 91_000;
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

/**
 * Collects stop_ids served by a given route_id from timetable.json.
 */
function getStopIdsForRoute(timetable: TimetableJson, routeId: string): Set<string> {
  const stopIds = new Set<string>();
  for (const [stopId, groups] of Object.entries(timetable)) {
    if (groups.some((g) => g.r === routeId)) {
      stopIds.add(stopId);
    }
  }
  return stopIds;
}

// --- Stop comparison ---

interface SourceStopData {
  source: string;
  routeId: string;
  stops: StopInfo[];
}

function compareStops(entries: JointEntry[]): void {
  const uniqueSources = [...new Set(entries.map((e) => e.source))];

  const sourceData: SourceStopData[] = [];

  for (const source of uniqueSources) {
    const timetable = loadJson<TimetableJson>(source, 'timetable.json');
    const stopsJson = loadJson<StopJson[]>(source, 'stops.json');
    if (!timetable || !stopsJson) {
      console.log(`    ${source}: timetable or stops data missing, skipping`);
      continue;
    }

    const stopMap = new Map(stopsJson.map((s) => [s.i, s]));
    const sourceEntries = entries.filter((e) => e.source === source);

    for (const { route } of sourceEntries) {
      const stopIds = getStopIdsForRoute(timetable, route.i);
      const stops: StopInfo[] = [];
      for (const sid of stopIds) {
        const s = stopMap.get(sid);
        if (s) {
          stops.push({ id: s.i, name: s.n, lat: s.a, lon: s.o });
        }
      }
      sourceData.push({ source, routeId: route.i, stops });
    }
  }

  if (sourceData.length < 2) {
    return;
  }

  for (let i = 0; i < sourceData.length; i++) {
    for (let j = i + 1; j < sourceData.length; j++) {
      if (sourceData[i].source === sourceData[j].source) {
        continue;
      }
      compareSourcePair(sourceData[i], sourceData[j]);
    }
  }
}

/** Find nearest stop in candidates to the given stop. */
function findNearest(
  stop: StopInfo,
  candidates: StopInfo[],
): { stop: StopInfo; distance: number } | null {
  let best: { stop: StopInfo; distance: number } | null = null;
  for (const c of candidates) {
    const d = distanceM(stop.lat, stop.lon, c.lat, c.lon);
    if (!best || d < best.distance) {
      best = { stop: c, distance: d };
    }
  }
  return best;
}

function compareSourcePair(a: SourceStopData, b: SourceStopData): void {
  // Deduplicate by name (keep first occurrence for coords)
  const dedup = (stops: StopInfo[]): StopInfo[] => {
    const seen = new Set<string>();
    return stops.filter((s) => {
      if (seen.has(s.name)) {
        return false;
      }
      seen.add(s.name);
      return true;
    });
  };

  const aStops = dedup(a.stops);
  const bStops = dedup(b.stops);
  const aNameSet = new Set(aStops.map((s) => s.name));
  const bNameSet = new Set(bStops.map((s) => s.name));

  // --- Raw (exact) matching ---
  const rawExact = aStops.filter((s) => bNameSet.has(s.name));

  // --- Normalized matching ---
  const aNormMap = new Map<string, StopInfo[]>();
  for (const s of aStops) {
    const norm = normalizeStopName(s.name);
    const list = aNormMap.get(norm) ?? [];
    list.push(s);
    aNormMap.set(norm, list);
  }

  const bNormMap = new Map<string, StopInfo[]>();
  for (const s of bStops) {
    const norm = normalizeStopName(s.name);
    const list = bNormMap.get(norm) ?? [];
    list.push(s);
    bNormMap.set(norm, list);
  }

  interface NormMatch {
    norm: string;
    aStops: StopInfo[];
    bStops: StopInfo[];
  }

  const normMatched: NormMatch[] = [];
  const normAOnly: StopInfo[] = [];
  const normBOnly: StopInfo[] = [];

  for (const [norm, stops] of aNormMap) {
    const bMatches = bNormMap.get(norm);
    if (bMatches) {
      normMatched.push({ norm, aStops: stops, bStops: bMatches });
    } else {
      normAOnly.push(...stops);
    }
  }
  for (const [norm, stops] of bNormMap) {
    if (!aNormMap.has(norm)) {
      normBOnly.push(...stops);
    }
  }

  const normRecovered = normMatched.filter(
    (m) =>
      m.aStops.some((s) => !bNameSet.has(s.name)) || m.bStops.some((s) => !aNameSet.has(s.name)),
  );

  const total = Math.max(aStops.length, bStops.length);
  const pctRaw = total > 0 ? Math.round((rawExact.length / total) * 100) : 0;
  const pctNorm = total > 0 ? Math.round((normMatched.length / total) * 100) : 0;

  // --- Output ---
  console.log(
    `    Stop comparison: ${a.source} (${aStops.length} stops) vs ${b.source} (${bStops.length} stops)`,
  );
  console.log(`      Raw exact match:        ${rawExact.length}/${total} (${pctRaw}%)`);
  console.log(`      Normalized match:       ${normMatched.length}/${total} (${pctNorm}%)`);

  // Distances for matched stops (both exact and normalized)
  const matchDistances: number[] = [];
  for (const m of normMatched) {
    const as = m.aStops[0];
    const bs = m.bStops[0];
    matchDistances.push(distanceM(as.lat, as.lon, bs.lat, bs.lon));
  }
  if (matchDistances.length > 0) {
    const avg = Math.round(matchDistances.reduce((s, d) => s + d, 0) / matchDistances.length);
    const max = Math.round(Math.max(...matchDistances));
    console.log(`      Matched stop distance:  avg ${avg}m, max ${max}m`);
  }

  if (normRecovered.length > 0) {
    console.log(`      Recovered by normalization (${normRecovered.length}):`);
    for (const m of normRecovered) {
      const as = m.aStops[0];
      const bs = m.bStops[0];
      const dist = Math.round(distanceM(as.lat, as.lon, bs.lat, bs.lon));
      const aNames = [...new Set(m.aStops.map((s) => s.name))].join(', ');
      const bNames = [...new Set(m.bStops.map((s) => s.name))].join(', ');
      console.log(`        "${aNames}" <-> "${bNames}"  (${dist}m)`);
    }
  }

  // Unmatched stops with nearest neighbor from other source
  if (normAOnly.length > 0) {
    console.log(`      Unmatched in ${a.source} (${normAOnly.length}):`);
    for (const s of normAOnly) {
      const nearest = findNearest(s, bStops);
      const nearestInfo = nearest
        ? `nearest: "${nearest.stop.name}" ${Math.round(nearest.distance)}m`
        : '';
      console.log(`        "${s.name}"  ${nearestInfo}`);
    }
  }
  if (normBOnly.length > 0) {
    console.log(`      Unmatched in ${b.source} (${normBOnly.length}):`);
    for (const s of normBOnly) {
      const nearest = findNearest(s, aStops);
      const nearestInfo = nearest
        ? `nearest: "${nearest.stop.name}" ${Math.round(nearest.distance)}m`
        : '';
      console.log(`        "${s.name}"  ${nearestInfo}`);
    }
  }
}

// --- Route matching ---

interface JointEntry {
  source: string;
  route: RouteJson;
}

function findJointCandidates(sources: string[]): [string, JointEntry[]][] {
  const nameMap = new Map<string, JointEntry[]>();

  for (const source of sources) {
    const routes = loadJson<RouteJson[]>(source, 'routes.json') ?? [];
    for (const route of routes) {
      if (!route.s) {
        continue;
      }
      const key = normalizeWidth(route.s);
      const entries = nameMap.get(key) ?? [];
      entries.push({ source, route });
      nameMap.set(key, entries);
    }
  }

  return [...nameMap.entries()]
    .filter(([, entries]) => {
      const uniqueSources = new Set(entries.map((e) => e.source));
      return uniqueSources.size >= 2;
    })
    .sort(([a], [b]) => a.localeCompare(b));
}

// --- Main ---

function main(): void {
  const sources = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const jointCandidates = findJointCandidates(sources);

  if (jointCandidates.length === 0) {
    console.log('No joint operation route candidates found.');
    return;
  }

  console.log(`Found ${jointCandidates.length} potential joint operation route(s):\n`);

  for (const [normalizedName, entries] of jointCandidates) {
    const uniqueSources = [...new Set(entries.map((e) => e.source))];

    // Show route info with raw vs normalized name
    const rawNames = [...new Set(entries.map((e) => e.route.s))];
    const nameLabel = rawNames.every((n) => n === rawNames[0])
      ? normalizedName
      : `${normalizedName}  (raw: ${rawNames.join(' / ')})`;
    console.log(`  ${nameLabel}  [${uniqueSources.join(', ')}]`);

    for (const source of uniqueSources) {
      const sourceRoutes = entries.filter((e) => e.source === source);
      for (const { route } of sourceRoutes) {
        const fields = [`id=${route.i}`, `short="${route.s}"`, route.l ? `long="${route.l}"` : null]
          .filter(Boolean)
          .join('  ');
        console.log(`    ${source}: ${fields}`);
      }
    }

    compareStops(entries);
    console.log();
  }
}

main();
