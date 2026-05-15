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

import { getServiceDay } from '../domain/transit/service-day';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { StopWithMeta } from '../types/app/transit-composed';

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

async function benchStopMetaById(
  repo: TransitRepository,
  stops: StopWithMeta[],
  sampleSize: number,
): Promise<{ ms: number; resolved: number; calls: number }> {
  const n = Math.min(sampleSize, stops.length);
  const t0 = performance.now();
  let resolved = 0;
  for (let i = 0; i < n; i++) {
    const result = await repo.getStopMetaById(stops[i].stop.stop_id);
    if (result.success) {
      resolved++;
    }
  }
  return { ms: performance.now() - t0, resolved, calls: n };
}

function benchStopMetaByIds(
  repo: TransitRepository,
  stops: StopWithMeta[],
): { ms: number; resolved: number; requested: number } {
  const ids = new Set(stops.map((s) => s.stop.stop_id));
  const t0 = performance.now();
  const metas = repo.getStopMetaByIds(ids);
  return { ms: performance.now() - t0, resolved: metas.length, requested: ids.size };
}

async function benchTripInspection(
  repo: TransitRepository,
  stops: StopWithMeta[],
  serviceDate: Date,
  snapshotsPerStop: number,
): Promise<{
  targetsMs: number;
  targetsCount: number;
  targetsCalls: number;
  snapshotMs: number;
  snapshotsCount: number;
  snapshotCalls: number;
}> {
  let targetsMs = 0;
  let targetsCount = 0;
  let targetsCalls = 0;
  let snapshotMs = 0;
  let snapshotsCount = 0;
  let snapshotCalls = 0;
  for (const stop of stops) {
    const t0 = performance.now();
    const result = await repo.getTripInspectionTargets({
      stopId: stop.stop.stop_id,
      serviceDate,
    });
    targetsMs += performance.now() - t0;
    targetsCalls++;
    if (!result.success || result.data.length === 0) {
      continue;
    }
    targetsCount += result.data.length;
    const sampleN = Math.min(snapshotsPerStop, result.data.length);
    for (let i = 0; i < sampleN; i++) {
      const target = result.data[i];
      if (!target) {
        continue;
      }
      const s0 = performance.now();
      const snap = repo.getTripSnapshot(target.tripLocator, target.serviceDate);
      snapshotMs += performance.now() - s0;
      snapshotCalls++;
      if (snap.success) {
        snapshotsCount++;
      }
    }
  }
  return {
    targetsMs,
    targetsCount,
    targetsCalls,
    snapshotMs,
    snapshotsCount,
    snapshotCalls,
  };
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
    let totalRoutes = 0;
    let totalTripPatterns = 0;
    for (const sm of meta.value.data) {
      totalRoutes += sm.stats.routeCount;
      totalTripPatterns += sm.stats.tripPatternCount;
    }
    logger.info(
      `Dataset: ${meta.value.data.length} sources, ${allStops.value.data.length} stops, ${totalRoutes} routes, ${totalTripPatterns} trip patterns`,
    );
  }

  const catalog = timed(() => repository.getDataSourceCatalog());
  if (catalog.value) {
    const sourceCount = Object.keys(catalog.value.sources.data).length;
    logger.info(
      `getDataSourceCatalog: ${catalog.ms.toFixed(2)}ms (${sourceCount} sources, createdAt=${catalog.value.metadata.data.createdAt})`,
    );
  } else {
    logger.info(`getDataSourceCatalog: ${catalog.ms.toFixed(2)}ms (unavailable)`);
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
  const stopMetaById = { ms: 0, resolved: 0, calls: 0 };
  const stopMetaByIds = { ms: 0, resolved: 0, requested: 0, calls: 0 };
  const tripTargets = { ms: 0, count: 0, calls: 0 };
  const tripSnapshot = { ms: 0, count: 0, calls: 0 };
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

      const sm = await benchStopMetaById(repository, nearbyStops, 5);
      stopMetaById.ms += sm.ms;
      stopMetaById.resolved += sm.resolved;
      stopMetaById.calls += sm.calls;

      const sms = benchStopMetaByIds(repository, nearbyStops);
      stopMetaByIds.ms += sms.ms;
      stopMetaByIds.resolved += sms.resolved;
      stopMetaByIds.requested += sms.requested;
      stopMetaByIds.calls++;

      const ti = await benchTripInspection(repository, nearbyStops, serviceDate, 3);
      tripTargets.ms += ti.targetsMs;
      tripTargets.count += ti.targetsCount;
      tripTargets.calls += ti.targetsCalls;
      tripSnapshot.ms += ti.snapshotMs;
      tripSnapshot.count += ti.snapshotsCount;
      tripSnapshot.calls += ti.snapshotCalls;
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
  logger.info(
    `getStopMetaById (${stopMetaById.calls} calls): ${stopMetaById.ms.toFixed(2)}ms total, ${avg(stopMetaById.ms, stopMetaById.calls)}ms/call, ${stopMetaById.resolved} resolved`,
  );
  logger.info(
    `getStopMetaByIds (${stopMetaByIds.calls} batches, ${stopMetaByIds.requested} ids): ${stopMetaByIds.ms.toFixed(2)}ms total, ${avg(stopMetaByIds.ms, stopMetaByIds.calls)}ms/batch, ${stopMetaByIds.resolved} resolved`,
  );
  logger.info(
    `getTripInspectionTargets (${tripTargets.calls} calls): ${tripTargets.ms.toFixed(2)}ms total, ${avg(tripTargets.ms, tripTargets.calls)}ms/call, ${tripTargets.count} targets`,
  );
  logger.info(
    `getTripSnapshot (${tripSnapshot.calls} calls): ${tripSnapshot.ms.toFixed(2)}ms total, ${avg(tripSnapshot.ms, tripSnapshot.calls)}ms/call, ${tripSnapshot.count} snapshots`,
  );

  logger.info(`Benchmark complete: ${(performance.now() - t0).toFixed(2)}ms`);
}
