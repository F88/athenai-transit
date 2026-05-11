import { describe, expect, it, vi } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type {
  SelectedTripSnapshot,
  TimetableEntry,
  TripInspectionTarget,
  TripLocator,
  TripSnapshot,
  TripStopTime,
} from '../../../types/app/transit-composed';
import {
  buildTripInspectionMatchDiagnostics,
  getEmptyTripInspectionTargetsNote,
  loadTripInspectionSnapshot,
  refineTripInspectionState,
  serviceDayReferenceDateTime,
} from '../trip-inspection-state';

vi.mock('../../../lib/logger', () => ({
  createLogger: () => ({
    isEnabled: vi.fn().mockReturnValue(false),
    verbose: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// --- Fixtures ---

function makeRoute(routeId = 'test:R1'): Route {
  return {
    route_id: routeId,
    route_short_name: routeId,
    route_short_names: {},
    route_long_name: routeId,
    route_long_names: {},
    route_type: 3,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: 'test:agency',
  };
}

function makeLocator(overrides: Partial<TripLocator> = {}): TripLocator {
  return { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 0, ...overrides };
}

function makeTarget(overrides: Partial<TripInspectionTarget> = {}): TripInspectionTarget {
  return {
    tripLocator: makeLocator(),
    serviceDate: new Date(2026, 4, 11),
    stopIndex: 3,
    departureMinutes: 600,
    ...overrides,
  };
}

function makeEntry(overrides: {
  patternId?: string;
  serviceId?: string;
  tripIndex?: number;
  stopIndex?: number;
  departureMinutes: number;
  arrivalMinutes?: number;
  isTerminal?: boolean;
  isOrigin?: boolean;
  routeId?: string;
}): TimetableEntry {
  const route = makeRoute(overrides.routeId ?? 'test:R1');
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes,
    },
    routeDirection: {
      route,
      tripHeadsign: { name: 'Terminal', names: {} },
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 3,
      totalStops: 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    tripLocator: {
      patternId: overrides.patternId ?? 'pattern-a',
      serviceId: overrides.serviceId ?? 'weekday',
      tripIndex: overrides.tripIndex ?? 0,
    },
  };
}

function makeStopTime(stopIndex: number, departureMinutes: number): TripStopTime {
  return {
    routeTypes: [],
    timetableEntry: {
      tripLocator: makeLocator(),
      schedule: { departureMinutes, arrivalMinutes: departureMinutes },
      routeDirection: {
        route: makeRoute(),
        tripHeadsign: { name: 'Terminal', names: {} },
      },
      boarding: { pickupType: 0, dropOffType: 0 },
      patternPosition: {
        stopIndex,
        totalStops: 10,
        isTerminal: false,
        isOrigin: false,
      },
    },
    stopMeta: {
      stop: {
        stop_id: `stop-${String(stopIndex)}`,
        stop_name: `Stop ${String(stopIndex)}`,
        stop_names: {},
        stop_lat: 0,
        stop_lon: 0,
        location_type: 0,
        agency_id: 'test:agency',
      },
      agencies: [],
      routes: [],
    },
  };
}

function makeTripSnapshot(stopTimes: TripStopTime[]): TripSnapshot {
  return {
    locator: makeLocator(),
    route: makeRoute(),
    tripHeadsign: { name: 'Terminal', names: {} },
    serviceDate: new Date(2026, 4, 11),
    stopTimes,
  };
}

function makeSelectedSnapshot(
  stopTimes: TripStopTime[],
  selectedIndex: number,
): SelectedTripSnapshot {
  const selectedStop = stopTimes[selectedIndex];
  if (!selectedStop) {
    throw new Error(`fixture: stopTimes[${String(selectedIndex)}] is undefined`);
  }
  return {
    ...makeTripSnapshot(stopTimes),
    currentStopIndex: selectedIndex,
    selectedStop,
  };
}

// --- Tests ---

describe('serviceDayReferenceDateTime', () => {
  it('returns noon on the same local calendar day for a midnight-anchored input', () => {
    const midnight = new Date(2026, 4, 11, 0, 0, 0, 0);
    const result = serviceDayReferenceDateTime(midnight);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(11);
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the input Date', () => {
    const midnight = new Date(2026, 4, 11, 0, 0, 0, 0);
    const originalTime = midnight.getTime();
    serviceDayReferenceDateTime(midnight);
    expect(midnight.getTime()).toBe(originalTime);
    expect(midnight.getHours()).toBe(0);
  });

  it('still anchors to local noon when the input is itself just before the 03:00 service-day boundary', () => {
    // 02:59 would otherwise be normalised to the previous service day by
    // `getServiceDay`. Anchoring to noon avoids the boundary entirely.
    const justBeforeBoundary = new Date(2026, 4, 11, 2, 59, 59, 999);
    const result = serviceDayReferenceDateTime(justBeforeBoundary);
    expect(result.getDate()).toBe(11);
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('keeps the local calendar day stable for a 23:59 input', () => {
    const lateEvening = new Date(2026, 4, 11, 23, 59, 30, 250);
    const result = serviceDayReferenceDateTime(lateEvening);
    expect(result.getDate()).toBe(11);
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns a fresh Date instance', () => {
    const input = new Date(2026, 4, 11);
    const result = serviceDayReferenceDateTime(input);
    expect(result).not.toBe(input);
  });
});

describe('getEmptyTripInspectionTargetsNote', () => {
  it('returns the no-stop-data note for the no-stop-data reason', () => {
    expect(getEmptyTripInspectionTargetsNote('no-stop-data')).toBe(
      'The stop has no trip-inspection stop data.',
    );
  });

  it('returns the no-service-on-this-day note for the no-service-on-this-day reason', () => {
    expect(getEmptyTripInspectionTargetsNote('no-service-on-this-day')).toBe(
      'The stop has trip-inspection data, but no services on the selected service day.',
    );
  });
});

describe('buildTripInspectionMatchDiagnostics', () => {
  it('returns empty samples when candidates is empty', () => {
    const target = makeTarget();
    const result = buildTripInspectionMatchDiagnostics(target, []);
    expect(result.sampleSameService).toEqual([]);
    expect(result.sampleSameTripIndex).toEqual([]);
    expect(result.sampleSameStopIndex).toEqual([]);
    expect(result.patternId).toBe(target.tripLocator.patternId);
    expect(result.stopIndex).toBe(target.stopIndex);
  });

  it('narrows samples by patternId+serviceId → tripIndex → stopIndex', () => {
    const target = makeTarget({
      tripLocator: { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 5 },
      stopIndex: 3,
    });
    const candidates: TripInspectionTarget[] = [
      // same service, different tripIndex
      makeTarget({
        tripLocator: { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 1 },
      }),
      // same service, same tripIndex, different stopIndex
      makeTarget({
        tripLocator: { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 5 },
        stopIndex: 4,
      }),
      // same service, same tripIndex, same stopIndex (full match)
      makeTarget({
        tripLocator: { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 5 },
        stopIndex: 3,
      }),
      // different patternId — should not appear in sameService
      makeTarget({
        tripLocator: { patternId: 'pattern-z', serviceId: 'weekday', tripIndex: 5 },
        stopIndex: 3,
      }),
    ];
    const result = buildTripInspectionMatchDiagnostics(target, candidates);
    expect(result.sampleSameService).toHaveLength(3);
    expect(result.sampleSameTripIndex).toHaveLength(2);
    expect(result.sampleSameStopIndex).toHaveLength(1);
  });

  it('caps each sample list at 5 entries', () => {
    const target = makeTarget({
      tripLocator: { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 5 },
      stopIndex: 3,
    });
    const candidates: TripInspectionTarget[] = Array.from({ length: 7 }, () =>
      makeTarget({
        tripLocator: { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 5 },
        stopIndex: 3,
      }),
    );
    const result = buildTripInspectionMatchDiagnostics(target, candidates);
    expect(result.sampleSameService).toHaveLength(5);
    expect(result.sampleSameTripIndex).toHaveLength(5);
    expect(result.sampleSameStopIndex).toHaveLength(5);
  });
});

describe('loadTripInspectionSnapshot', () => {
  it('returns the loaded snapshot when the stop row is present and has stopMeta', () => {
    const stopTimes = [makeStopTime(3, 600)];
    const trip = makeTripSnapshot(stopTimes);
    const target = makeTarget({ stopIndex: 3 });

    const result = loadTripInspectionSnapshot(trip, target);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.selectedStopId).toBe('stop-3');
      expect(result.data.snapshot.currentStopIndex).toBe(0);
    }
  });

  it('returns no-data when the requested pattern position is missing from the snapshot', () => {
    const trip = makeTripSnapshot([]);
    const result = loadTripInspectionSnapshot(trip, makeTarget());
    expect(result).toEqual({ ok: false, reason: 'no-data' });
  });

  it('returns no-data when the stop row has no stopMeta', () => {
    const stopTime = makeStopTime(3, 600);
    // Drop stopMeta to trigger the missing-metadata branch.
    const stopTimeNoMeta: TripStopTime = {
      routeTypes: stopTime.routeTypes,
      timetableEntry: stopTime.timetableEntry,
    };
    const trip = makeTripSnapshot([stopTimeNoMeta]);
    const result = loadTripInspectionSnapshot(trip, makeTarget({ stopIndex: 3 }));
    expect(result).toEqual({ ok: false, reason: 'no-data' });
  });
});

describe('refineTripInspectionState', () => {
  it('returns no-data when the entry list is empty', () => {
    const stopTimes = [makeStopTime(3, 600)];
    const snapshot = makeSelectedSnapshot(stopTimes, 0);
    const target = makeTarget({ stopIndex: 3, departureMinutes: 600 });

    const result = refineTripInspectionState([], target.serviceDate, snapshot, target);

    expect(result).toEqual({ ok: false, reason: 'no-data' });
  });

  it('orders candidates by displayed minute (terminal arrival comes before non-terminal departure)', () => {
    // Reproduces the Issue #63 yukkuri / bus_park style mismatch: a terminal
    // entry with display=arr=09:05 / dep=09:08 must sort before a non-terminal
    // entry with display=dep=09:06.
    const terminalEntry = makeEntry({
      tripIndex: 1,
      stopIndex: 3,
      arrivalMinutes: 9 * 60 + 5,
      departureMinutes: 9 * 60 + 8,
      isTerminal: true,
    });
    const nonTerminalEntry = makeEntry({
      tripIndex: 2,
      stopIndex: 3,
      departureMinutes: 9 * 60 + 6,
    });

    const stopTimes = [makeStopTime(3, 9 * 60 + 6)];
    const snapshot = makeSelectedSnapshot(stopTimes, 0);
    const target = makeTarget({
      tripLocator: makeLocator({ tripIndex: 2 }),
      stopIndex: 3,
      departureMinutes: 9 * 60 + 6,
    });

    // Pass entries in departure order (the canonical repo order). The
    // pure function must re-sort them into display order.
    const result = refineTripInspectionState(
      [nonTerminalEntry, terminalEntry],
      target.serviceDate,
      snapshot,
      target,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets[0]?.tripLocator.tripIndex).toBe(1);
      expect(result.data.targets[1]?.tripLocator.tripIndex).toBe(2);
      expect(result.data.targetIndex).toBe(1);
    }
  });

  it('resolves the requested target via exact match on the sorted candidate list', () => {
    const first = makeEntry({ tripIndex: 1, departureMinutes: 500 });
    const second = makeEntry({ tripIndex: 2, departureMinutes: 600 });
    const third = makeEntry({ tripIndex: 3, departureMinutes: 700 });
    const stopTimes = [makeStopTime(3, 600)];
    const snapshot = makeSelectedSnapshot(stopTimes, 0);
    const target = makeTarget({
      tripLocator: makeLocator({ tripIndex: 2 }),
      stopIndex: 3,
      departureMinutes: 600,
    });

    const result = refineTripInspectionState(
      [first, second, third],
      target.serviceDate,
      snapshot,
      target,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets).toHaveLength(3);
      expect(result.data.targetIndex).toBe(1);
    }
  });

  it('returns no-data when no candidate shares the requested trip locator', () => {
    // Verify that the `resolveTripInspectionDisplayState`
    // `target-not-found` outcome is collapsed into the
    // `RefinedTripInspectionStateResult` `no-data` reason variant.
    const unrelatedEntry = makeEntry({
      patternId: 'pattern-b',
      tripIndex: 0,
      stopIndex: 3,
      departureMinutes: 600,
    });
    const stopTimes = [makeStopTime(3, 600)];
    const snapshot = makeSelectedSnapshot(stopTimes, 0);
    const target = makeTarget({
      tripLocator: makeLocator({ patternId: 'pattern-a', tripIndex: 0 }),
      stopIndex: 3,
      departureMinutes: 600,
    });

    const result = refineTripInspectionState(
      [unrelatedEntry],
      target.serviceDate,
      snapshot,
      target,
    );

    expect(result).toEqual({ ok: false, reason: 'no-data' });
  });

  it('rewrites the snapshot to the fallback stop row when no exact-match candidate exists', () => {
    // The requested target points at stopIndex=5 / depMin=620, but the
    // entries only contain a single same-trip candidate at stopIndex=4.
    // `resolveTripInspectionDisplayState` therefore returns `matchType:
    // 'fallback'` and `refineTripInspectionState` is expected to surface
    // the rewritten snapshot whose `currentStopIndex` points at the
    // fallback stop row.
    const fallbackEntry = makeEntry({
      tripIndex: 1,
      stopIndex: 4,
      departureMinutes: 615,
    });
    const requestedStop = makeStopTime(5, 620);
    const fallbackStop = makeStopTime(4, 615);
    const snapshot = makeSelectedSnapshot([requestedStop, fallbackStop], 0);
    const target = makeTarget({
      tripLocator: makeLocator({ tripIndex: 1 }),
      stopIndex: 5,
      departureMinutes: 620,
    });

    const result = refineTripInspectionState([fallbackEntry], target.serviceDate, snapshot, target);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets).toHaveLength(1);
      expect(result.data.targets[0]?.stopIndex).toBe(4);
      expect(result.data.targetIndex).toBe(0);
      // The snapshot must point at the fallback stop row, not the
      // originally requested (and missing) stopIndex=5 row.
      expect(result.data.snapshot.currentStopIndex).toBe(1);
      expect(result.data.snapshot.selectedStop).toBe(fallbackStop);
    }
  });

  it('attaches the supplied serviceDate to each derived candidate', () => {
    const entry = makeEntry({ tripIndex: 1, departureMinutes: 500 });
    const stopTimes = [makeStopTime(3, 500)];
    const snapshot = makeSelectedSnapshot(stopTimes, 0);
    const target = makeTarget({
      tripLocator: makeLocator({ tripIndex: 1 }),
      stopIndex: 3,
      departureMinutes: 500,
    });
    const serviceDate = new Date(2026, 4, 11);

    const result = refineTripInspectionState([entry], serviceDate, snapshot, target);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets[0]?.serviceDate).toBe(serviceDate);
    }
  });
});
