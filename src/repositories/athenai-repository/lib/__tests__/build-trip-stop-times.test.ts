import { describe, expect, it, vi } from 'vitest';

import type { AppRouteTypeValue } from '@/types/app/transit';
import type { RouteDirection, StopWithMeta, TripLocator } from '@/types/app/transit-composed';
import type { TimetableGroupV2Json } from '@/types/data/transit-v2-json';

import { buildTripStopTimeFromGroup, buildTripStopTimes } from '../build-trip-stop-times';
import type { BuildTripStopTimesLookups } from '../build-trip-stop-times';
import type { PatternTimetableEntry } from '../../types';

interface CreateEntryArgs {
  stopId: string;
  si: number;
  d: Record<string, number[]>;
  a?: Record<string, number[]>;
  pt?: Record<string, (0 | 1 | 2 | 3)[]>;
  dt?: Record<string, (0 | 1 | 2 | 3)[]>;
}

function createEntry({ stopId, si, d, a, pt, dt }: CreateEntryArgs): PatternTimetableEntry {
  const group: TimetableGroupV2Json = {
    v: 2,
    tp: 'test:p1',
    si,
    d,
    a: a ?? d,
  };
  if (pt !== undefined) {
    group.pt = pt;
  }
  if (dt !== undefined) {
    group.dt = dt;
  }
  return { stopId, group };
}

function getStopIndexes(result: ReturnType<typeof buildTripStopTimes>): number[] {
  return result.map((row) => row.timetableEntry.patternPosition.stopIndex);
}

function createLocator(overrides: Partial<TripLocator> = {}): TripLocator {
  return {
    patternId: 'test:p1',
    serviceId: 'test:weekday',
    tripIndex: 0,
    ...overrides,
  };
}

function createLookups(
  overrides: Partial<BuildTripStopTimesLookups> = {},
): BuildTripStopTimesLookups {
  return {
    getStopMeta: vi.fn((_stopId: string): StopWithMeta | undefined => undefined),
    getStopRouteTypes: vi.fn((_stopId: string): AppRouteTypeValue[] => []),
    resolveRouteDirection: vi.fn(
      (_stopIndex: number): RouteDirection => ({
        route: {
          route_id: 'test:r1',
          route_type: 3,
          agency_id: 'test:a1',
          route_short_name: 'R1',
          route_short_names: {},
          route_long_name: '',
          route_long_names: {},
          route_color: '',
          route_text_color: '',
        },
        tripHeadsign: { name: '', names: {} },
      }),
    ),
    ...overrides,
  };
}

describe('buildTripStopTimes', () => {
  describe('when timetableEntries is empty or undefined', () => {
    it('returns an empty array when timetableEntries is undefined', () => {
      const result = buildTripStopTimes(createLocator(), 4, undefined, createLookups());

      expect(result).toEqual([]);
    });

    it('returns an empty array when timetableEntries is an empty array', () => {
      const result = buildTripStopTimes(createLocator(), 4, [], createLookups());

      expect(result).toEqual([]);
    });

    it('does not invoke any lookup callbacks when timetableEntries is undefined', () => {
      const lookups = createLookups();

      buildTripStopTimes(createLocator(), 4, undefined, lookups);

      expect(lookups.getStopMeta).not.toHaveBeenCalled();
      expect(lookups.getStopRouteTypes).not.toHaveBeenCalled();
      expect(lookups.resolveRouteDirection).not.toHaveBeenCalled();
    });

    it('does not invoke any lookup callbacks when timetableEntries is empty', () => {
      const lookups = createLookups();

      buildTripStopTimes(createLocator(), 4, [], lookups);

      expect(lookups.getStopMeta).not.toHaveBeenCalled();
      expect(lookups.getStopRouteTypes).not.toHaveBeenCalled();
      expect(lookups.resolveRouteDirection).not.toHaveBeenCalled();
    });
  });

  describe('when an entry has no departures column for the requested serviceId', () => {
    // Skip rule #1: `group.d[locator.serviceId]` is undefined.
    it('omits the entry from the output', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600, 720] } }),
        // stopB has no `test:weekday` key — only `test:saturday`.
        createEntry({ stopId: 'B', si: 1, d: { 'test:saturday': [605, 725] } }),
        createEntry({ stopId: 'C', si: 2, d: { 'test:weekday': [610, 730] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: 0 }),
        3,
        entries,
        createLookups(),
      );

      expect(result).toHaveLength(2);
      expect(getStopIndexes(result)).toEqual([0, 2]);
    });

    it('does not invoke any lookups for the omitted entry', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600] } }),
        createEntry({ stopId: 'B', si: 1, d: { 'test:saturday': [605] } }),
      ];
      const lookups = createLookups();

      buildTripStopTimes(createLocator({ tripIndex: 0 }), 2, entries, lookups);

      // stopMeta / routeTypes are looked up keyed by stopId; verify B was never used.
      expect(lookups.getStopMeta).toHaveBeenCalledWith('A');
      expect(lookups.getStopMeta).not.toHaveBeenCalledWith('B');
      expect(lookups.getStopRouteTypes).toHaveBeenCalledWith('A');
      expect(lookups.getStopRouteTypes).not.toHaveBeenCalledWith('B');
      // resolveRouteDirection is keyed by stopIndex; verify si=1 was never used.
      expect(lookups.resolveRouteDirection).toHaveBeenCalledWith(0);
      expect(lookups.resolveRouteDirection).not.toHaveBeenCalledWith(1);
    });
  });

  describe('when departures[locator.tripIndex] does not yield a value', () => {
    // Skip rule #2: `departures[locator.tripIndex] === undefined`.

    it('omits the entry when tripIndex is past the end of departures', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600, 720, 840] } }),
        // stopB has only 2 departures; tripIndex=2 is out of range.
        createEntry({ stopId: 'B', si: 1, d: { 'test:weekday': [605, 725] } }),
        createEntry({ stopId: 'C', si: 2, d: { 'test:weekday': [610, 730, 850] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: 2 }),
        3,
        entries,
        createLookups(),
      );

      expect(result).toHaveLength(2);
      expect(getStopIndexes(result)).toEqual([0, 2]);
    });

    it('omits the entry when departures is an empty array', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600] } }),
        createEntry({ stopId: 'B', si: 1, d: { 'test:weekday': [] } }),
        createEntry({ stopId: 'C', si: 2, d: { 'test:weekday': [610] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: 0 }),
        3,
        entries,
        createLookups(),
      );

      expect(result).toHaveLength(2);
      expect(getStopIndexes(result)).toEqual([0, 2]);
    });

    it('omits all entries when tripIndex is negative', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600] } }),
        createEntry({ stopId: 'B', si: 1, d: { 'test:weekday': [605] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: -1 }),
        2,
        entries,
        createLookups(),
      );

      expect(result).toEqual([]);
    });

    it('omits all entries when tripIndex is non-integer', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600, 720] } }),
        createEntry({ stopId: 'B', si: 1, d: { 'test:weekday': [605, 725] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: 0.5 }),
        2,
        entries,
        createLookups(),
      );

      expect(result).toEqual([]);
    });

    it('omits all entries when tripIndex is NaN', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600] } }),
        createEntry({ stopId: 'B', si: 1, d: { 'test:weekday': [605] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: NaN }),
        2,
        entries,
        createLookups(),
      );

      expect(result).toEqual([]);
    });
  });

  describe('when an entry has no arrivals column for the requested serviceId', () => {
    // Skip rule #3: `group.a[locator.serviceId]` is undefined despite the
    // departures column being present. Treated like a missing departures
    // column — the entry is dropped, not silently filled.
    it('omits the entry from the output', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600, 720] } }),
        // stopB has departures for `test:weekday`, but arrivals only for
        // `test:saturday` — i.e. `a[test:weekday]` is absent.
        createEntry({
          stopId: 'B',
          si: 1,
          d: { 'test:weekday': [605, 725] },
          a: { 'test:saturday': [605, 725] },
        }),
        createEntry({ stopId: 'C', si: 2, d: { 'test:weekday': [610, 730] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: 0 }),
        3,
        entries,
        createLookups(),
      );

      expect(result).toHaveLength(2);
      expect(getStopIndexes(result)).toEqual([0, 2]);
    });

    it('does not invoke any lookups for the omitted entry', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600] } }),
        createEntry({
          stopId: 'B',
          si: 1,
          d: { 'test:weekday': [605] },
          a: { 'test:saturday': [605] },
        }),
      ];
      const lookups = createLookups();

      buildTripStopTimes(createLocator({ tripIndex: 0 }), 2, entries, lookups);

      expect(lookups.getStopMeta).toHaveBeenCalledWith('A');
      expect(lookups.getStopMeta).not.toHaveBeenCalledWith('B');
      expect(lookups.resolveRouteDirection).toHaveBeenCalledWith(0);
      expect(lookups.resolveRouteDirection).not.toHaveBeenCalledWith(1);
    });
  });

  describe('when arrivals[locator.tripIndex] does not yield a value', () => {
    // Skip rule #4: `group.a[serviceId][tripIndex]` is undefined although
    // the column itself exists (length mismatch with `d` — contract C3
    // violation). Treated symmetrically with the departures-side check.

    it('omits the entry when arrivals is shorter than departures', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600, 720] } }),
        // stopB has 2 departures but only 1 arrival; tripIndex=1 falls
        // off the end of arrivals.
        createEntry({
          stopId: 'B',
          si: 1,
          d: { 'test:weekday': [605, 725] },
          a: { 'test:weekday': [605] },
        }),
        createEntry({ stopId: 'C', si: 2, d: { 'test:weekday': [610, 730] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: 1 }),
        3,
        entries,
        createLookups(),
      );

      expect(result).toHaveLength(2);
      expect(getStopIndexes(result)).toEqual([0, 2]);
    });

    it('omits the entry when arrivals is an empty array', () => {
      const entries: PatternTimetableEntry[] = [
        createEntry({ stopId: 'A', si: 0, d: { 'test:weekday': [600] } }),
        createEntry({
          stopId: 'B',
          si: 1,
          d: { 'test:weekday': [605] },
          a: { 'test:weekday': [] },
        }),
        createEntry({ stopId: 'C', si: 2, d: { 'test:weekday': [610] } }),
      ];

      const result = buildTripStopTimes(
        createLocator({ tripIndex: 0 }),
        3,
        entries,
        createLookups(),
      );

      expect(result).toHaveLength(2);
      expect(getStopIndexes(result)).toEqual([0, 2]);
    });
  });
});

describe('buildTripStopTimeFromGroup', () => {
  function makeGroup(args: Omit<CreateEntryArgs, 'stopId'>): TimetableGroupV2Json {
    return createEntry({ stopId: 'unused', ...args }).group;
  }

  describe('schedule', () => {
    it('uses the caller-supplied departureMinutes and arrivalMinutes verbatim', () => {
      const group = makeGroup({
        si: 1,
        // Source-side d/a values are NOT consulted by the function — the
        // caller-supplied numbers must win.
        d: { 'test:weekday': [9999] },
        a: { 'test:weekday': [9999] },
      });

      const result = buildTripStopTimeFromGroup(
        createLocator({ tripIndex: 0 }),
        3,
        'stop-A',
        group,
        720,
        725,
        createLookups(),
      );

      expect(result.timetableEntry.schedule).toEqual({
        departureMinutes: 720,
        arrivalMinutes: 725,
      });
    });
  });

  describe('boarding (pickupType / dropOffType)', () => {
    it('defaults pickupType and dropOffType to 0 when group.pt and group.dt are absent', () => {
      const group = makeGroup({ si: 0, d: { 'test:weekday': [600] } });

      const result = buildTripStopTimeFromGroup(
        createLocator({ tripIndex: 0 }),
        3,
        'stop-A',
        group,
        600,
        600,
        createLookups(),
      );

      expect(result.timetableEntry.boarding).toEqual({ pickupType: 0, dropOffType: 0 });
    });

    it('defaults to 0 when pt/dt exist but lack the requested serviceId', () => {
      const group = makeGroup({
        si: 0,
        d: { 'test:weekday': [600] },
        pt: { 'test:saturday': [1] },
        dt: { 'test:saturday': [2] },
      });

      const result = buildTripStopTimeFromGroup(
        createLocator({ tripIndex: 0 }),
        3,
        'stop-A',
        group,
        600,
        600,
        createLookups(),
      );

      expect(result.timetableEntry.boarding).toEqual({ pickupType: 0, dropOffType: 0 });
    });

    it('defaults to 0 when pt/dt arrays do not cover tripIndex', () => {
      const group = makeGroup({
        si: 0,
        d: { 'test:weekday': [600, 720] },
        pt: { 'test:weekday': [1] },
        dt: { 'test:weekday': [2] },
      });

      const result = buildTripStopTimeFromGroup(
        createLocator({ tripIndex: 1 }),
        3,
        'stop-A',
        group,
        720,
        720,
        createLookups(),
      );

      expect(result.timetableEntry.boarding).toEqual({ pickupType: 0, dropOffType: 0 });
    });

    it('returns the source-provided pickupType and dropOffType values', () => {
      const group = makeGroup({
        si: 0,
        d: { 'test:weekday': [600, 720] },
        pt: { 'test:weekday': [0, 1] },
        dt: { 'test:weekday': [2, 3] },
      });

      const result = buildTripStopTimeFromGroup(
        createLocator({ tripIndex: 1 }),
        3,
        'stop-A',
        group,
        720,
        720,
        createLookups(),
      );

      expect(result.timetableEntry.boarding).toEqual({ pickupType: 1, dropOffType: 3 });
    });
  });

  describe('patternPosition', () => {
    it('marks the first stop (si=0) as origin and not terminal', () => {
      const group = makeGroup({ si: 0, d: { 'test:weekday': [600] } });

      const result = buildTripStopTimeFromGroup(
        createLocator(),
        3,
        'stop-A',
        group,
        600,
        600,
        createLookups(),
      );

      expect(result.timetableEntry.patternPosition).toEqual({
        stopIndex: 0,
        totalStops: 3,
        isOrigin: true,
        isTerminal: false,
      });
    });

    it('marks the last stop (si=totalStops-1) as terminal and not origin', () => {
      const group = makeGroup({ si: 2, d: { 'test:weekday': [610] } });

      const result = buildTripStopTimeFromGroup(
        createLocator(),
        3,
        'stop-C',
        group,
        610,
        610,
        createLookups(),
      );

      expect(result.timetableEntry.patternPosition).toEqual({
        stopIndex: 2,
        totalStops: 3,
        isOrigin: false,
        isTerminal: true,
      });
    });

    it('marks a middle stop as neither origin nor terminal', () => {
      const group = makeGroup({ si: 1, d: { 'test:weekday': [605] } });

      const result = buildTripStopTimeFromGroup(
        createLocator(),
        3,
        'stop-B',
        group,
        605,
        605,
        createLookups(),
      );

      expect(result.timetableEntry.patternPosition).toEqual({
        stopIndex: 1,
        totalStops: 3,
        isOrigin: false,
        isTerminal: false,
      });
    });

    it('uses the caller-supplied totalStops verbatim, even when out of natural range', () => {
      const group = makeGroup({ si: 7, d: { 'test:weekday': [600] } });

      const result = buildTripStopTimeFromGroup(
        createLocator(),
        10,
        'stop-X',
        group,
        600,
        600,
        createLookups(),
      );

      expect(result.timetableEntry.patternPosition.totalStops).toBe(10);
      expect(result.timetableEntry.patternPosition.stopIndex).toBe(7);
    });
  });

  describe('lookups', () => {
    it('invokes getStopMeta with the provided stopId and stores the result', () => {
      const group = makeGroup({ si: 0, d: { 'test:weekday': [600] } });
      const stopMeta = { stop: { stop_id: 'stop-A' } } as unknown as StopWithMeta;
      const lookups = createLookups({
        getStopMeta: vi.fn(() => stopMeta),
      });

      const result = buildTripStopTimeFromGroup(
        createLocator(),
        3,
        'stop-A',
        group,
        600,
        600,
        lookups,
      );

      expect(lookups.getStopMeta).toHaveBeenCalledWith('stop-A');
      expect(result.stopMeta).toBe(stopMeta);
    });

    it('invokes getStopRouteTypes with the provided stopId and stores the result', () => {
      const group = makeGroup({ si: 0, d: { 'test:weekday': [600] } });
      const lookups = createLookups({
        getStopRouteTypes: vi.fn(() => [3, 1] as AppRouteTypeValue[]),
      });

      const result = buildTripStopTimeFromGroup(
        createLocator(),
        3,
        'stop-A',
        group,
        600,
        600,
        lookups,
      );

      expect(lookups.getStopRouteTypes).toHaveBeenCalledWith('stop-A');
      expect(result.routeTypes).toEqual([3, 1]);
    });

    it('invokes resolveRouteDirection keyed by group.si and stores the result', () => {
      const group = makeGroup({ si: 5, d: { 'test:weekday': [600] } });
      const routeDirection: RouteDirection = {
        route: {
          route_id: 'r-x',
          route_type: 3,
          agency_id: 'a-x',
          route_short_name: 'X',
          route_short_names: {},
          route_long_name: '',
          route_long_names: {},
          route_color: '',
          route_text_color: '',
        },
        tripHeadsign: { name: 'sentinel', names: {} },
      };
      const lookups = createLookups({
        resolveRouteDirection: vi.fn(() => routeDirection),
      });

      const result = buildTripStopTimeFromGroup(
        createLocator(),
        10,
        'stop-A',
        group,
        600,
        600,
        lookups,
      );

      expect(lookups.resolveRouteDirection).toHaveBeenCalledWith(5);
      expect(result.timetableEntry.routeDirection).toBe(routeDirection);
    });
  });

  describe('tripLocator propagation', () => {
    it('passes the supplied locator through unchanged', () => {
      const group = makeGroup({ si: 0, d: { 'test:weekday': [600, 720] } });
      const locator = createLocator({ tripIndex: 1 });

      const result = buildTripStopTimeFromGroup(
        locator,
        3,
        'stop-A',
        group,
        720,
        720,
        createLookups(),
      );

      expect(result.timetableEntry.tripLocator).toBe(locator);
    });
  });
});
