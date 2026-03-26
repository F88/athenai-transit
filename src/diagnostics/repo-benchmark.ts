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

import { createLogger } from '../utils/logger';
import type { TransitRepository } from '../repositories/transit-repository';

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

  // --- getAllStops ---
  const stopsT0 = performance.now();
  const allStopsResult = await repository.getAllStops();
  const stopsMs = performance.now() - stopsT0;
  if (!allStopsResult.success) {
    logger.warn('getAllStops failed, cannot continue benchmark');
    return;
  }
  logger.info(`getAllStops: ${stopsMs.toFixed(2)}ms (${allStopsResult.data.length} stops)`);

  // --- getRouteShapes ---
  const shapesT0 = performance.now();
  const shapesResult = await repository.getRouteShapes();
  const shapesMs = performance.now() - shapesT0;
  if (shapesResult.success) {
    logger.info(`getRouteShapes: ${shapesMs.toFixed(2)}ms (${shapesResult.data.length} shapes)`);
  }

  // --- getAllSourceMeta ---
  const metaT0 = performance.now();
  const metaResult = await repository.getAllSourceMeta();
  const metaMs = performance.now() - metaT0;
  if (metaResult.success) {
    logger.info(`getAllSourceMeta: ${metaMs.toFixed(2)}ms (${metaResult.data.length} sources)`);
  }

  // --- Per-location benchmarks ---
  let totalNearby = 0;
  let totalBoundsMs = 0;
  let totalNearbyMs = 0;
  let totalDeparturesMs = 0;
  let totalDepartureStops = 0;
  let totalDepartureEntries = 0;
  let totalDeparturesNoLimitMs = 0;
  let totalDepartureNoLimitEntries = 0;
  let totalRouteTypesMs = 0;
  let totalFullDayMs = 0;
  let totalFullDayDeps = 0;

  for (const loc of BENCH_LOCATIONS) {
    // getStopsInBounds (~1km viewport)
    const bounds = {
      north: loc.lat + 0.005,
      south: loc.lat - 0.005,
      east: loc.lng + 0.006,
      west: loc.lng - 0.006,
    };
    const boundsT0 = performance.now();
    const boundsResult = await repository.getStopsInBounds(bounds, 1000);
    totalBoundsMs += performance.now() - boundsT0;

    // getStopsNearby (1km)
    const nearbyT0 = performance.now();
    const nearbyResult = await repository.getStopsNearby(
      { lat: loc.lat, lng: loc.lng },
      1000,
      1000,
    );
    totalNearbyMs += performance.now() - nearbyT0;

    const nearbyCount = nearbyResult.success ? nearbyResult.data.length : 0;
    totalNearby += nearbyCount;

    // getUpcomingTimetableEntries for all nearby stops (simulates real usage)
    if (nearbyResult.success && nearbyResult.data.length > 0) {
      const depT0 = performance.now();
      let entries = 0;
      for (const stopMeta of nearbyResult.data) {
        const result = await repository.getUpcomingTimetableEntries(stopMeta.stop.stop_id, now, 3);
        if (result.success) {
          entries += result.data.length;
        }
      }
      totalDeparturesMs += performance.now() - depT0;
      totalDepartureStops += nearbyResult.data.length;
      totalDepartureEntries += entries;
    }

    // getUpcomingTimetableEntries without limit (simulates NearbyStop real usage)
    if (nearbyResult.success && nearbyResult.data.length > 0) {
      const depT0 = performance.now();
      let entries = 0;
      for (const stopMeta of nearbyResult.data) {
        const result = await repository.getUpcomingTimetableEntries(stopMeta.stop.stop_id, now);
        if (result.success) {
          entries += result.data.length;
        }
      }
      totalDeparturesNoLimitMs += performance.now() - depT0;
      totalDepartureNoLimitEntries += entries;
    }

    // getRouteTypesForStop for all nearby stops
    if (nearbyResult.success && nearbyResult.data.length > 0) {
      const rtT0 = performance.now();
      for (const stopMeta of nearbyResult.data) {
        await repository.getRouteTypesForStop(stopMeta.stop.stop_id);
      }
      totalRouteTypesMs += performance.now() - rtT0;
    }

    // getFullDayTimetableEntries (first 2 stops per location)
    if (nearbyResult.success && nearbyResult.data.length > 0) {
      const sampleSize = Math.min(2, nearbyResult.data.length);
      const fdT0 = performance.now();
      for (let i = 0; i < sampleSize; i++) {
        const result = await repository.getFullDayTimetableEntries(
          nearbyResult.data[i].stop.stop_id,
          now,
        );
        if (result.success) {
          totalFullDayDeps += result.data.length;
        }
      }
      totalFullDayMs += performance.now() - fdT0;
    }

    const inBound = boundsResult.success ? boundsResult.data.length : 0;
    logger.info(`  ${loc.name}: nearby=${nearbyCount} inBound=${inBound}`);
  }

  // --- Summary ---
  logger.info('--- Summary ---');
  logger.info(
    `getStopsInBounds (${BENCH_LOCATIONS.length} locations): ${totalBoundsMs.toFixed(2)}ms total`,
  );
  logger.info(
    `getStopsNearby (${BENCH_LOCATIONS.length} locations): ${totalNearbyMs.toFixed(2)}ms total, ${totalNearby} stops`,
  );
  logger.info(
    `getUpcomingTimetableEntries limit=3 (${totalDepartureStops} stops): ${totalDeparturesMs.toFixed(2)}ms total, ${(totalDepartureStops > 0 ? totalDeparturesMs / totalDepartureStops : 0).toFixed(2)}ms/stop, ${totalDepartureEntries} entries`,
  );
  logger.info(
    `getUpcomingTimetableEntries no-limit (${totalDepartureStops} stops): ${totalDeparturesNoLimitMs.toFixed(2)}ms total, ${(totalDepartureStops > 0 ? totalDeparturesNoLimitMs / totalDepartureStops : 0).toFixed(2)}ms/stop, ${totalDepartureNoLimitEntries} entries`,
  );
  logger.info(
    `getRouteTypesForStop (${totalDepartureStops} stops): ${totalRouteTypesMs.toFixed(2)}ms total`,
  );
  logger.info(
    `getFullDayTimetableEntries: ${totalFullDayMs.toFixed(2)}ms total, ${totalFullDayDeps} departures`,
  );

  const totalMs = performance.now() - t0;
  logger.info(`Benchmark complete: ${totalMs.toFixed(2)}ms`);
}
