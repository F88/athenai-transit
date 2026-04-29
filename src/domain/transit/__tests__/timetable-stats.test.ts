import { describe, expect, it } from 'vitest';
import type { Agency, Route } from '../../../types/app/transit';
import type { TimetableEntry, TranslatableText } from '../../../types/app/transit-composed';
import { computeTimetableEntryStats } from '../timetable-stats';

const TEST_AGENCIES: readonly Agency[] = [];
const TEST_LANGS = ['ja'] as const;

// --- Test fixtures ---

function makeRoute(id: string, agencyId = 'test'): Route {
  return {
    route_id: id,
    route_short_name: id,
    route_short_names: {},
    route_long_name: '',
    route_long_names: {},
    route_type: 3,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: agencyId,
  };
}

function makeEntry(
  overrides: {
    routeId?: string;
    headsign?: string;
    stopHeadsign?: TranslatableText;
    direction?: 0 | 1;
    isOrigin?: boolean;
    isTerminal?: boolean;
    stopIndex?: number;
    totalStops?: number;
    pickupType?: 0 | 1 | 2 | 3;
    dropOffType?: 0 | 1 | 2 | 3;
    patternId?: string;
    serviceId?: string;
    tripIndex?: number;
  } = {},
): TimetableEntry {
  const routeId = overrides.routeId ?? 'routeA';
  const headsign = overrides.headsign ?? 'Terminal';
  return {
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: makeRoute(routeId),
      tripHeadsign: { name: headsign, names: {} },
      ...(overrides.stopHeadsign !== undefined ? { stopHeadsign: overrides.stopHeadsign } : {}),
      ...(overrides.direction !== undefined ? { direction: overrides.direction } : {}),
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 1,
      totalStops: overrides.totalStops ?? 5,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    tripLocator: {
      patternId: overrides.patternId ?? `${routeId}__${headsign}`,
      serviceId: overrides.serviceId ?? 'svc1',
      tripIndex: overrides.tripIndex ?? 0,
    },
  };
}

describe('computeTimetableEntryStats', () => {
  it('returns all-zero stats for an empty input', () => {
    const stats = computeTimetableEntryStats([], TEST_AGENCIES, TEST_LANGS);
    expect(stats).toEqual({
      totalCount: 0,
      originCount: 0,
      terminalCount: 0,
      passingCount: 0,
      boardableCount: 0,
      nonBoardableCount: 0,
      dropOffOnlyCount: 0,
      noDropOffCount: 0,
      routeCount: 0,
      directionCount: 0,
      tripHeadsignCount: 0,
      stopHeadsignCount: 0,
      patternCount: 0,
      serviceCount: 0,
      uniqueTripCount: 0,
    });
  });

  describe('A axis (pattern position)', () => {
    it('counts origin / terminal / passing entries independently', () => {
      const entries = [
        makeEntry({ isOrigin: true, stopIndex: 0 }),
        makeEntry({ isTerminal: true, stopIndex: 4 }),
        makeEntry({ stopIndex: 2 }),
        makeEntry({ stopIndex: 3 }),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.totalCount).toBe(4);
      expect(stats.originCount).toBe(1);
      expect(stats.terminalCount).toBe(1);
      expect(stats.passingCount).toBe(2);
    });

    it('counts both origin and terminal on a single-stop pattern', () => {
      const entries = [
        makeEntry({ isOrigin: true, isTerminal: true, stopIndex: 0, totalStops: 1 }),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.totalCount).toBe(1);
      expect(stats.originCount).toBe(1);
      expect(stats.terminalCount).toBe(1);
      expect(stats.passingCount).toBe(0);
    });
  });

  describe('B axis (boarding)', () => {
    it('partitions boardable vs non-boardable', () => {
      const entries = [makeEntry(), makeEntry({ isTerminal: true }), makeEntry({ pickupType: 1 })];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.totalCount).toBe(3);
      expect(stats.boardableCount).toBe(1);
      expect(stats.nonBoardableCount).toBe(2);
      expect(stats.boardableCount + stats.nonBoardableCount).toBe(stats.totalCount);
    });

    it('counts dropOffOnly entries (= explicit pickup_type === 1)', () => {
      const entries = [
        makeEntry({ pickupType: 1 }),
        makeEntry({ pickupType: 1 }),
        makeEntry({ isTerminal: true }),
        makeEntry(),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.dropOffOnlyCount).toBe(2);
      expect(stats.nonBoardableCount).toBe(3);
    });

    it('counts noDropOff entries (= explicit drop_off_type === 1)', () => {
      const entries = [
        makeEntry({ dropOffType: 1, isOrigin: true, stopIndex: 0 }),
        makeEntry({ dropOffType: 1 }),
        makeEntry(),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.noDropOffCount).toBe(2);
    });
  });

  describe('C axis (route direction)', () => {
    it('counts unique routes / headsigns / route+headsign pairs', () => {
      const entries = [
        makeEntry({ routeId: 'rA', headsign: 'X' }),
        makeEntry({ routeId: 'rA', headsign: 'Y' }),
        makeEntry({ routeId: 'rB', headsign: 'X' }),
        makeEntry({ routeId: 'rB', headsign: 'X' }),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.routeCount).toBe(2);
      expect(stats.stopHeadsignCount).toBe(2);
      expect(stats.tripHeadsignCount).toBe(2);
    });

    it('counts unique resolved stop headsigns', () => {
      const entries = [
        makeEntry({ stopHeadsign: { name: 'override', names: {} } }),
        makeEntry({ stopHeadsign: { name: 'override2', names: {} } }),
        makeEntry(),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.stopHeadsignCount).toBe(3);
    });

    it('counts unique direction values (undefined is one value)', () => {
      const entries = [
        makeEntry({ direction: 0 }),
        makeEntry({ direction: 0 }),
        makeEntry({ direction: 1 }),
        makeEntry(),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.directionCount).toBe(3);
    });
  });

  describe('D axis (trip locator)', () => {
    it('counts unique patternIds / serviceIds', () => {
      const entries = [
        makeEntry({ patternId: 'p1', serviceId: 's1' }),
        makeEntry({ patternId: 'p1', serviceId: 's2', tripIndex: 1 }),
        makeEntry({ patternId: 'p2', serviceId: 's1', tripIndex: 2 }),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.patternCount).toBe(2);
      expect(stats.serviceCount).toBe(2);
    });

    it('uniqueTripCount equals totalCount for a non-circular pattern', () => {
      const entries = [
        makeEntry({ patternId: 'p1', serviceId: 's1', tripIndex: 0 }),
        makeEntry({ patternId: 'p1', serviceId: 's1', tripIndex: 1 }),
        makeEntry({ patternId: 'p1', serviceId: 's1', tripIndex: 2 }),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.uniqueTripCount).toBe(3);
      expect(stats.uniqueTripCount).toBe(stats.totalCount);
    });

    it('uniqueTripCount is lower than totalCount for circular patterns', () => {
      // 6-shape / circular: same (patternId, serviceId, tripIndex) appears
      // at two different stopIndex values for the same physical stop.
      const entries = [
        makeEntry({ patternId: 'p1', serviceId: 's1', tripIndex: 0, stopIndex: 0 }),
        makeEntry({ patternId: 'p1', serviceId: 's1', tripIndex: 0, stopIndex: 28 }),
        makeEntry({ patternId: 'p1', serviceId: 's1', tripIndex: 1, stopIndex: 0 }),
        makeEntry({ patternId: 'p1', serviceId: 's1', tripIndex: 1, stopIndex: 28 }),
      ];
      const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);
      expect(stats.totalCount).toBe(4);
      expect(stats.uniqueTripCount).toBe(2);
    });
  });

  it('aggregates a mixed input across all axes', () => {
    const entries = [
      // origin, boardable, route A
      makeEntry({
        routeId: 'rA',
        headsign: 'X',
        direction: 0,
        isOrigin: true,
        stopIndex: 0,
        patternId: 'p1',
        tripIndex: 0,
      }),
      // mid-route, boardable, route A, stopHeadsign override
      makeEntry({
        routeId: 'rA',
        headsign: 'X',
        direction: 0,
        stopHeadsign: { name: 'X-via', names: {} },
        stopIndex: 2,
        patternId: 'p1',
        tripIndex: 0,
      }),
      // terminal, non-boardable, route A
      makeEntry({
        routeId: 'rA',
        headsign: 'X',
        direction: 0,
        isTerminal: true,
        stopIndex: 4,
        patternId: 'p1',
        tripIndex: 0,
      }),
      // origin with pickup_type=1 (= depot departure), route B
      makeEntry({
        routeId: 'rB',
        headsign: 'Y',
        direction: 1,
        isOrigin: true,
        stopIndex: 0,
        pickupType: 1,
        patternId: 'p2',
        tripIndex: 0,
      }),
    ];
    const stats = computeTimetableEntryStats(entries, TEST_AGENCIES, TEST_LANGS);

    expect(stats.totalCount).toBe(4);

    // A axis
    expect(stats.originCount).toBe(2);
    expect(stats.terminalCount).toBe(1);
    expect(stats.passingCount).toBe(1);

    // B axis
    expect(stats.boardableCount).toBe(2);
    expect(stats.nonBoardableCount).toBe(2);
    expect(stats.dropOffOnlyCount).toBe(1);
    expect(stats.noDropOffCount).toBe(0);

    // C axis: resolver picks stopHeadsign when present (entry 2 -> 'X-via'),
    // so headsign and routeHeadsign uniqueness reflects that override.
    expect(stats.routeCount).toBe(2);
    expect(stats.stopHeadsignCount).toBe(3); // X, X-via, Y
    expect(stats.tripHeadsignCount).toBe(2); // X, Y
    expect(stats.directionCount).toBe(2);

    // D axis
    expect(stats.patternCount).toBe(2);
    expect(stats.serviceCount).toBe(1);
    expect(stats.uniqueTripCount).toBe(2);
  });
});
