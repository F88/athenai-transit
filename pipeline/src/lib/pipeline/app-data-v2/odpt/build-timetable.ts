/**
 * Build TripPatternJson and TimetableGroupV2Json from ODPT data.
 *
 * Trip identity is inferred from per-station StationTimetable entries
 * because ODPT operators (e.g. Yurikamome) do not publish TrainTimetable
 * and do not populate odpt:train / odpt:originStation / odpt:isOrigin
 * on individual entries. See Plan and Issue #153 for details.
 *
 * Algorithm overview (D13 phase ordering):
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
import { adjustOdptOvernightTimes, timeToMinutes } from '../../../transit-time-utils';
import { calendarToServiceId } from '../../../odpt-calendar-utils';
import { extractStationShortId } from './build-stops';
import { ODPT_WARN_CODES, type OdptDiagnostic } from './warn-codes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Resolved railway info with per-railway station index map.
 * stationIndexMap is per-railway to avoid index collisions when
 * a station appears in multiple railways (e.g. transfer stations).
 */
interface RailwayInfo {
  /**
   * Stable railway identifier. Currently equal to `${prefix}:${lineCode}`
   * (i.e. routeId) because OdptRailway has no `owl:sameAs` field in our
   * type definition; routeId is unique within a single ODPT source.
   */
  routeId: string;
  stationOrder: OdptStationOrder[];
  /** Station URI -> 0-based positional index within THIS railway's stationOrder. */
  stationIndexMap: Map<string, number>;
}

/**
 * Per-entry normalized event.
 *
 * Produced by `preprocessTimetables` (D9). Step 1/2/5 read this without
 * re-normalization (D9 owns sort / overnight adjustment / unit grouping).
 *
 * @internal
 */
export interface EntryEvent {
  /** Station URI where this entry was observed. */
  station: string;
  /** Departure time in minutes (overnight-adjusted), or null if not provided. */
  depTime: number | null;
  /** Arrival time in minutes (overnight-adjusted), or null if not provided. */
  arrTime: number | null;
  /** Event time = depTime ?? arrTime; never null (entries with neither are filtered out). */
  eventTime: number;
  /** Original index within input timetable's stationTimetableObject array (Determinism tie-break). */
  origIndex: number;
  trainNumber: string | null;
  trainType: string | null;
  /** Origin station URI when odpt:originStation has length === 1; null otherwise (D7). */
  originStation: string | null;
  isOrigin: boolean | null;
  /** Raw destination station URI (may be empty string if missing). */
  destination: string;
  /** Calendar URI. */
  calendar: string;
}

/**
 * UnitKey = `${railwayId}\0${direction}\0${effectiveDestination}\0${calendar}`.
 *
 * `effectiveDestination` (D14) normalizes terminal / missing / unknown
 * destinations to '__full__' so full-route trips share a single unit.
 *
 * @internal
 */
export type UnitKey = string;

/**
 * Trip object produced by inference (Step 2 / D15), canonical fast path
 * (D2/D7), or legacy fallback (D3/D16/D1).
 *
 * @internal
 */
export interface Trip {
  /** Most upstream observed station URI for this trip. */
  origin: string;
  /** Raw destination URI (used to derive effective destination for pattern key). */
  destination: string;
  calendar: string;
  /**
   * Observed timetable entries associated with this trip.
   *
   * Semantics depend on the producer:
   * - `inferTripsForDestination` (Step 2): one entry per station observed,
   *   sequenced in trip-direction order (Toyosu→...→Shimbashi for Inbound,
   *   etc.). Reflects a single physical trip's per-station progression.
   * - `buildCanonicalTrips` (D2/D7 fast path): all entries belonging to one
   *   `originStation` group from the unit; may contain multiple entries per
   *   station, and order follows the Determinism sort (eventTime asc), not
   *   trip-direction.
   * - `buildLegacyTrips` (D3/D16/D1 fallback): all entries from the unit
   *   (multiple per station), Determinism-sorted, treated as a single
   *   collective trip with origin = line-start.
   *
   * Phase 2(b) enrollment iterates `entries` and writes each to its
   * station's stopTimetable, so multi-entry-per-station is structurally
   * compatible across all producers.
   */
  entries: EntryEvent[];
}

// ---------------------------------------------------------------------------
// Constants (D11 tolerance, etc.)
// ---------------------------------------------------------------------------

/**
 * Travel-time matching tolerance in minutes (D8 Edge cases).
 *
 * Yurikamome's adjacent-pair travel-time variance is <=1 min, so 2 min is
 * safely below misalignment risk. Defined as a private constant; not
 * exported, not configurable.
 */
const TRAVEL_TIME_TOLERANCE_MIN = 2;

/** Outlier threshold for travel-time median calculation. */
const TRAVEL_TIME_OUTLIER_MIN = 30;

/** Sentinel value for full-route destinations (D14). */
const FULL_ROUTE_SENTINEL = '__full__';

const DIRECTION_OUTBOUND = 'odpt.RailDirection:Outbound';

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
// Helpers (D9 / D11 / D14): normalization & grouping
// ---------------------------------------------------------------------------

/**
 * Compute effective destination for unit grouping (D14).
 *
 * Normalizes terminal / missing / unknown destinations to '__full__'
 * so all full-route trips share a single unit, matching the pattern-key
 * normalization that has been in place since pre-fix.
 *
 * @internal
 */
export function effectiveDestination(
  rawDest: string | undefined,
  rw: RailwayInfo,
  direction: string,
): string {
  const terminal =
    direction === DIRECTION_OUTBOUND
      ? rw.stationOrder[rw.stationOrder.length - 1]['odpt:station']
      : rw.stationOrder[0]['odpt:station'];
  if (rawDest === undefined || rawDest === '') {
    return FULL_ROUTE_SENTINEL;
  }
  if (rawDest === terminal) {
    return FULL_ROUTE_SENTINEL;
  }
  if (!rw.stationIndexMap.has(rawDest)) {
    return FULL_ROUTE_SENTINEL;
  }
  return rawDest;
}

/**
 * Compose a UnitKey from its components.
 *
 * @internal
 */
export function makeUnitKey(
  railwayId: string,
  direction: string,
  effectiveDest: string,
  calendar: string,
): UnitKey {
  return `${railwayId}\0${direction}\0${effectiveDest}\0${calendar}`;
}

/**
 * Determinism sort key for EntryEvent (Step 2.5).
 *
 * (eventTime ascending, trainNumber, trainType, destination, origIndex).
 */
function determinismCompare(a: EntryEvent, b: EntryEvent): number {
  if (a.eventTime !== b.eventTime) {
    return a.eventTime - b.eventTime;
  }
  const an = a.trainNumber ?? '';
  const bn = b.trainNumber ?? '';
  if (an !== bn) {
    return an < bn ? -1 : 1;
  }
  const at = a.trainType ?? '';
  const bt = b.trainType ?? '';
  if (at !== bt) {
    return at < bt ? -1 : 1;
  }
  if (a.destination !== b.destination) {
    return a.destination < b.destination ? -1 : 1;
  }
  return a.origIndex - b.origIndex;
}

/**
 * Normalize all timetable entries into per-unit EntryEvent arrays (D9).
 *
 * Owns: railway resolution, overnight adjustment, EntryEvent construction
 * (originStation length-1 normalization per D7), unit grouping with
 * effectiveDestination (D14), per-unit Determinism sort.
 *
 * Returns `{ unitGroups, diagnostics }` for consistency with the D15
 * helper contract (every helper that can encounter anomalies returns a
 * `Diagnostic[]` so the wrapper can decide warn / fallback). For the
 * currently-supported sources (Yurikamome) all skip paths below are
 * silent and `diagnostics` is empty; the field is kept so that future
 * additions of structural anomaly detection (e.g. unmapped station,
 * malformed entry without time) can emit diagnostics without changing
 * the helper signature.
 *
 * @internal
 */
export function preprocessTimetables(
  timetables: OdptStationTimetable[],
  stationToRailways: Map<string, RailwayInfo[]>,
): { unitGroups: Map<UnitKey, EntryEvent[]>; diagnostics: OdptDiagnostic[] } {
  const unitGroups = new Map<UnitKey, EntryEvent[]>();
  // Reserved for future structural-anomaly diagnostics; see function
  // docstring. Currently always returns empty for supported sources.
  const diagnostics: OdptDiagnostic[] = [];

  for (const tt of timetables) {
    const station = tt['odpt:station'];
    const candidates = stationToRailways.get(station);
    const rw = candidates?.[0];
    if (!rw) {
      // Station not mapped to any railway. Possible for through-running
      // entries from outside the source's railway set; silently skipped
      // here per design (line-internal origin only — Out of scope of
      // Issue #153). If needed in the future, push a diagnostic here.
      continue;
    }

    const direction = tt['odpt:railDirection'];
    const calendar = tt['odpt:calendar'];

    const objects = tt['odpt:stationTimetableObject'];
    const rawTimes = objects.map(
      (obj) => obj['odpt:departureTime'] ?? obj['odpt:arrivalTime'] ?? '',
    );
    const adjustedTimes = adjustOdptOvernightTimes(rawTimes);

    for (let objIdx = 0; objIdx < objects.length; objIdx++) {
      const obj = objects[objIdx];
      const depTimeStr = obj['odpt:departureTime'];
      const arrTimeStr = obj['odpt:arrivalTime'];
      if (!depTimeStr && !arrTimeStr) {
        // Malformed entry: ODPT spec allows optional fields, but an
        // entry with neither dep nor arr time has no usable signal and
        // would break eventTime computation downstream. Silently skipped
        // for currently-supported sources (Yurikamome has 0 such cases).
        // If future sources show meaningful counts here, emit a
        // diagnostic instead of continuing silently.
        continue;
      }

      const adjusted = adjustedTimes[objIdx];
      const isOvernightSection = adjusted !== rawTimes[objIdx];
      const toMin = (time: string): number => {
        if (isOvernightSection) {
          const h = parseInt(time.split(':')[0], 10);
          return (h + 24) * 60 + parseInt(time.split(':')[1], 10);
        }
        return timeToMinutes(time);
      };

      const depTime = depTimeStr ? toMin(depTimeStr) : null;
      const arrTime = arrTimeStr ? toMin(arrTimeStr) : null;
      // eventTime is never null because we filtered entries with neither dep nor arr.
      const eventTime = depTime ?? arrTime!;

      const rawDest = obj['odpt:destinationStation']?.[0] ?? '';
      const effDest = effectiveDestination(rawDest, rw, direction);

      // D7: only adopt originStation when length === 1; otherwise null.
      const originArr = obj['odpt:originStation'];
      const originStation =
        Array.isArray(originArr) && originArr.length === 1 ? originArr[0] : null;

      const event: EntryEvent = {
        station,
        depTime,
        arrTime,
        eventTime,
        origIndex: objIdx,
        trainNumber: obj['odpt:trainNumber'] ?? null,
        trainType: obj['odpt:trainType'] ?? null,
        originStation,
        isOrigin: obj['odpt:isOrigin'] ?? null,
        destination: rawDest,
        calendar,
      };

      const unitKey = makeUnitKey(rw.routeId, direction, effDest, calendar);
      let bucket = unitGroups.get(unitKey);
      if (!bucket) {
        bucket = [];
        unitGroups.set(unitKey, bucket);
      }
      bucket.push(event);
    }
  }

  // Per-unit Determinism sort.
  for (const events of unitGroups.values()) {
    events.sort(determinismCompare);
  }

  return { unitGroups, diagnostics };
}

/**
 * Bucket entries by station URI (D11). Pure bucketization; does not re-sort.
 * Each bucket preserves input order (which is Determinism-sorted by D9).
 *
 * @internal
 */
export function groupEntriesByStation(entries: EntryEvent[]): Map<string, EntryEvent[]> {
  const map = new Map<string, EntryEvent[]>();
  for (const e of entries) {
    let bucket = map.get(e.station);
    if (!bucket) {
      bucket = [];
      map.set(e.station, bucket);
    }
    bucket.push(e);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Helpers (D1 / D2 / D5 / D16): inference checks
// ---------------------------------------------------------------------------

/**
 * Order observed stations along the trip direction (D16).
 *
 * Returns only stations that have at least one EntryEvent in the unit,
 * filtered through stationOrder so the result is in trip-direction order.
 */
function orderObservedStations(
  unitEntries: EntryEvent[],
  rw: RailwayInfo,
  direction: string,
): string[] {
  const observed = new Set(unitEntries.map((e) => e.station));
  const ordered = rw.stationOrder.map((so) => so['odpt:station']).filter((s) => observed.has(s));
  if (direction === DIRECTION_OUTBOUND) {
    return ordered;
  }
  return [...ordered].reverse();
}

/**
 * Check Layer 1 monotonic property (D1, D16): per-station entry count
 * must be non-decreasing along trip-direction order, considering only
 * stations actually observed in this unit.
 *
 * @internal
 */
export function checkMonotonic(
  unitEntries: EntryEvent[],
  rw: RailwayInfo,
  direction: string,
): boolean {
  const stations = orderObservedStations(unitEntries, rw, direction);
  let prev = -1;
  for (const s of stations) {
    const count = unitEntries.reduce((acc, e) => (e.station === s ? acc + 1 : acc), 0);
    if (count < prev) {
      return false;
    }
    prev = count;
  }
  return true;
}

/**
 * Detect whether canonical fast path applies (D2, D7).
 *
 * Returns true when every entry in the unit has a single-element
 * `originStation` array (= `EntryEvent.originStation` is non-null after
 * D7 normalization). Returns false (and emits diagnostic) when any
 * entry lacks the canonical signal — caller falls back to inference.
 *
 * @internal
 */
export function canUseCanonicalOrigin(
  unitEntries: EntryEvent[],
  unitKey: UnitKey,
): { ok: boolean; diagnostics: OdptDiagnostic[] } {
  if (unitEntries.length === 0) {
    return { ok: false, diagnostics: [] };
  }
  const allPopulated = unitEntries.every((e) => e.originStation !== null);
  if (allPopulated) {
    return { ok: true, diagnostics: [] };
  }
  // Only emit diagnostic when at least one entry IS populated (= mixed).
  // Pure absence (= 0%) is the normal case for sources like Yurikamome
  // and not worth warning about.
  const anyPopulated = unitEntries.some((e) => e.originStation !== null);
  if (!anyPopulated) {
    return { ok: false, diagnostics: [] };
  }
  return {
    ok: false,
    diagnostics: [
      {
        code: ODPT_WARN_CODES.CANONICAL_REJECTED_PARTIAL_POPULATE,
        unit: unitKey,
        detail: 'odpt:originStation is partially populated or has length !== 1',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Step 1 (D5): travel-time estimation
// ---------------------------------------------------------------------------

/**
 * Estimate inter-station travel time (median, in minutes) for each
 * adjacent station pair within a unit.
 *
 * Returns:
 *   travelTimes: Map "fromStation\0toStation" -> median minutes.
 *   diagnostics: TRAVEL_TIME_PAIR_MISSING per missing pair.
 *
 * D16: caller treats any missing pair as unit fallback (legacy).
 *
 * @internal
 */
export function estimateTravelTimes(
  unitEntries: EntryEvent[],
  rw: RailwayInfo,
  direction: string,
  unitKey: UnitKey,
): { travelTimes: Map<string, number>; diagnostics: OdptDiagnostic[] } {
  const travelTimes = new Map<string, number>();
  const diagnostics: OdptDiagnostic[] = [];

  const stations = orderObservedStations(unitEntries, rw, direction);
  const byStation = groupEntriesByStation(unitEntries);

  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    const fromEntries = byStation.get(from) ?? [];
    const toEntries = byStation.get(to) ?? [];

    // Greedy 1:1 nearest-neighbor matching by eventTime.
    // Both arrays are Determinism-sorted; we walk them together.
    //
    // Skip downstream entries whose eventTime <= upstream eventTime (= no
    // time progression). This keeps the median calculation consistent
    // with the asymmetric travel-time guard in inferTripsForDestination,
    // which rejects zero-or-negative travel as physically impossible.
    // Including 0-min pairs in the median would be self-inconsistent.
    const diffs: number[] = [];
    let toIdx = 0;
    for (const fe of fromEntries) {
      while (toIdx < toEntries.length && toEntries[toIdx].eventTime <= fe.eventTime) {
        toIdx++;
      }
      if (toIdx >= toEntries.length) {
        break;
      }
      const diff = toEntries[toIdx].eventTime - fe.eventTime;
      if (diff <= TRAVEL_TIME_OUTLIER_MIN) {
        diffs.push(diff);
      }
      toIdx++;
    }

    if (diffs.length === 0) {
      diagnostics.push({
        code: ODPT_WARN_CODES.TRAVEL_TIME_PAIR_MISSING,
        unit: unitKey,
        detail: `no observable travel for ${from} -> ${to}`,
      });
      continue;
    }

    diffs.sort((a, b) => a - b);
    const mid = Math.floor(diffs.length / 2);
    const median = diffs.length % 2 === 0 ? (diffs[mid - 1] + diffs[mid]) / 2 : diffs[mid];
    travelTimes.set(`${from}\0${to}`, median);
  }

  return { travelTimes, diagnostics };
}

// ---------------------------------------------------------------------------
// Step 2 (D15): trip identity inference
// ---------------------------------------------------------------------------

interface PendingTrip {
  origin: string;
  entries: EntryEvent[];
  /** Insertion order (= unique sequential id), for Tie-break #3. */
  createdOrder: number;
  /** Cached: lastEntry.eventTime. */
  lastEventTime: number;
  /** Cached: lastEntry.station. */
  lastStation: string;
  /** Cached: stationIndex of origin. Lower (more upstream) wins Tie-break #2. */
  originStationIndex: number;
}

/**
 * Infer trip identities for a unit's entries (Step 2, D15).
 *
 * Returns completed trips (origin -> destination matched). Drops
 * untraceable arr-only entries and end-of-walk pending trips with
 * D4 diagnostics. Does not emit warn directly; caller (wrapper)
 * formats `console.warn` lines from diagnostics.
 *
 * The 6-arg signature is intentional: passing `unitKey` alone would
 * require the helper to parse it, which is best left to the caller.
 *
 * @internal
 */
export function inferTripsForDestination(
  unitEntries: EntryEvent[],
  travelTimes: Map<string, number>,
  rw: RailwayInfo,
  direction: string,
  destinationStation: string,
  unitKey: UnitKey,
): { trips: Trip[]; diagnostics: OdptDiagnostic[] } {
  const diagnostics: OdptDiagnostic[] = [];
  const stations = orderObservedStations(unitEntries, rw, direction);
  if (stations.length === 0) {
    return { trips: [], diagnostics };
  }

  const stationIndexInWalk = new Map<string, number>();
  for (let i = 0; i < stations.length; i++) {
    stationIndexInWalk.set(stations[i], i);
  }

  const byStation = groupEntriesByStation(unitEntries);
  const completed: Trip[] = [];
  let pending: PendingTrip[] = [];
  let createdCounter = 0;

  // Effective destination URI: terminal (last walked station) when
  // destinationStation is the sentinel (full-route).
  const fullRouteTerminal = stations[stations.length - 1];

  // The "destination" we use to mark trip completion = either the
  // raw destinationStation URI (if it's an observed station) or the
  // terminal of the walk.
  const completionStation = stationIndexInWalk.has(destinationStation)
    ? destinationStation
    : fullRouteTerminal;
  const completionIndex = stationIndexInWalk.get(completionStation)!;

  for (let stationIdx = 0; stationIdx < stations.length; stationIdx++) {
    const z = stations[stationIdx];
    const zIndex = stationIdx;
    const entries = byStation.get(z) ?? [];

    for (const e of entries) {
      // Find candidate pending trips whose expected_event_at_z is
      // within tolerance of e.eventTime.
      //
      // Asymmetric constraint: a candidate match requires strictly
      // positive travel (actual > lastEventTime). Zero-or-negative
      // travel is physically impossible (a train cannot depart the
      // downstream station at the same minute as the upstream station,
      // let alone earlier), so we exclude it from candidacy. Without
      // this, greedy time-only matching can pair an upstream trip with
      // a same-minute downstream entry — leaving the legitimate later
      // entry unmatched and falsely classified as an Ariake-style
      // mid-pattern origin.
      const candidates: { trip: PendingTrip; diff: number }[] = [];
      for (const trip of pending) {
        const travel = travelTimes.get(`${trip.lastStation}\0${z}`);
        if (travel === undefined) {
          // Pair missing -> caller (wrapper) will fall back to legacy
          // (D16). Still, no candidate match here.
          continue;
        }
        if (e.eventTime <= trip.lastEventTime) {
          // Reject zero-or-negative travel (physically impossible).
          continue;
        }
        const expected = trip.lastEventTime + travel;
        const diff = Math.abs(e.eventTime - expected);
        if (diff <= TRAVEL_TIME_TOLERANCE_MIN) {
          candidates.push({ trip, diff });
        }
      }

      if (candidates.length > 0) {
        // Tie-break: (1) closest |actual - expected|, (2) most-upstream
        // origin, (3) earliest created order.
        candidates.sort((a, b) => {
          if (a.diff !== b.diff) {
            return a.diff - b.diff;
          }
          if (a.trip.originStationIndex !== b.trip.originStationIndex) {
            return a.trip.originStationIndex - b.trip.originStationIndex;
          }
          return a.trip.createdOrder - b.trip.createdOrder;
        });
        const winner = candidates[0].trip;
        winner.entries.push(e);
        winner.lastEventTime = e.eventTime;
        winner.lastStation = z;
      } else if (e.depTime !== null) {
        // Real departure -> start a new trip rooted here.
        pending.push({
          origin: z,
          entries: [e],
          createdOrder: createdCounter++,
          lastEventTime: e.eventTime,
          lastStation: z,
          originStationIndex: zIndex,
        });
      } else {
        // arr-only with no upstream match -> drop with diagnostic (D4).
        diagnostics.push({
          code: ODPT_WARN_CODES.DROPPED_UNTRACEABLE_ARR_ONLY,
          unit: unitKey,
          detail: `untraceable arr-only entry at ${z} (eventTime=${e.eventTime})`,
        });
      }
    }

    // After processing entries at z: any pending trip whose lastStation
    // is z is "complete" only when z is the completion station.
    if (zIndex === completionIndex) {
      const stillPending: PendingTrip[] = [];
      for (const trip of pending) {
        if (trip.lastStation === z) {
          completed.push({
            origin: trip.origin,
            destination: destinationStation,
            calendar: '', // filled by caller from unitKey
            entries: trip.entries,
          });
        } else {
          stillPending.push(trip);
        }
      }
      pending = stillPending;
    }
  }

  // End-of-walk: any pending trip that never reached completion is dropped (D4).
  for (const trip of pending) {
    diagnostics.push({
      code: ODPT_WARN_CODES.DROPPED_PENDING_TRIP,
      unit: unitKey,
      detail: `pending trip never reached completion (origin=${trip.origin}, last=${trip.lastStation})`,
    });
  }

  return { trips: completed, diagnostics };
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

// ---------------------------------------------------------------------------
// Helpers (D2 / D7 canonical, Layer 1 origin counting)
// ---------------------------------------------------------------------------

/**
 * Build trips from the canonical fast path (D2/D7): every entry has
 * `originStation` populated with a single value. Trips are formed by
 * grouping entries by `originStation`. Within each group, entries
 * keep the existing Determinism sort (eventTime ascending) established
 * by `preprocessTimetables`; this helper does not reorder them by
 * trip-direction station walk and does not split same-origin entries
 * into separate per-trip arrays (canonical signal alone does not carry
 * trip identity — see body comment).
 */
function buildCanonicalTrips(
  unitEntries: EntryEvent[],
  destinationStation: string,
  calendar: string,
): Trip[] {
  // Group by originStation.
  const byOrigin = new Map<string, EntryEvent[]>();
  for (const e of unitEntries) {
    if (e.originStation === null) {
      continue;
    }
    let bucket = byOrigin.get(e.originStation);
    if (!bucket) {
      bucket = [];
      byOrigin.set(e.originStation, bucket);
    }
    bucket.push(e);
  }

  const trips: Trip[] = [];
  for (const [origin, entries] of byOrigin) {
    // Within an origin group, entries are still Determinism-sorted from
    // D9. We need to split into individual trips — but with canonical
    // signal alone we cannot tell which entries belong to which trip
    // (originStation only marks the origin URI, not trip identity).
    // Treat each origin-group as a single Trip containing all of its
    // entries. Step 5 enrolls per-station so the d/a arrays reflect
    // every entry; the patternId is determined by origin alone.
    trips.push({
      origin,
      destination: destinationStation,
      calendar,
      entries,
    });
  }
  return trips;
}

/**
 * Count Layer 1 origin candidates (D3 cross-check).
 *
 * For each observed station in trip-direction order, when its entry
 * count exceeds the previous station's count, the delta represents
 * trips that originated at this station. Sum all deltas.
 */
function countLayer1Origins(unitEntries: EntryEvent[], rw: RailwayInfo, direction: string): number {
  const stations = orderObservedStations(unitEntries, rw, direction);
  let total = 0;
  let prev = 0;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const count = unitEntries.reduce((acc, e) => (e.station === s ? acc + 1 : acc), 0);
    if (i === 0) {
      total += count;
    } else if (count > prev) {
      total += count - prev;
    }
    prev = count;
  }
  return total;
}
