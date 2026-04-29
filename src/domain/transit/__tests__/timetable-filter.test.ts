import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import {
  filterBoardable,
  filterByAgency,
  filterByRouteType,
  prepareStopTimetable,
  prepareRouteHeadsignTimetable,
} from '../timetable-filter';
import { getEffectiveHeadsign } from '../get-effective-headsign';

// --- Test fixtures ---

const routeA: Route = {
  route_id: 'routeA',
  route_short_name: 'A',
  route_short_names: {},
  route_long_name: 'Route A',
  route_long_names: {},
  route_type: 3,
  route_color: '000000',
  route_text_color: 'FFFFFF',
  agency_id: 'test',
};

const routeB: Route = {
  route_id: 'routeB',
  route_short_name: 'B',
  route_short_names: {},
  route_long_name: 'Route B',
  route_long_names: {},
  route_type: 3,
  route_color: '000000',
  route_text_color: 'FFFFFF',
  agency_id: 'test',
};

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
    route?: Route;
    headsign?: string;
    isTerminal?: boolean;
    isOrigin?: boolean;
    pickupType?: 0 | 1 | 2 | 3;
    dropOffType?: 0 | 1 | 2 | 3;
    departureMinutes?: number;
    stopIndex?: number;
    totalStops?: number;
  } = {},
): TimetableEntry {
  const route = overrides.route ?? routeA;
  const headsign = overrides.headsign ?? 'Terminal';
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes ?? 480,
      arrivalMinutes: overrides.departureMinutes ?? 480,
    },
    routeDirection: {
      route,
      tripHeadsign: { name: headsign, names: {} },
    },
    boarding: { pickupType: overrides.pickupType ?? 0, dropOffType: overrides.dropOffType ?? 0 },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 0,
      totalStops: overrides.totalStops ?? 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    tripLocator: { patternId: `${route.route_id}__${headsign}`, serviceId: 'test', tripIndex: 0 },
  };
}

// ---------------------------------------------------------------------------
// prepareStopTimetable
// ---------------------------------------------------------------------------

describe('prepareStopTimetable', () => {
  describe('includeNonBoardable = true (detailed/verbose)', () => {
    it('returns all entries including terminals', () => {
      const entries = [
        makeEntry(),
        makeEntry({ isTerminal: true }),
        makeEntry({ isTerminal: true }),
      ];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('returns all entries when none are terminal', () => {
      const entries = [makeEntry(), makeEntry(), makeEntry()];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('returns all entries when all are terminal (drop-off only stop)', () => {
      const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
    });
  });

  describe('includeNonBoardable = false (simple/normal)', () => {
    it('filters out terminal entries', () => {
      const entries = [
        makeEntry(),
        makeEntry({ isTerminal: true }),
        makeEntry({ isTerminal: true }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(2);
    });

    it('returns all entries when none are terminal', () => {
      const entries = [makeEntry(), makeEntry(), makeEntry()];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('returns empty when all are terminal (drop-off only stop)', () => {
      const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(2);
    });

    it('preserves non-terminal entries from multiple routes', () => {
      const entries = [
        makeEntry({ route: routeA }),
        makeEntry({ route: routeA, isTerminal: true }),
        makeEntry({ route: routeB }),
        makeEntry({ route: routeB, isTerminal: true }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(2);
    });
  });

  describe('invariant: entries.length + omitted.nonBoardable = input.length', () => {
    it('holds for mixed entries', () => {
      const entries = [
        makeEntry(),
        makeEntry(),
        makeEntry({ isTerminal: true }),
        makeEntry(),
        makeEntry({ isTerminal: true }),
        makeEntry({ isTerminal: true }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries.length + result.omitted.nonBoardable).toBe(entries.length);
    });

    it('holds when includeNonBoardable is true', () => {
      const entries = [makeEntry(), makeEntry({ isTerminal: true })];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries.length + result.omitted.nonBoardable).toBe(entries.length);
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      const result = prepareStopTimetable([], false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('handles single non-terminal entry', () => {
      const result = prepareStopTimetable([makeEntry()], false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('handles single terminal entry', () => {
      const result = prepareStopTimetable([makeEntry({ isTerminal: true })], false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('preserves entry order', () => {
      const entries = [
        makeEntry({ departureMinutes: 600 }),
        makeEntry({ departureMinutes: 480, isTerminal: true }),
        makeEntry({ departureMinutes: 540 }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries[0].schedule.departureMinutes).toBe(600);
      expect(result.entries[1].schedule.departureMinutes).toBe(540);
    });

    it('filters by boardability: pickupType=1 removed, 2/3 kept, dropOffType=1 kept', () => {
      // The boardability filter (= !isDropOffOnly) excludes entries with
      // pickupType === 1 (= source explicit "no pickup"). pickupType 2/3
      // (phone/coordinate arrangement required, but still boardable) and
      // dropOffType=1 (drop-off-only-side signal, irrelevant to boarding)
      // are kept.
      const entries = [
        makeEntry({ pickupType: 0 }), // kept
        makeEntry({ pickupType: 1 }), // removed (non-boardable)
        makeEntry({ pickupType: 2 }), // kept (phone arrangement, boardable)
        makeEntry({ pickupType: 3 }), // kept (driver coordinate, boardable)
        makeEntry({ dropOffType: 1 }), // kept (drop-off side does not affect boarding)
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(4);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('isOrigin alone does not trigger removal (origin remains boardable)', () => {
      // Only isTerminal (or pickupType === 1) triggers removal.
      // isOrigin: true entries are kept unless they are also terminal
      // (= circular route case).
      const entries = [
        makeEntry({ isOrigin: true }),
        makeEntry({ isOrigin: true, isTerminal: true }),
        makeEntry({ isOrigin: false }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('filter criterion is !isDropOffOnly (terminal OR pickupType=1)', () => {
      // Both signals trigger removal independently:
      //   terminal + pickupType=0 → removed (terminal triggers isDropOffOnly)
      //   non-terminal + pickupType=1 → removed (pickupType=1 triggers isDropOffOnly)
      const entries = [
        makeEntry({ isTerminal: true, pickupType: 0 }),
        makeEntry({ isTerminal: false, pickupType: 1 }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(2);
    });

    it('circular route: isTerminal && isOrigin both true → filtered out', () => {
      // Circular routes have the same stop as both origin and terminal.
      // isTerminal should win and the entry should be removed.
      const entries = [makeEntry({ isTerminal: true, isOrigin: true }), makeEntry()];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('does not modify the input array', () => {
      const entries = [makeEntry(), makeEntry({ isTerminal: true }), makeEntry()];
      const original = [...entries];
      prepareStopTimetable(entries, false);
      expect(entries).toHaveLength(original.length);
      expect(entries).toEqual(original);
    });
  });
});

// ---------------------------------------------------------------------------
// prepareRouteHeadsignTimetable
// ---------------------------------------------------------------------------

describe('prepareRouteHeadsignTimetable', () => {
  describe('route+headsign filtering', () => {
    it('returns only entries matching route+headsign', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'South' }),
        makeEntry({ route: routeB, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].routeDirection.route.route_id).toBe('routeA');
      expect(getEffectiveHeadsign(result.entries[0].routeDirection)).toBe('North');
    });

    it('matches both route_id and headsign (same route, different headsign)', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'South' }),
        makeEntry({ route: routeA, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries).toHaveLength(2);
    });

    it('matches both route_id and headsign (different route, same headsign)', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeB, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries).toHaveLength(1);
    });

    it('handles empty headsign (京王バス pattern)', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: '' }),
        makeEntry({ route: routeA, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', '', true);
      expect(result.entries).toHaveLength(1);
      expect(getEffectiveHeadsign(result.entries[0].routeDirection)).toBe('');
    });

    it('returns empty when no entries match', () => {
      const entries = [makeEntry({ route: routeA, headsign: 'North' })];
      const result = prepareRouteHeadsignTimetable(entries, 'routeB', 'South', true);
      expect(result.entries).toHaveLength(0);
    });
  });

  describe('terminal filtering within route+headsign scope', () => {
    it('filters terminals only from matching route+headsign', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('includes terminals when includeNonBoardable is true', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('returns empty when all matching entries are terminal', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(2);
    });
  });

  describe('omitted scoping (PR #62 issue #5)', () => {
    it('omitted.nonBoardable does not include other routes terminals', () => {
      const entries = [
        // routeA North: 2 normal + 1 terminal
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
        // routeB North: 3 terminal (must NOT appear in routeA omitted)
        makeEntry({ route: routeB, headsign: 'North', isTerminal: true }),
        makeEntry({ route: routeB, headsign: 'North', isTerminal: true }),
        makeEntry({ route: routeB, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(1); // not 4
    });

    it('omitted.nonBoardable does not include other headsigns terminals', () => {
      const entries = [
        // routeA North: 1 normal
        makeEntry({ route: routeA, headsign: 'North' }),
        // routeA South: 3 terminal (must NOT appear in North omitted)
        makeEntry({ route: routeA, headsign: 'South', isTerminal: true }),
        makeEntry({ route: routeA, headsign: 'South', isTerminal: true }),
        makeEntry({ route: routeA, headsign: 'South', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('real-world scenario: バスタ新宿 (mixed routes, drop-off only stop-wide)', () => {
      // Stop has 419 terminal entries from 京王バス and 191 boardable
      // Opening route-specific timetable should show only that route's omitted
      const entries = [
        // 京王バス route1: all terminal (arrival-only)
        ...Array.from({ length: 5 }, () =>
          makeEntry({ route: routeA, headsign: 'Shinjuku', isTerminal: true }),
        ),
        // 京王バス route2: all terminal
        ...Array.from({ length: 3 }, () =>
          makeEntry({ route: routeB, headsign: 'Shinjuku', isTerminal: true }),
        ),
        // 京王バス route1: boardable (stop times)
        ...Array.from({ length: 2 }, () => makeEntry({ route: routeA, headsign: 'Nakano' })),
      ];
      // Route A Shinjuku: all 5 are terminal
      const resultA = prepareRouteHeadsignTimetable(entries, 'routeA', 'Shinjuku', false);
      expect(resultA.entries).toHaveLength(0);
      expect(resultA.omitted.nonBoardable).toBe(5); // not 8 (5+3)

      // Route A Nakano: no terminals
      const resultB = prepareRouteHeadsignTimetable(entries, 'routeA', 'Nakano', false);
      expect(resultB.entries).toHaveLength(2);
      expect(resultB.omitted.nonBoardable).toBe(0);
    });
  });

  describe('invariant: entries.length + omitted.nonBoardable = matching entries count', () => {
    it('holds for filtered results', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeB, headsign: 'South' }), // not matching
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      const totalMatching = entries.filter(
        (e) =>
          e.routeDirection.route.route_id === 'routeA' &&
          getEffectiveHeadsign(e.routeDirection) === 'North',
      ).length;
      expect(result.entries.length + result.omitted.nonBoardable).toBe(totalMatching);
    });

    it('holds when includeNonBoardable is true', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries.length + result.omitted.nonBoardable).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      const result = prepareRouteHeadsignTimetable([], 'routeA', 'North', false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('preserves entry order within matched route+headsign', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', departureMinutes: 600 }),
        makeEntry({ route: routeB, headsign: 'North', departureMinutes: 500 }),
        makeEntry({ route: routeA, headsign: 'North', departureMinutes: 540 }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries[0].schedule.departureMinutes).toBe(600);
      expect(result.entries[1].schedule.departureMinutes).toBe(540);
    });

    it('filters by boardability within route+headsign: pickupType=1 removed', () => {
      // The boardability filter (= !isDropOffOnly) excludes pickupType === 1.
      // pickupType 2/3 (arrangement required, still boardable) and dropOffType=1
      // (drop-off-side signal, irrelevant to boarding) are kept.
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', pickupType: 0 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 1 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 2 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 3 }),
        makeEntry({ route: routeA, headsign: 'North', dropOffType: 1 }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(4);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('is not affected by isOrigin (only isTerminal matters)', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isOrigin: true }),
        makeEntry({ route: routeA, headsign: 'North', isOrigin: true, isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('uses exact match for route_id and headsign (no normalization)', () => {
      // Ensure no trim, case-fold, or other normalization is applied.
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North ' }), // trailing space
        makeEntry({ route: routeA, headsign: 'north' }), // different case
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries).toHaveLength(1);
    });

    it('zero matches with large data from other scopes', () => {
      // Target route+headsign has 0 entries, but other scopes have many terminals.
      const entries = Array.from({ length: 100 }, () =>
        makeEntry({ route: routeB, headsign: 'South', isTerminal: true }),
      );
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(0); // not 100
    });

    it('circular route: isTerminal && isOrigin both true → filtered out', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true, isOrigin: true }),
        makeEntry({ route: routeA, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('does not modify the input array', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
        makeEntry({ route: routeB, headsign: 'South' }),
      ];
      const original = [...entries];
      prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(entries).toHaveLength(original.length);
      expect(entries).toEqual(original);
    });
  });
});

// ---------------------------------------------------------------------------
// filterByAgency
// ---------------------------------------------------------------------------

describe('filterByAgency', () => {
  const routeAgencyA1: Route = { ...routeA, route_id: 'a1', agency_id: 'agencyA' };
  const routeAgencyA2: Route = { ...routeA, route_id: 'a2', agency_id: 'agencyA' };
  const routeAgencyB1: Route = { ...routeA, route_id: 'b1', agency_id: 'agencyB' };

  it('returns input unchanged when hiddenAgencyIds is empty', () => {
    const entries = [makeEntry({ route: routeAgencyA1 }), makeEntry({ route: routeAgencyB1 })];
    const result = filterByAgency(entries, new Set());
    expect(result).toBe(entries);
  });

  it('excludes entries whose route belongs to a hidden agency', () => {
    const entries = [
      makeEntry({ route: routeAgencyA1 }),
      makeEntry({ route: routeAgencyB1 }),
      makeEntry({ route: routeAgencyA2 }),
    ];
    const result = filterByAgency(entries, new Set(['agencyA']));
    expect(result).toHaveLength(1);
    expect(result[0]?.routeDirection.route.agency_id).toBe('agencyB');
  });

  it('returns empty array when all entries belong to hidden agencies', () => {
    const entries = [makeEntry({ route: routeAgencyA1 }), makeEntry({ route: routeAgencyB1 })];
    const result = filterByAgency(entries, new Set(['agencyA', 'agencyB']));
    expect(result).toEqual([]);
  });

  it('keeps all entries when no agency is hidden', () => {
    const entries = [makeEntry({ route: routeAgencyA1 }), makeEntry({ route: routeAgencyB1 })];
    const result = filterByAgency(entries, new Set(['unrelated']));
    expect(result).toHaveLength(2);
  });

  it('handles empty entries array', () => {
    const result = filterByAgency([], new Set(['agencyA']));
    expect(result).toEqual([]);
  });

  it('does not modify the input array', () => {
    const entries = [makeEntry({ route: routeAgencyA1 }), makeEntry({ route: routeAgencyB1 })];
    const original = [...entries];
    filterByAgency(entries, new Set(['agencyA']));
    expect(entries).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// filterByRouteType
// ---------------------------------------------------------------------------

describe('filterByRouteType', () => {
  const routeTram: Route = { ...routeA, route_id: 'tram1', route_type: 0 };
  const routeSubway: Route = { ...routeA, route_id: 'subway1', route_type: 1 };
  const routeRail: Route = { ...routeA, route_id: 'rail1', route_type: 2 };
  const routeBus: Route = { ...routeA, route_id: 'bus1', route_type: 3 };

  it('returns input unchanged when hiddenRouteTypes is empty', () => {
    const entries = [makeEntry({ route: routeTram }), makeEntry({ route: routeBus })];
    const result = filterByRouteType(entries, new Set());
    expect(result).toBe(entries);
  });

  it('excludes entries whose route_type is hidden', () => {
    const entries = [
      makeEntry({ route: routeTram }),
      makeEntry({ route: routeSubway }),
      makeEntry({ route: routeRail }),
      makeEntry({ route: routeBus }),
    ];
    const result = filterByRouteType(entries, new Set([0]));
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.routeDirection.route.route_type)).toEqual([1, 2, 3]);
  });

  it('hides multiple route types at once', () => {
    const entries = [
      makeEntry({ route: routeTram }),
      makeEntry({ route: routeSubway }),
      makeEntry({ route: routeRail }),
      makeEntry({ route: routeBus }),
    ];
    const result = filterByRouteType(entries, new Set([0, 1]));
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.routeDirection.route.route_type)).toEqual([2, 3]);
  });

  it('returns empty array when all entries match hidden types', () => {
    const entries = [makeEntry({ route: routeTram }), makeEntry({ route: routeBus })];
    const result = filterByRouteType(entries, new Set([0, 3]));
    expect(result).toEqual([]);
  });

  it('keeps all entries when hidden type is not present', () => {
    const entries = [makeEntry({ route: routeTram }), makeEntry({ route: routeBus })];
    const result = filterByRouteType(entries, new Set([11]));
    expect(result).toHaveLength(2);
  });

  it('handles empty entries array', () => {
    const result = filterByRouteType([], new Set([3]));
    expect(result).toEqual([]);
  });

  it('preserves entry order', () => {
    const entries = [
      makeEntry({ route: routeTram, departureMinutes: 600 }),
      makeEntry({ route: routeBus, departureMinutes: 480 }),
      makeEntry({ route: routeTram, departureMinutes: 540 }),
      makeEntry({ route: routeBus, departureMinutes: 520 }),
    ];
    const result = filterByRouteType(entries, new Set([0]));
    expect(result).toHaveLength(2);
    expect(result[0].schedule.departureMinutes).toBe(480);
    expect(result[1].schedule.departureMinutes).toBe(520);
  });

  it('does not modify the input array', () => {
    const entries = [makeEntry({ route: routeTram }), makeEntry({ route: routeBus })];
    const original = [...entries];
    filterByRouteType(entries, new Set([0]));
    expect(entries).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// filterBoardable
// ---------------------------------------------------------------------------

describe('filterBoardable', () => {
  describe('empty input', () => {
    it('returns empty array', () => {
      expect(filterBoardable([])).toEqual([]);
    });
  });

  describe('all boardable (!isDropOffOnly)', () => {
    it('returns single entry', () => {
      expect(filterBoardable([makeEntry()])).toHaveLength(1);
    });

    it('returns all entries', () => {
      expect(filterBoardable([makeEntry(), makeEntry(), makeEntry()])).toHaveLength(3);
    });

    it('keeps isOrigin entries', () => {
      expect(filterBoardable([makeEntry({ isOrigin: true })])).toHaveLength(1);
    });

    it('keeps pickupType=0 (available)', () => {
      expect(filterBoardable([makeEntry({ pickupType: 0 })])).toHaveLength(1);
    });

    it('keeps pickupType=2 (phone required) — requires arrangement but boardable', () => {
      expect(filterBoardable([makeEntry({ pickupType: 2 })])).toHaveLength(1);
    });

    it('keeps pickupType=3 (coordinate required) — requires arrangement but boardable', () => {
      expect(filterBoardable([makeEntry({ pickupType: 3 })])).toHaveLength(1);
    });
  });

  describe('all isDropOffOnly', () => {
    it('filters single terminal entry', () => {
      expect(filterBoardable([makeEntry({ isTerminal: true })])).toHaveLength(0);
    });

    it('filters single pickupType=1 entry', () => {
      expect(filterBoardable([makeEntry({ pickupType: 1 })])).toHaveLength(0);
    });

    it('filters multiple terminal entries', () => {
      const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('filters multiple pickupType=1 entries', () => {
      const entries = [makeEntry({ pickupType: 1 }), makeEntry({ pickupType: 1 })];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('filters when both isTerminal and pickupType=1 are set', () => {
      expect(filterBoardable([makeEntry({ isTerminal: true, pickupType: 1 })])).toHaveLength(0);
    });

    it('filters mix of terminal and pickupType=1', () => {
      const entries = [
        makeEntry({ isTerminal: true }),
        makeEntry({ pickupType: 1 }),
        makeEntry({ isTerminal: true, pickupType: 1 }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });
  });

  describe('mixed boardable and isDropOffOnly', () => {
    it('keeps boardable, filters terminal', () => {
      const boardable = makeEntry();
      const terminal = makeEntry({ isTerminal: true });
      expect(filterBoardable([terminal, boardable])).toEqual([boardable]);
    });

    it('keeps boardable, filters pickupType=1', () => {
      const boardable = makeEntry();
      const pickup1 = makeEntry({ pickupType: 1 });
      expect(filterBoardable([pickup1, boardable])).toEqual([boardable]);
    });

    it('keeps boardable, filters both terminal and pickupType=1', () => {
      const boardable = makeEntry();
      const terminal = makeEntry({ isTerminal: true });
      const pickup1 = makeEntry({ pickupType: 1 });
      expect(filterBoardable([terminal, boardable, pickup1])).toEqual([boardable]);
    });

    it('preserves order of boardable entries', () => {
      const a = makeEntry({ departureMinutes: 480 });
      const b = makeEntry({ departureMinutes: 540 });
      const c = makeEntry({ departureMinutes: 600 });
      const term = makeEntry({ departureMinutes: 500, isTerminal: true });
      expect(filterBoardable([a, term, b, c]).map((e) => e.schedule.departureMinutes)).toEqual([
        480, 540, 600,
      ]);
    });
  });

  describe('multi-route / multi-agency', () => {
    const routeA = makeRoute('route-A', 'agency-1');
    const routeB = makeRoute('route-B', 'agency-2');

    it('filters per-entry regardless of route (mixed agencies)', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true }), // agency-1, terminal
        makeEntry({ route: routeB }), // agency-2, boardable
        makeEntry({ route: routeA }), // agency-1, boardable
        makeEntry({ route: routeB, pickupType: 1 }), // agency-2, pickup unavailable
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result[0].routeDirection.route.route_id).toBe('route-B');
      expect(result[1].routeDirection.route.route_id).toBe('route-A');
    });

    it('returns empty when all routes are terminal (single agency)', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true }),
        makeEntry({ route: routeA, isTerminal: true }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('returns empty when all routes are drop-off only (multiple agencies)', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true }),
        makeEntry({ route: routeB, pickupType: 1 }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('keeps boardable entries from one agency while filtering terminal from another', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true, departureMinutes: 480 }),
        makeEntry({ route: routeB, departureMinutes: 490 }),
        makeEntry({ route: routeA, isTerminal: true, departureMinutes: 500 }),
        makeEntry({ route: routeB, departureMinutes: 510 }),
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.routeDirection.route.agency_id === 'agency-2')).toBe(true);
    });
  });

  describe('turnaround stop (同一路線で ORIG/TERM 交互 — 日野駅パターン)', () => {
    it('keeps ORIG entries and filters TERM entries from same route', () => {
      const route = makeRoute('route-bus');
      const entries = [
        makeEntry({ route, departureMinutes: 1255, isTerminal: true, pickupType: 1 }), // 20:55 着
        makeEntry({ route, departureMinutes: 1258, isTerminal: true, pickupType: 1 }), // 20:58 着
        makeEntry({ route, departureMinutes: 1260, isOrigin: true, pickupType: 0 }), // 21:00 発
        makeEntry({ route, departureMinutes: 1265, isTerminal: true, pickupType: 1 }), // 21:05 着
        makeEntry({ route, departureMinutes: 1270, isOrigin: true, pickupType: 0 }), // 21:10 発
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.schedule.departureMinutes)).toEqual([1260, 1270]);
    });
  });

  describe('pt=0 with isTerminal fallback (都バス — pt 未設定ソース)', () => {
    it('filters all entries when pt=0 but all are terminal', () => {
      // 都バスは pickup_type を設定しない (全て 0)。
      // isTerminal フォールバックで終点を検出。
      const entries = [
        makeEntry({ pickupType: 0, isTerminal: true, departureMinutes: 480 }),
        makeEntry({ pickupType: 0, isTerminal: true, departureMinutes: 540 }),
        makeEntry({ pickupType: 0, isTerminal: true, departureMinutes: 600 }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('keeps non-terminal entries when pt=0', () => {
      const entries = [
        makeEntry({ pickupType: 0, isTerminal: true }),
        makeEntry({ pickupType: 0, isTerminal: false }),
        makeEntry({ pickupType: 0, isOrigin: true }),
      ];
      expect(filterBoardable(entries)).toHaveLength(2);
    });
  });

  describe('mid-route pickup unavailable (途中停留所で pt=1)', () => {
    it('filters pt=1 entry that is not terminal', () => {
      // 途中停留所だが乗車不可 — 本来の「降車専用」
      const entry = makeEntry({ pickupType: 1, isTerminal: false, stopIndex: 5, totalStops: 10 });
      expect(filterBoardable([entry])).toHaveLength(0);
    });

    it('keeps other entries at same stop when only some have pt=1', () => {
      const route = makeRoute('route-express');
      const entries = [
        makeEntry({ route, pickupType: 1, departureMinutes: 480 }), // express: no pickup
        makeEntry({ route, pickupType: 0, departureMinutes: 510 }), // local: pickup ok
        makeEntry({ route, pickupType: 1, departureMinutes: 540 }), // express: no pickup
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(1);
      expect(result[0].schedule.departureMinutes).toBe(510);
    });
  });

  describe('same route+headsign with mixed pt per stop time', () => {
    it('filters individually even within same route+headsign', () => {
      // v2 pipeline では pt は便ごとの配列。同じ trip pattern でも
      // 便によって pt が異なりうる。
      const route = makeRoute('route-X');
      const entries = [
        makeEntry({ route, headsign: 'Terminal', pickupType: 0, departureMinutes: 480 }),
        makeEntry({ route, headsign: 'Terminal', pickupType: 1, departureMinutes: 510 }),
        makeEntry({ route, headsign: 'Terminal', pickupType: 0, departureMinutes: 540 }),
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.schedule.departureMinutes)).toEqual([480, 540]);
    });
  });

  describe('circular route edge case', () => {
    it('filters isTerminal && isOrigin — current behavior', () => {
      // Circular routes have the same stop as both origin and terminal.
      // isDropOffOnly returns true because isTerminal is checked.
      // This may cause false positives for circular routes where
      // passengers CAN board at the terminal/origin stop.
      const entry = makeEntry({ isTerminal: true, isOrigin: true });
      expect(filterBoardable([entry])).toHaveLength(0);
    });

    it('filters isTerminal && isOrigin even with pickupType=0', () => {
      // pt=0 is ambiguous (available OR not set). isTerminal takes precedence.
      const entry = makeEntry({ isTerminal: true, isOrigin: true, pickupType: 0 });
      expect(filterBoardable([entry])).toHaveLength(0);
    });
  });
});
