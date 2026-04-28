/**
 * Build TripPatternJson and TimetableGroupV2Json from ODPT data.
 *
 * # Scope
 *
 * Facade for ODPT TRAIN sources. This module owns the orchestration:
 *
 * - Phase 1: per-unit dispatch to canonical fast path / heuristic
 *   inference / legacy fallback.
 * - Phase 2 (a): pattern aggregation, deterministic sort, ID assignment.
 * - Phase 2 (b): stopTimetable enrollment.
 * - Wrapper-only: `console.warn` formatting from collected diagnostics.
 *
 * The heuristic core (count-delta + time-matching trip-identity
 * inference) lives in `./infer-odpt-trips-heuristic` and is **tuned
 * for Yurikamome-like data**. That module documents its assumptions
 * and limitations in detail; consult it before extending support to
 * other operators. This facade dispatches to the heuristic only when
 * canonical trip identity (`odpt:originStation`) is unavailable, and
 * routes to legacy fallback (origin = line-start) when the heuristic's
 * preconditions are violated (non-monotonic counts, layer 1/2
 * mismatch, missing travel-time pair, etc.).
 *
 * # Algorithm overview
 *
 * D13 phase ordering:
 *   Phase 1: per-unit inference
 *     For each (railway, direction, effectiveDestination, calendar) unit:
 *       canonical fast path (D2/D7), or
 *       Layer 1 monotonic check (D1) -> Layer 2 time-matching (Step 2),
 *       or legacy fallback (D3/D16/D1) when inference rejected.
 *     -> Trip[] per unit, retained in memory.
 *   Phase 2 (a): pattern aggregation + sort + ID assignment
 *     Build patternMap from trips' (origin, destination), sort, assign p1, p2, ...
 *   Phase 2 (b): stopTimetable enrollment
 *     Re-walk Trip[] and enroll each entry into stopTimetable.
 *
 * pt/dt: ODPT has no pickup/drop-off concept, so omitted (undefined).
 *
 * See Issue #153 and PR #158 for design rationale and the phased
 * decision log (D1〜D16) that this module implements.
 */

import type {
  TimetableGroupV2Json,
  TripPatternJson,
} from '../../../../../../src/types/data/transit-v2-json';
import type {
  OdptRailway,
  OdptStationOrder,
  OdptStationTimetable,
} from '../../../../types/odpt-train';
import { calendarToServiceId } from '../../../odpt-calendar-utils';
import { extractStationShortId } from './build-stops';
import {
  buildCanonicalTrips,
  canUseCanonicalOrigin,
  checkMonotonic,
  countLayer1Origins,
  DIRECTION_OUTBOUND,
  estimateTravelTimes,
  FULL_ROUTE_SENTINEL,
  inferTripsForDestination,
  preprocessTimetables,
  type EntryEvent,
  type RailwayInfo,
  type Trip,
  type UnitKey,
} from './infer-odpt-trips-heuristic';
import { ODPT_WARN_CODES, type OdptDiagnostic } from './warn-codes';

// ---------------------------------------------------------------------------
// Helpers (existing, public-by-design)
// ---------------------------------------------------------------------------

/**
 * Determine headsign from destination station.
 * Looks up the station title from stationOrder by matching the station URI.
 * Falls back to direction-based terminal if destination is not found.
 */
export function getHeadsignFromDestination(
  destination: string | undefined,
  direction: string,
  stationOrder: OdptStationOrder[],
): string {
  if (destination) {
    const entry = stationOrder.find((so) => so['odpt:station'] === destination);
    if (entry) {
      return entry['odpt:stationTitle'].ja;
    }
  }
  if (direction === DIRECTION_OUTBOUND) {
    return stationOrder[stationOrder.length - 1]['odpt:stationTitle'].ja;
  }
  return stationOrder[0]['odpt:stationTitle'].ja;
}

// ---------------------------------------------------------------------------
// Helpers (Step 3 / Step 4): pattern key & stop sequence, both origin-aware
// ---------------------------------------------------------------------------

/**
 * Build ordered stop sequence for a pattern, sliced from origin to
 * effective destination (D14 normalization applies on the dest side;
 * F4 origin-normalization applies on the origin side).
 *
 * @internal
 */
function buildStopSequence(
  direction: string,
  origin: string | undefined,
  effectiveDest: string,
  rw: RailwayInfo,
  prefix: string,
): TripPatternJson['stops'] {
  const allStops = rw.stationOrder.map((so) => ({
    id: `${prefix}:${extractStationShortId(so['odpt:station'])}`,
  }));

  const originIdx = origin ? rw.stationIndexMap.get(origin) : undefined;
  const destIdx =
    effectiveDest === FULL_ROUTE_SENTINEL ? undefined : rw.stationIndexMap.get(effectiveDest);

  if (direction === DIRECTION_OUTBOUND) {
    const startIdx = originIdx ?? 0;
    const endIdx = destIdx != null ? destIdx + 1 : allStops.length;
    return allStops.slice(startIdx, endIdx);
  }
  // Inbound: reversed.
  const startIdx = originIdx != null ? originIdx + 1 : allStops.length;
  const endIdx = destIdx != null ? destIdx : 0;
  return [...allStops.slice(endIdx, startIdx)].reverse();
}

/**
 * Deterministic sort key for a pattern.
 * origin is implicitly hashed via stops[0].id (F5).
 */
function patternSortKey(
  routeId: string,
  headsign: string,
  stops: TripPatternJson['stops'],
): string {
  return `${routeId}\0${headsign}\0${JSON.stringify(stops.map((s) => s.id))}`;
}

// ---------------------------------------------------------------------------
// Legacy fallback (D3 / D16 / D1): origin = line-start, all trips in 1 pattern
// ---------------------------------------------------------------------------

/**
 * Build legacy trips for a unit (origin = line-start). Used when
 * inference is rejected per D1 / D3 / D16 / D5. Mirrors pre-fix
 * behavior: a single trip per (calendar) bucket containing every
 * entry at every observed station.
 *
 * Note: legacy trips do not carry trip identity. We emit one Trip per
 * unit, with `entries` containing all observations grouped by station.
 * This is structurally compatible with the existing pre-fix output
 * because Step 5 enrolls per (station, patternId, serviceId).
 */
function buildLegacyTrips(
  unitEntries: EntryEvent[],
  rw: RailwayInfo,
  direction: string,
  destinationStation: string,
): Trip[] {
  if (unitEntries.length === 0) {
    return [];
  }
  // Origin = line-start (Outbound: stationOrder[0]; Inbound: stationOrder[last]).
  const lineStart =
    direction === DIRECTION_OUTBOUND
      ? rw.stationOrder[0]['odpt:station']
      : rw.stationOrder[rw.stationOrder.length - 1]['odpt:station'];
  return [
    {
      origin: lineStart,
      destination: destinationStation,
      calendar: unitEntries[0].calendar,
      entries: unitEntries,
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Build trip patterns and timetable from ODPT data.
 *
 * Patterns are keyed by (routeId, direction, origin, effectiveDestination)
 * to correctly separate mid-pattern-origin trips (e.g. Yurikamome Ariake
 * starting trips) from full-route trips. See Plan and Issue #153.
 */
export function buildTripPatternsAndTimetableFromOdpt(
  prefix: string,
  timetables: OdptStationTimetable[],
  railways: OdptRailway[],
): {
  tripPatterns: Record<string, TripPatternJson>;
  timetable: Record<string, TimetableGroupV2Json[]>;
} {
  const railwayInfos: RailwayInfo[] = railways.map((rw) => {
    const indexMap = new Map<string, number>();
    for (let idx = 0; idx < rw['odpt:stationOrder'].length; idx++) {
      indexMap.set(rw['odpt:stationOrder'][idx]['odpt:station'], idx);
    }
    return {
      routeId: `${prefix}:${rw['odpt:lineCode']}`,
      stationOrder: rw['odpt:stationOrder'],
      stationIndexMap: indexMap,
    };
  });

  const stationToRailways = new Map<string, RailwayInfo[]>();
  for (const rw of railwayInfos) {
    for (const so of rw.stationOrder) {
      const station = so['odpt:station'];
      let list = stationToRailways.get(station);
      if (!list) {
        list = [];
        stationToRailways.set(station, list);
      }
      list.push(rw);
    }
  }

  const railwayInfoById = new Map<string, RailwayInfo>();
  for (const rw of railwayInfos) {
    railwayInfoById.set(rw.routeId, rw);
  }

  // Step 0 (D9): pre-pass normalization.
  const allDiagnostics: OdptDiagnostic[] = [];
  const { unitGroups, diagnostics: ppDiag } = preprocessTimetables(timetables, stationToRailways);
  allDiagnostics.push(...ppDiag);

  // Phase 1 (D13): per-unit inference -> tripsByUnit.
  const tripsByUnit = new Map<UnitKey, Trip[]>();

  for (const [unitKey, unitEntries] of unitGroups) {
    const parts = unitKey.split('\0');
    const railwayId = parts[0];
    const direction = parts[1];
    const effDest = parts[2];
    const calendar = parts[3];
    const rw = railwayInfoById.get(railwayId);
    if (!rw) {
      continue;
    }

    // Resolve completion-station URI for inference: the sentinel '__full__'
    // becomes the line terminal in trip direction.
    const destForInference =
      effDest === FULL_ROUTE_SENTINEL
        ? direction === DIRECTION_OUTBOUND
          ? rw.stationOrder[rw.stationOrder.length - 1]['odpt:station']
          : rw.stationOrder[0]['odpt:station']
        : effDest;

    // D2 / D7: canonical fast path.
    const canonical = canUseCanonicalOrigin(unitEntries, unitKey);
    allDiagnostics.push(...canonical.diagnostics);
    if (canonical.ok) {
      // Group entries by `originStation`, then within each group by station.
      const trips = buildCanonicalTrips(unitEntries, destForInference, calendar);
      tripsByUnit.set(unitKey, trips);
      continue;
    }

    // D1 / observation sparsity: inference requires at least 2 observed
    // stations to apply count delta meaningfully. With <2 stations there
    // is no upstream signal to identify origin, so fall back to legacy
    // (= origin assumed line-start). This matches pre-fix behavior for
    // sparse fixtures where intermediate stations lack timetables.
    const observedStationCount = new Set(unitEntries.map((e) => e.station)).size;
    if (observedStationCount < 2) {
      tripsByUnit.set(unitKey, buildLegacyTrips(unitEntries, rw, direction, destForInference));
      continue;
    }

    // D1: monotonic check.
    if (!checkMonotonic(unitEntries, rw, direction)) {
      allDiagnostics.push({
        code: ODPT_WARN_CODES.INFERENCE_SKIPPED_NON_MONOTONIC,
        unit: unitKey,
        detail: 'per-station entry counts are non-monotonic in trip direction',
      });
      tripsByUnit.set(unitKey, buildLegacyTrips(unitEntries, rw, direction, destForInference));
      continue;
    }

    // D5: travel-time estimation.
    const tt = estimateTravelTimes(unitEntries, rw, direction, unitKey);
    allDiagnostics.push(...tt.diagnostics);
    if (tt.diagnostics.some((d) => d.code === ODPT_WARN_CODES.TRAVEL_TIME_PAIR_MISSING)) {
      // D16: any pair missing -> unit fallback to legacy.
      tripsByUnit.set(unitKey, buildLegacyTrips(unitEntries, rw, direction, destForInference));
      continue;
    }

    // Step 2: time-matching inference.
    const inferred = inferTripsForDestination(
      unitEntries,
      tt.travelTimes,
      rw,
      direction,
      destForInference,
      unitKey,
    );
    allDiagnostics.push(...inferred.diagnostics);

    // D3: Layer 1 vs Layer 2 mismatch check.
    // Layer 1 origin candidate count = entries observed at stations whose
    // upstream neighbor saw fewer trips. Compute against the full unit and
    // compare to the count of trips inferred.
    const layer1OriginCount = countLayer1Origins(unitEntries, rw, direction);
    const layer2OriginCount = inferred.trips.length;
    if (layer1OriginCount !== layer2OriginCount) {
      allDiagnostics.push({
        code: ODPT_WARN_CODES.INFERENCE_REJECTED_LAYER_MISMATCH,
        unit: unitKey,
        detail: `Layer 1 origin count (${layer1OriginCount}) !== Layer 2 trip count (${layer2OriginCount})`,
      });
      tripsByUnit.set(unitKey, buildLegacyTrips(unitEntries, rw, direction, destForInference));
      continue;
    }

    // Fill calendar field on inferred trips (helper leaves it blank).
    for (const trip of inferred.trips) {
      trip.calendar = calendar;
    }
    tripsByUnit.set(unitKey, inferred.trips);
  }

  // Phase 2 (a) (D13): pattern aggregation + sort + ID assignment.
  const patternMap = new Map<
    string,
    { routeId: string; headsign: string; stops: TripPatternJson['stops']; sortKey: string }
  >();

  /** Pattern key from a trip. Returns the key for caller use. */
  function getOrCreatePatternKey(
    rw: RailwayInfo,
    direction: string,
    origin: string,
    effectiveDest: string,
  ): string {
    const lineStart =
      direction === DIRECTION_OUTBOUND
        ? rw.stationOrder[0]['odpt:station']
        : rw.stationOrder[rw.stationOrder.length - 1]['odpt:station'];
    const effectiveOrigin = origin === lineStart ? undefined : origin;
    const originKey = effectiveOrigin ?? '__start__';
    const pKey = `${rw.routeId}\0${direction}\0${originKey}\0${effectiveDest}`;

    if (!patternMap.has(pKey)) {
      // For headsign computation, we need the original destination URI.
      // When effectiveDest is the sentinel, pass undefined to use the
      // direction-based terminal name.
      const headsignDest = effectiveDest === FULL_ROUTE_SENTINEL ? undefined : effectiveDest;
      const headsign = getHeadsignFromDestination(headsignDest, direction, rw.stationOrder);
      const stops = buildStopSequence(direction, effectiveOrigin, effectiveDest, rw, prefix);
      patternMap.set(pKey, {
        routeId: rw.routeId,
        headsign,
        stops,
        sortKey: patternSortKey(rw.routeId, headsign, stops),
      });
    }
    return pKey;
  }

  // Aggregate trip -> pattern key (without enrolling timetable yet).
  const tripPatternKeyByUnit = new Map<UnitKey, string[]>();
  for (const [unitKey, trips] of tripsByUnit) {
    const parts = unitKey.split('\0');
    const railwayId = parts[0];
    const direction = parts[1];
    const effDest = parts[2];
    const rw = railwayInfoById.get(railwayId);
    if (!rw) {
      continue;
    }
    const keys = trips.map((trip) => getOrCreatePatternKey(rw, direction, trip.origin, effDest));
    tripPatternKeyByUnit.set(unitKey, keys);
  }

  // Sort patterns and assign IDs (existing logic).
  const sortedPatterns = [...patternMap.entries()].sort(([, a], [, b]) => {
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });

  const tripPatterns: Record<string, TripPatternJson> = {};
  const patternIdByKey = new Map<string, string>();

  for (let i = 0; i < sortedPatterns.length; i++) {
    const [pKey, p] = sortedPatterns[i];
    const patternId = `${prefix}:p${i + 1}`;
    patternIdByKey.set(pKey, patternId);

    tripPatterns[patternId] = {
      v: 2,
      r: p.routeId,
      h: p.headsign,
      stops: p.stops,
    };
  }

  // Phase 2 (b) (D13): enroll trips into stopTimetable.
  type DepartureEntry = { d: number; a: number };
  const stopTimetable = new Map<string, Map<string, Map<string, DepartureEntry[]>>>();

  for (const [unitKey, trips] of tripsByUnit) {
    const keys = tripPatternKeyByUnit.get(unitKey);
    if (!keys) {
      continue;
    }
    for (let ti = 0; ti < trips.length; ti++) {
      const trip = trips[ti];
      const pKey = keys[ti];
      const patId = patternIdByKey.get(pKey);
      if (!patId) {
        continue;
      }
      const serviceId = `${prefix}:${calendarToServiceId(trip.calendar)}`;
      for (const entry of trip.entries) {
        const stopId = `${prefix}:${extractStationShortId(entry.station)}`;
        // Existing dep/arr semantics (build-timetable.ts:325-326 equivalent):
        //   depTime present -> d = depTime; else d = eventTime (= arrTime when dep absent).
        //   arrTime present -> a = arrTime; else a = d.
        const d = entry.depTime ?? entry.eventTime;
        const a = entry.arrTime ?? d;

        let patMap = stopTimetable.get(stopId);
        if (!patMap) {
          patMap = new Map();
          stopTimetable.set(stopId, patMap);
        }
        let svcMap = patMap.get(patId);
        if (!svcMap) {
          svcMap = new Map();
          patMap.set(patId, svcMap);
        }
        let entries = svcMap.get(serviceId);
        if (!entries) {
          entries = [];
          svcMap.set(serviceId, entries);
        }
        entries.push({ d, a });
      }
    }
  }

  // Convert to output format.
  const timetable: Record<string, TimetableGroupV2Json[]> = {};

  for (const [stopId, patMap] of stopTimetable) {
    const groups: TimetableGroupV2Json[] = [];
    for (const [patId, svcMap] of patMap) {
      const d: Record<string, number[]> = {};
      const a: Record<string, number[]> = {};
      for (const [serviceId, entries] of svcMap) {
        entries.sort((x, y) => x.d - y.d);
        d[serviceId] = entries.map((e) => e.d);
        a[serviceId] = entries.map((e) => e.a);
      }
      const pattern = tripPatterns[patId];
      const si = pattern.stops.findIndex((s) => s.id === stopId);
      if (si === -1) {
        // Should never happen — pattern was constructed from trips that
        // contain this stop. Skip defensively.
        continue;
      }
      groups.push({
        v: 2,
        tp: patId,
        si,
        d,
        a,
      });
    }
    timetable[stopId] = groups;
  }

  // Wrapper-only (D15): emit warn lines from collected diagnostics.
  for (const diag of allDiagnostics) {
    const unitTag = diag.unit ? ` (unit=${diag.unit.replace(/\0/g, '/')})` : '';
    console.warn(`  [${prefix}] WARN: ${diag.code}: ${diag.detail}${unitTag}`);
  }

  return { tripPatterns, timetable };
}
