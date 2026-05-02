import { describe, expect, it } from 'vitest';

import {
  isSameTripInspectionTarget,
  resolveSnapshotStopIndex,
  resolveTripInspectionTarget,
  selectTripInspectionTargetByReferenceTime,
} from '../trip-inspection-target';
import type {
  TripInspectionTarget,
  TripLocator,
  TripStopTime,
} from '../../../types/app/transit-composed';
import type { Route } from '../../../types/app/transit';

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

type TripInspectionTargetOverrides = Omit<Partial<TripInspectionTarget>, 'tripLocator'> & {
  tripLocator?: Partial<TripLocator>;
};

function makeTarget(overrides: TripInspectionTargetOverrides = {}): TripInspectionTarget {
  const { tripLocator, ...rest } = overrides;
  return {
    tripLocator: makeLocator(tripLocator),
    serviceDate: new Date(2026, 4, 2),
    stopIndex: 3,
    departureMinutes: 600,
    ...rest,
  };
}

function makeStopTime(
  stopIndex: number,
  departureMinutes: number,
  arrivalMinutes = departureMinutes,
): TripStopTime {
  return {
    routeTypes: [],
    timetableEntry: {
      tripLocator: makeLocator(),
      schedule: { departureMinutes, arrivalMinutes },
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
  };
}

describe('isSameTripInspectionTarget', () => {
  it('treats targets with the same trip/service-day/stop-index tuple as identical', () => {
    const left = makeTarget({ departureMinutes: 600 });
    const right = makeTarget({ departureMinutes: 605 });

    expect(isSameTripInspectionTarget(left, right)).toBe(true);
  });

  it('returns false when stopIndex differs', () => {
    const left = makeTarget({ stopIndex: 3 });
    const right = makeTarget({ stopIndex: 4 });

    expect(isSameTripInspectionTarget(left, right)).toBe(false);
  });

  it.each<[string, TripInspectionTargetOverrides]>([
    ['patternId', { tripLocator: { patternId: 'pattern-b' } }],
    ['serviceId', { tripLocator: { serviceId: 'saturday' } }],
    ['tripIndex', { tripLocator: { tripIndex: 1 } }],
    ['serviceDate', { serviceDate: new Date(2026, 4, 3) }],
  ])('returns false when %s differs', (_label, override) => {
    expect(isSameTripInspectionTarget(makeTarget(), makeTarget(override))).toBe(false);
  });

  it('compares serviceDate by value, not by Date instance reference', () => {
    // Two distinct Date instances representing the same moment must be equal.
    // Guards against accidental `===` regression on the serviceDate field.
    const moment = new Date(2026, 4, 2).getTime();
    expect(
      isSameTripInspectionTarget(
        makeTarget({ serviceDate: new Date(moment) }),
        makeTarget({ serviceDate: new Date(moment) }),
      ),
    ).toBe(true);
  });
});

describe('selectTripInspectionTargetByReferenceTime', () => {
  it('returns null for an empty candidate list', () => {
    expect(selectTripInspectionTargetByReferenceTime([], 600)).toBeNull();
  });

  it('selects the first departure at or after the reference time', () => {
    const candidates = [
      makeTarget({ stopIndex: 1, departureMinutes: 540 }),
      makeTarget({ stopIndex: 2, departureMinutes: 600 }),
      makeTarget({ stopIndex: 3, departureMinutes: 660 }),
    ];

    expect(selectTripInspectionTargetByReferenceTime(candidates, 590)).toEqual({
      target: candidates[1],
      index: 1,
      matchType: 'reference-time',
    });
  });

  it('falls back to the final candidate when all departures are before the reference time', () => {
    const candidates = [
      makeTarget({ stopIndex: 1, departureMinutes: 540 }),
      makeTarget({ stopIndex: 2, departureMinutes: 600 }),
    ];

    expect(selectTripInspectionTargetByReferenceTime(candidates, 800)).toEqual({
      target: candidates[1],
      index: 1,
      matchType: 'reference-time',
    });
  });

  it('selects the boundary candidate when reference equals its departure time', () => {
    // Pins the `>=` boundary: a candidate departing exactly at the reference
    // time must be selected over later ones. Guards against `>=` → `>` regression.
    const candidates = [
      makeTarget({ stopIndex: 1, departureMinutes: 540 }),
      makeTarget({ stopIndex: 2, departureMinutes: 600 }),
      makeTarget({ stopIndex: 3, departureMinutes: 660 }),
    ];

    expect(selectTripInspectionTargetByReferenceTime(candidates, 600)).toEqual({
      target: candidates[1],
      index: 1,
      matchType: 'reference-time',
    });
  });

  it('selects the first candidate when reference is before all departures', () => {
    const candidates = [
      makeTarget({ stopIndex: 1, departureMinutes: 540 }),
      makeTarget({ stopIndex: 2, departureMinutes: 600 }),
    ];

    expect(selectTripInspectionTargetByReferenceTime(candidates, 400)).toEqual({
      target: candidates[0],
      index: 0,
      matchType: 'reference-time',
    });
  });
});

describe('resolveTripInspectionTarget', () => {
  it('returns null for an empty candidate list', () => {
    expect(resolveTripInspectionTarget([], makeTarget())).toBeNull();
  });

  it('returns the exact matching candidate when one exists', () => {
    const requestedTarget = makeTarget({ stopIndex: 4, departureMinutes: 620 });
    const candidates = [
      makeTarget({ stopIndex: 1, departureMinutes: 500 }),
      makeTarget({ stopIndex: 4, departureMinutes: 630 }),
      makeTarget({
        tripLocator: {
          patternId: 'pattern-b',
          serviceId: 'weekday',
          tripIndex: 0,
        },
        stopIndex: 4,
        departureMinutes: 620,
      }),
    ];

    expect(resolveTripInspectionTarget(candidates, requestedTarget)).toEqual({
      target: candidates[1],
      index: 1,
      matchType: 'exact',
    });
  });

  it('returns the first exact match when multiple exact candidates exist', () => {
    const requestedTarget = makeTarget({ stopIndex: 4, departureMinutes: 620 });
    const candidates = [
      makeTarget({ stopIndex: 4, departureMinutes: 610 }),
      makeTarget({ stopIndex: 4, departureMinutes: 630 }),
      makeTarget({ stopIndex: 7, departureMinutes: 700 }),
    ];

    expect(resolveTripInspectionTarget(candidates, requestedTarget)).toEqual({
      target: candidates[0],
      index: 0,
      matchType: 'exact',
    });
  });

  it('falls back to the closest candidate within the same trip when no exact stop-event match exists', () => {
    const requestedTarget = makeTarget({ stopIndex: 5, departureMinutes: 620 });
    const candidates = [
      makeTarget({ stopIndex: 2, departureMinutes: 580 }),
      makeTarget({ stopIndex: 4, departureMinutes: 618 }),
      makeTarget({ stopIndex: 7, departureMinutes: 640 }),
    ];

    expect(resolveTripInspectionTarget(candidates, requestedTarget)).toEqual({
      target: candidates[1],
      index: 1,
      matchType: 'fallback',
    });
  });

  it('prefers the smaller stopIndex distance when fallback candidates have the same departure distance', () => {
    const requestedTarget = makeTarget({ stopIndex: 5, departureMinutes: 620 });
    const candidates = [
      makeTarget({ stopIndex: 1, departureMinutes: 610 }),
      makeTarget({ stopIndex: 4, departureMinutes: 630 }),
      makeTarget({ stopIndex: 8, departureMinutes: 630 }),
    ];

    expect(resolveTripInspectionTarget(candidates, requestedTarget)).toEqual({
      target: candidates[1],
      index: 1,
      matchType: 'fallback',
    });
  });

  it('breaks combined ties by the earlier raw departure time', () => {
    // Both candidates are equidistant in departure (|620-618|=|620-622|=2) and
    // stopIndex (|5-4|=|5-6|=1) from the reference. Tertiary tie-break must
    // pick the smaller raw `departureMinutes` (= the earlier departure).
    const requestedTarget = makeTarget({ stopIndex: 5, departureMinutes: 620 });
    const candidates = [
      makeTarget({ stopIndex: 6, departureMinutes: 622 }),
      makeTarget({ stopIndex: 4, departureMinutes: 618 }),
    ];

    expect(resolveTripInspectionTarget(candidates, requestedTarget)).toEqual({
      target: candidates[1],
      index: 1,
      matchType: 'fallback',
    });
  });

  it('returns null when no candidate belongs to the same trip locator', () => {
    const requestedTarget = makeTarget();
    const candidates = [
      makeTarget({
        tripLocator: {
          patternId: 'pattern-b',
          serviceId: 'weekday',
          tripIndex: 0,
        },
      }),
    ];

    expect(resolveTripInspectionTarget(candidates, requestedTarget)).toBeNull();
  });
});

describe('resolveSnapshotStopIndex', () => {
  it('returns the exact stopIndex match when present', () => {
    const stopTimes = [makeStopTime(1, 540), makeStopTime(3, 600), makeStopTime(5, 660)];

    expect(
      resolveSnapshotStopIndex(stopTimes, makeTarget({ stopIndex: 3, departureMinutes: 601 })),
    ).toBe(1);
  });

  it('falls back to the stop row with the nearest departure time and then nearest stopIndex', () => {
    const stopTimes = [makeStopTime(1, 540), makeStopTime(4, 618), makeStopTime(8, 618)];

    expect(
      resolveSnapshotStopIndex(stopTimes, makeTarget({ stopIndex: 5, departureMinutes: 620 })),
    ).toBe(1);
  });

  it('keeps the first fallback row when departure and stopIndex distances are tied', () => {
    const stopTimes = [makeStopTime(4, 618), makeStopTime(6, 622)];

    expect(
      resolveSnapshotStopIndex(stopTimes, makeTarget({ stopIndex: 5, departureMinutes: 620 })),
    ).toBe(0);
  });

  it('returns -1 when the snapshot has no stop rows', () => {
    expect(resolveSnapshotStopIndex([], makeTarget())).toBe(-1);
  });

  it('returns the first match when multiple stop rows share the same stopIndex', () => {
    // Defensive: circular / 6-shape patterns may legitimately reuse the same
    // physical stop_id, but `stopIndex` is the unique positional identifier
    // so a duplicate here would indicate malformed snapshot data. Guarantee
    // deterministic first-match behavior so consumers can rely on the index.
    const stopTimes = [makeStopTime(3, 540), makeStopTime(3, 600)];

    expect(
      resolveSnapshotStopIndex(stopTimes, makeTarget({ stopIndex: 3, departureMinutes: 590 })),
    ).toBe(0);
  });
});
