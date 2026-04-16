/**
 * @module repo-benchmark
 *
 * Benchmarks TransitRepository API query performance.
 *
 * Measures wall-clock time for each repository method using the
 * currently loaded data. Works with any TransitRepository implementation
 * (v1, v2, mock) — use `?repo=` to select, then `?diag=repo-bench`.
 *
 * Runs benchmarks at multiple HOME_LOCATIONS to simulate real user
 * navigation patterns across different areas.
 *
 * Example:
 *   ?diag=repo-bench           → benchmark v1 repo
 *   ?diag=repo-bench&repo=v2   → benchmark v2 repo
 */

import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { StopWithMeta } from '../types/app/transit-composed';
import { getServiceDay } from '../domain/transit/service-day';

const logger = createLogger('diag:repo-bench');

/** Representative locations for benchmarking. */
const BENCH_LOCATIONS = [
  { name: 'Tokyo Station', lat: 35.6812, lng: 139.7671 },
  { name: 'Kumano-mae', lat: 35.7485, lng: 139.7699 },
  { name: 'Kinshicho Station', lat: 35.6967, lng: 139.8139 },
  { name: 'Tokyo Big Sight', lat: 35.6302, lng: 139.793 },
  { name: 'Shibuya Station', lat: 35.6591, lng: 139.7026 },
  { name: 'Otsuka Station', lat: 35.731, lng: 139.7291 },
  { name: 'Nerima Station', lat: 35.7379, lng: 139.6542 },
  { name: 'Chiyoda City Hall', lat: 35.6948, lng: 139.7533 },
  { name: 'Ikebukuro Station', lat: 35.7299, lng: 139.7108 },
  { name: 'Shinjuku Station West', lat: 35.6913, lng: 139.6985 },
  { name: 'Nagoya', lat: 35.1697, lng: 136.8954 },
  { name: 'Matsuyama (Okaido)', lat: 33.8412, lng: 132.7701 },
] as const;

// ---------------------------------------------------------------------------
// Timing helper
// ---------------------------------------------------------------------------

interface TimedResult<T> {
  value: T;
  ms: number;
}

function timed<T>(fn: () => T): TimedResult<T> {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

async function timedAsync<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - t0 };
}

// ---------------------------------------------------------------------------
// Per-stop benchmarks
// ---------------------------------------------------------------------------

async function benchUpcoming(
  repo: TransitRepository,
  stops: StopWithMeta[],
  now: Date,
  limit?: number,
): Promise<{ ms: number; entries: number }> {
  const t0 = performance.now();
  let entries = 0;
  for (const s of stops) {
    const result = await repo.getUpcomingTimetableEntries(s.stop.stop_id, now, limit);
    if (result.success) {
      entries += result.data.length;
    }
  }
  return { ms: performance.now() - t0, entries };
}

async function benchRouteTypes(repo: TransitRepository, stops: StopWithMeta[]): Promise<number> {
  const t0 = performance.now();
  for (const s of stops) {
    await repo.getRouteTypesForStop(s.stop.stop_id);
  }
  return performance.now() - t0;
}

async function benchFullDay(
  repo: TransitRepository,
  stops: StopWithMeta[],
  now: Date,
  sampleSize: number,
): Promise<{ ms: number; deps: number }> {
  const n = Math.min(sampleSize, stops.length);
  const t0 = performance.now();
  let deps = 0;
  for (let i = 0; i < n; i++) {
    const result = await repo.getFullDayTimetableEntries(stops[i].stop.stop_id, now);
    if (result.success) {
      deps += result.data.length;
    }
  }
  return { ms: performance.now() - t0, deps };
}

function benchStopsForRoutes(
  repo: TransitRepository,
  stops: StopWithMeta[],
): { ms: number; stopCount: number } | null {
  const routeIds = new Set(stops[0].routes.map((r) => r.route_id));
  if (routeIds.size === 0) {
    return null;
  }
  const { value: stopIds, ms } = timed(() => repo.getStopsForRoutes(routeIds));
  return { ms, stopCount: stopIds.size };
}

function benchResolveStopStats(
  repo: TransitRepository,
  stops: StopWithMeta[],
  serviceDate: Date,
): { ms: number; resolved: number } {
  const t0 = performance.now();
  let resolved = 0;
  for (const s of stops) {
    if (repo.resolveStopStats(s.stop.stop_id, serviceDate) !== undefined) {
      resolved++;
    }
  }
  return { ms: performance.now() - t0, resolved };
}

function benchResolveRouteFreq(
  repo: TransitRepository,
  stops: StopWithMeta[],
  serviceDate: Date,
): { ms: number; resolved: number; total: number } {
  const t0 = performance.now();
  let resolved = 0;
  const seen = new Set<string>();
  for (const s of stops) {
    for (const route of s.routes) {
      if (!seen.has(route.route_id)) {
        seen.add(route.route_id);
        if (repo.resolveRouteFreq(route.route_id, serviceDate) !== undefined) {
          resolved++;
        }
      }
    }
  }
  return { ms: performance.now() - t0, resolved, total: seen.size };
}

// ---------------------------------------------------------------------------
// Summary formatting
// ---------------------------------------------------------------------------

function avg(total: number, count: number): string {
  return (count > 0 ? total / count : 0).toFixed(2);
}

// ---------------------------------------------------------------------------
// Main benchmark
// ---------------------------------------------------------------------------

/**
 * Run benchmark suite on the given repository.
 *
 * Tests each API method at multiple locations with realistic parameters.
 * Results are logged to the console.
 *
 * @param repository - The active TransitRepository instance.
 */
export async function runRepoBenchmark(repository: TransitRepository): Promise<void> {
  logger.info(`Starting repository benchmark (${BENCH_LOCATIONS.length} locations)...`);
  const t0 = performance.now();
  const now = new Date();

  // --- Global benchmarks ---
  const allStops = await timedAsync(() => repository.getAllStops());
  if (!allStops.value.success) {
    logger.warn('getAllStops failed, cannot continue benchmark');
    return;
  }
  logger.info(`getAllStops: ${allStops.ms.toFixed(2)}ms (${allStops.value.data.length} stops)`);

  const shapes = await timedAsync(() => repository.getRouteShapes());
  if (shapes.value.success) {
    logger.info(`getRouteShapes: ${shapes.ms.toFixed(2)}ms (${shapes.value.data.length} shapes)`);
  }

  const meta = await timedAsync(() => repository.getAllSourceMeta());
  if (meta.value.success) {
    logger.info(`getAllSourceMeta: ${meta.ms.toFixed(2)}ms (${meta.value.data.length} sources)`);
  }

  // --- Per-location accumulators ---
  let totalNearby = 0;
  let totalBoundsMs = 0;
  let totalNearbyMs = 0;
  let totalStops = 0;
  const upcomingLimit = { ms: 0, entries: 0 };
  const upcomingNoLimit = { ms: 0, entries: 0 };
  let routeTypesMs = 0;
  const fullDay = { ms: 0, deps: 0 };
  const stopsForRoutes = { ms: 0, stopCount: 0, calls: 0 };
  const resolveStats = { ms: 0, resolved: 0, total: 0 };
  const resolveFreq = { ms: 0, resolved: 0, total: 0 };
  const serviceDate = getServiceDay(now);

  for (const loc of BENCH_LOCATIONS) {
    const bounds = {
      north: loc.lat + 0.005,
      south: loc.lat - 0.005,
      east: loc.lng + 0.006,
      west: loc.lng - 0.006,
    };
    const boundsResult = await timedAsync(() => repository.getStopsInBounds(bounds, 1000));
    totalBoundsMs += boundsResult.ms;

    const nearbyResult = await timedAsync(() =>
      repository.getStopsNearby({ lat: loc.lat, lng: loc.lng }, 1000, 1000),
    );
    totalNearbyMs += nearbyResult.ms;

    const nearbyStops = nearbyResult.value.success ? nearbyResult.value.data : [];
    totalNearby += nearbyStops.length;

    if (nearbyStops.length > 0) {
      totalStops += nearbyStops.length;

      const ul = await benchUpcoming(repository, nearbyStops, now, 3);
      upcomingLimit.ms += ul.ms;
      upcomingLimit.entries += ul.entries;

      const unl = await benchUpcoming(repository, nearbyStops, now);
      upcomingNoLimit.ms += unl.ms;
      upcomingNoLimit.entries += unl.entries;

      routeTypesMs += await benchRouteTypes(repository, nearbyStops);

      const fd = await benchFullDay(repository, nearbyStops, now, 2);
      fullDay.ms += fd.ms;
      fullDay.deps += fd.deps;

      const sfr = benchStopsForRoutes(repository, nearbyStops);
      if (sfr) {
        stopsForRoutes.ms += sfr.ms;
        stopsForRoutes.stopCount += sfr.stopCount;
        stopsForRoutes.calls++;
      }

      const rs = benchResolveStopStats(repository, nearbyStops, serviceDate);
      resolveStats.ms += rs.ms;
      resolveStats.resolved += rs.resolved;
      resolveStats.total += nearbyStops.length;

      const rf = benchResolveRouteFreq(repository, nearbyStops, serviceDate);
      resolveFreq.ms += rf.ms;
      resolveFreq.resolved += rf.resolved;
      resolveFreq.total += rf.total;
    }

    const inBound = boundsResult.value.success ? boundsResult.value.data.length : 0;
    logger.info(`  ${loc.name}: nearby=${nearbyStops.length} inBound=${inBound}`);
  }

  // --- Summary ---
  const n = BENCH_LOCATIONS.length;
  logger.info('--- Summary ---');
  logger.info(`getStopsInBounds (${n} locations): ${totalBoundsMs.toFixed(2)}ms total`);
  logger.info(
    `getStopsNearby (${n} locations): ${totalNearbyMs.toFixed(2)}ms total, ${totalNearby} stops`,
  );
  logger.info(
    `getUpcomingTimetableEntries limit=3 (${totalStops} stops): ${upcomingLimit.ms.toFixed(2)}ms total, ${avg(upcomingLimit.ms, totalStops)}ms/stop, ${upcomingLimit.entries} entries`,
  );
  logger.info(
    `getUpcomingTimetableEntries no-limit (${totalStops} stops): ${upcomingNoLimit.ms.toFixed(2)}ms total, ${avg(upcomingNoLimit.ms, totalStops)}ms/stop, ${upcomingNoLimit.entries} entries`,
  );
  logger.info(`getRouteTypesForStop (${totalStops} stops): ${routeTypesMs.toFixed(2)}ms total`);
  logger.info(
    `getFullDayTimetableEntries: ${fullDay.ms.toFixed(2)}ms total, ${fullDay.deps} stop times`,
  );
  logger.info(
    `getStopsForRoutes (${stopsForRoutes.calls} calls): ${stopsForRoutes.ms.toFixed(2)}ms total, ${avg(stopsForRoutes.ms, stopsForRoutes.calls)}ms/call, ${stopsForRoutes.stopCount} stops`,
  );
  logger.info(
    `resolveStopStats (${resolveStats.total} stops): ${resolveStats.ms.toFixed(2)}ms total, ${avg(resolveStats.ms, resolveStats.total)}ms/stop, ${resolveStats.resolved} resolved`,
  );
  logger.info(
    `resolveRouteFreq (${resolveFreq.total} routes, ${resolveFreq.resolved} resolved): ${resolveFreq.ms.toFixed(2)}ms total`,
  );

  logger.info(`Benchmark complete: ${(performance.now() - t0).toFixed(2)}ms`);
}
