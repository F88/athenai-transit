import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { ContextualTimetableEntry, TimetableEntry } from '../../../types/app/transit-composed';
import {
  applyStopEventAttributeToggles,
  filterByAgency,
  filterByRouteType,
  filterByStopEventAttributes,
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

    it('keeps only pickupType=0 entries (1/2/3 all removed)', () => {
      // The new caller uses pickUpState: Set(['boardable']) which maps
      // 1:1 to pickup_type === 0. Entries with pickupType 1/2/3 are all
      // classified as non-boardable / phoneArrangement / driverArrangement
      // respectively and excluded.
      const entries = [
        makeEntry({ pickupType: 0 }), // kept (boardable)
        makeEntry({ pickupType: 1 }), // removed (nonBoardable)
        makeEntry({ pickupType: 2 }), // removed (phoneArrangement)
        makeEntry({ pickupType: 3 }), // removed (driverArrangement)
        makeEntry({ dropOffType: 1 }), // kept (default pickupType=0, drop-off side ignored)
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(3);
    });

    it('isOrigin alone does not trigger removal (origin remains boardable)', () => {
      // Only pure terminal (= !isOrigin && isTerminal) or pickupType !== 0
      // triggers removal. 1-stop trips (isOrigin && isTerminal) match the
      // 'origin' position and are kept.
      const entries = [
        makeEntry({ isOrigin: true }),
        makeEntry({ isOrigin: true, isTerminal: true }),
        makeEntry({ isOrigin: false }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('removes pure terminal (isTerminal=true, !isOrigin) and pickupType=1', () => {
      // The new caller drops entries on two independent grounds:
      //   pure terminal (= isTerminal=true, !isOrigin) → position axis excludes
      //   pickupType=1 (anywhere in the pattern) → pickUpState axis excludes
      const entries = [
        makeEntry({ isTerminal: true, pickupType: 0 }),
        makeEntry({ isTerminal: false, pickupType: 1 }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(2);
    });

    it('1-stop trip (isOrigin && isTerminal, pickupType=0) is kept as origin', () => {
      // 1-stop trips have the same stop as both origin and terminal.
      // The position axis matches via 'origin', and pickUpState='boardable'
      // matches pickup_type=0, so the entry is kept (= depot/yard origin).
      const entries = [makeEntry({ isTerminal: true, isOrigin: true }), makeEntry()];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
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

    it('keeps only pickupType=0 entries within route+headsign (1/2/3 all removed)', () => {
      // The new caller uses pickUpState: Set(['boardable']) which maps
      // 1:1 to pickup_type === 0. Entries with pickupType 1/2/3 are all
      // excluded.
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', pickupType: 0 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 1 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 2 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 3 }),
        makeEntry({ route: routeA, headsign: 'North', dropOffType: 1 }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(3);
    });

    it('1-stop trip (isOrigin && isTerminal) is kept as origin within route+headsign', () => {
      // 1-stop trips match the 'origin' position and are kept.
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isOrigin: true }),
        makeEntry({ route: routeA, headsign: 'North', isOrigin: true, isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
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

    it('circular route: isTerminal && isOrigin both true → kept (origin match)', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true, isOrigin: true }),
        makeEntry({ route: routeA, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
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
// filterByStopEventAttributes
// ---------------------------------------------------------------------------

/** Build an entry with explicit arrivalMinutes (makeEntry mirrors departure to arrival). */
function makeEntryWithArrival(
  departureMinutes: number,
  arrivalMinutes: number,
  overrides: Parameters<typeof makeEntry>[0] = {},
): TimetableEntry {
  const base = makeEntry({ ...overrides, departureMinutes });
  return { ...base, schedule: { departureMinutes, arrivalMinutes } };
}

describe('filterByStopEventAttributes', () => {
  describe('identity / fast-path', () => {
    it('returns the input reference unchanged when all axes are undefined', () => {
      const entries = [makeEntry(), makeEntry({ isTerminal: true })];
      const result = filterByStopEventAttributes(entries, {});
      expect(result).toBe(entries);
    });

    it('returns an empty array when active axes are provided for empty input', () => {
      const result = filterByStopEventAttributes([], {
        position: new Set(['origin']),
        pickUpState: new Set(['boardable']),
      });
      expect(result).toEqual([]);
    });
  });

  describe('position axis', () => {
    const origin = makeEntry({ isOrigin: true, departureMinutes: 480 });
    const terminal = makeEntry({ isTerminal: true, departureMinutes: 540 });
    const middle = makeEntry({ departureMinutes: 600 });
    const entries = [origin, terminal, middle];

    it('keeps only origin entries', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['origin']),
      });
      expect(result).toEqual([origin]);
    });

    it('keeps only terminal entries', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['terminal']),
      });
      expect(result).toEqual([terminal]);
    });

    it('keeps only middle entries (= neither origin nor terminal)', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['middle']),
      });
      expect(result).toEqual([middle]);
    });

    it('keeps origin OR terminal when both are listed', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['origin', 'terminal']),
      });
      expect(result).toEqual([origin, terminal]);
    });

    it('returns empty array for an empty Set (literal "match nothing")', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(),
      });
      expect(result).toEqual([]);
    });

    describe('single-stop trip (isOrigin AND isTerminal)', () => {
      const oneStop = makeEntry({ isOrigin: true, isTerminal: true });

      it('matches "origin"', () => {
        const result = filterByStopEventAttributes([oneStop], {
          position: new Set(['origin']),
        });
        expect(result).toEqual([oneStop]);
      });

      it('matches "terminal"', () => {
        const result = filterByStopEventAttributes([oneStop], {
          position: new Set(['terminal']),
        });
        expect(result).toEqual([oneStop]);
      });

      it('does NOT match "middle"', () => {
        const result = filterByStopEventAttributes([oneStop], {
          position: new Set(['middle']),
        });
        expect(result).toEqual([]);
      });
    });
  });

  describe('pickUpState axis', () => {
    // Maps 1:1 to GTFS pickup_type values; isTerminal is NOT mixed in.
    const pt0Plain = makeEntry({ pickupType: 0, departureMinutes: 480 }); // boardable
    const pt1Plain = makeEntry({ pickupType: 1, departureMinutes: 540 }); // nonBoardable
    const pt0Terminal = makeEntry({ pickupType: 0, isTerminal: true, departureMinutes: 600 }); // still boardable (pt=0)
    const pt2Plain = makeEntry({ pickupType: 2, departureMinutes: 660 }); // phoneArrangement
    const pt3Plain = makeEntry({ pickupType: 3, departureMinutes: 720 }); // driverArrangement
    const entries = [pt0Plain, pt1Plain, pt0Terminal, pt2Plain, pt3Plain];

    it('keeps boardable entries (= pickup_type === 0) regardless of isTerminal', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['boardable']),
      });
      expect(result).toEqual([pt0Plain, pt0Terminal]);
    });

    it('keeps nonBoardable entries (= pickup_type === 1)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['nonBoardable']),
      });
      expect(result).toEqual([pt1Plain]);
    });

    it('keeps phoneArrangement entries (= pickup_type === 2)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['phoneArrangement']),
      });
      expect(result).toEqual([pt2Plain]);
    });

    it('keeps driverArrangement entries (= pickup_type === 3)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['driverArrangement']),
      });
      expect(result).toEqual([pt3Plain]);
    });

    it('keeps everything when all four states are listed', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set([
          'boardable',
          'nonBoardable',
          'phoneArrangement',
          'driverArrangement',
        ]),
      });
      expect(result).toEqual(entries);
    });

    it('keeps multiple states as union (boardable OR nonBoardable)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['boardable', 'nonBoardable']),
      });
      expect(result).toEqual([pt0Plain, pt1Plain, pt0Terminal]);
    });

    it('returns empty array for an empty Set', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(),
      });
      expect(result).toEqual([]);
    });

    it('classifies a single-stop trip (isOrigin && isTerminal, pt=0) as boardable', () => {
      // pickUpState only looks at pickup_type; isOrigin / isTerminal
      // do not influence the classification.
      const oneStop = makeEntry({ isOrigin: true, isTerminal: true, pickupType: 0 });
      const result = filterByStopEventAttributes([oneStop], {
        pickUpState: new Set(['boardable']),
      });
      expect(result).toEqual([oneStop]);
    });
  });

  describe('schedule axis', () => {
    const at0800 = makeEntry({ departureMinutes: 480 });
    const at0900 = makeEntry({ departureMinutes: 540 });
    const at1200 = makeEntry({ departureMinutes: 720 });
    const at1500 = makeEntry({ departureMinutes: 900 });
    const entries = [at0800, at0900, at1200, at1500];

    it('keeps entries at or after fromMinutes (lower bound, inclusive)', () => {
      const result = filterByStopEventAttributes(entries, {
        schedule: { fromMinutes: 540 },
      });
      expect(result).toEqual([at0900, at1200, at1500]);
    });

    it('keeps entries at or before toMinutes (upper bound, inclusive)', () => {
      const result = filterByStopEventAttributes(entries, {
        schedule: { toMinutes: 720 },
      });
      expect(result).toEqual([at0800, at0900, at1200]);
    });

    it('applies both bounds inclusively', () => {
      const result = filterByStopEventAttributes(entries, {
        schedule: { fromMinutes: 540, toMinutes: 720 },
      });
      expect(result).toEqual([at0900, at1200]);
    });

    it('keeps everything when neither bound is given', () => {
      const result = filterByStopEventAttributes(entries, {
        schedule: { field: 'departure' },
      });
      expect(result).toEqual(entries);
    });

    it('uses arrivalMinutes when field === "arrival"', () => {
      const arr0800 = makeEntryWithArrival(900, 480);
      const arr0900 = makeEntryWithArrival(900, 540);
      const arr1000 = makeEntryWithArrival(900, 600);
      const result = filterByStopEventAttributes([arr0800, arr0900, arr1000], {
        schedule: { field: 'arrival', fromMinutes: 540 },
      });
      expect(result).toEqual([arr0900, arr1000]);
    });

    it('handles overnight times (>= 1440) as plain numbers', () => {
      const at2330 = makeEntry({ departureMinutes: 1410 });
      const at2500 = makeEntry({ departureMinutes: 1500 });
      const at2630 = makeEntry({ departureMinutes: 1590 });
      const result = filterByStopEventAttributes([at2330, at2500, at2630], {
        schedule: { fromMinutes: 1440, toMinutes: 1560 },
      });
      expect(result).toEqual([at2500]);
    });

    describe('boundary values are inclusive', () => {
      it('keeps an entry equal to fromMinutes', () => {
        const exact = makeEntry({ departureMinutes: 540 });
        const result = filterByStopEventAttributes([exact], {
          schedule: { fromMinutes: 540 },
        });
        expect(result).toEqual([exact]);
      });

      it('keeps an entry equal to toMinutes', () => {
        const exact = makeEntry({ departureMinutes: 720 });
        const result = filterByStopEventAttributes([exact], {
          schedule: { toMinutes: 720 },
        });
        expect(result).toEqual([exact]);
      });
    });
  });

  describe('multi-axis composition (AND across axes)', () => {
    const originBoardable = makeEntry({ isOrigin: true, departureMinutes: 540 });
    const originDropOff = makeEntry({ isOrigin: true, pickupType: 1, departureMinutes: 600 });
    const middleBoardable = makeEntry({ departureMinutes: 660 });
    const terminalDropOff = makeEntry({ isTerminal: true, departureMinutes: 720 });
    const entries = [originBoardable, originDropOff, middleBoardable, terminalDropOff];

    it('combines position and pickUpState (origin AND boardable)', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['origin']),
        pickUpState: new Set(['boardable']),
      });
      expect(result).toEqual([originBoardable]);
    });

    it('combines all three axes', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['origin', 'middle']),
        pickUpState: new Set(['boardable']),
        schedule: { fromMinutes: 600, toMinutes: 720 },
      });
      expect(result).toEqual([middleBoardable]);
    });

    it('combines arrival-based schedule filtering with position and pickUpState', () => {
      const originEarlyArrival = makeEntryWithArrival(900, 500, { isOrigin: true });
      const originLateArrival = makeEntryWithArrival(900, 560, { isOrigin: true });
      const middleLateArrival = makeEntryWithArrival(900, 580);
      const originLateDropOff = makeEntryWithArrival(900, 600, {
        isOrigin: true,
        pickupType: 1,
      });

      const result = filterByStopEventAttributes(
        [originEarlyArrival, originLateArrival, middleLateArrival, originLateDropOff],
        {
          position: new Set(['origin']),
          pickUpState: new Set(['boardable']),
          schedule: { field: 'arrival', fromMinutes: 540 },
        },
      );

      expect(result).toEqual([originLateArrival]);
    });

    it('keeps a single-stop trip when origin/terminal and boardable both match', () => {
      // 1-stop trip (isOrigin && isTerminal) matches both 'origin' and
      // 'terminal'. With pickup_type=0 the entry is also classified as
      // boardable, so all axes match and the entry is kept.
      const oneStop = makeEntry({
        isOrigin: true,
        isTerminal: true,
        pickupType: 0,
        departureMinutes: 540,
      });
      const result = filterByStopEventAttributes([oneStop], {
        position: new Set(['origin', 'terminal']),
        pickUpState: new Set(['boardable']),
      });
      expect(result).toEqual([oneStop]);
    });
  });

  describe('generic preservation', () => {
    it('preserves the input element type at the type level', () => {
      // Type-level check: `tsc --noEmit` will fail if the function ever
      // narrows the result back to `TimetableEntry[]`. Runtime is just a
      // sanity smoke test that the call works. Both entries have
      // pickup_type=0 (default), so pickUpState='boardable' keeps both
      // regardless of isTerminal.
      const branded: (TimetableEntry & { _brand: 'sample' })[] = [
        Object.assign(makeEntry(), { _brand: 'sample' as const }),
        Object.assign(makeEntry({ pickupType: 1 }), { _brand: 'sample' as const }),
      ];
      const filtered: (TimetableEntry & { _brand: 'sample' })[] = filterByStopEventAttributes(
        branded,
        { pickUpState: new Set(['boardable']) },
      );
      expect(filtered).toHaveLength(1);
      // Element type is preserved, so accessing the brand compiles.
      expect(filtered[0]._brand).toBe('sample');
    });

    it('preserves ContextualTimetableEntry without dropping serviceDate', () => {
      const contextual: ContextualTimetableEntry[] = [
        {
          ...makeEntry({ departureMinutes: 480 }),
          serviceDate: new Date(2026, 3, 30),
        },
        {
          ...makeEntry({ pickupType: 1, departureMinutes: 540 }),
          serviceDate: new Date(2026, 3, 30),
        },
      ];

      const filtered: ContextualTimetableEntry[] = filterByStopEventAttributes(contextual, {
        pickUpState: new Set(['boardable']),
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].serviceDate.getTime()).toBe(contextual[0].serviceDate.getTime());
    });
  });
});

// ---------------------------------------------------------------------------
// applyStopEventAttributeToggles
// ---------------------------------------------------------------------------

describe('applyStopEventAttributeToggles', () => {
  const originPt0 = makeEntry({ isOrigin: true, pickupType: 0, departureMinutes: 480 });
  const originPt1 = makeEntry({ isOrigin: true, pickupType: 1, departureMinutes: 540 });
  const middlePt0 = makeEntry({ pickupType: 0, departureMinutes: 600 });
  const middlePt2 = makeEntry({ pickupType: 2, departureMinutes: 660 });
  const terminalPt0 = makeEntry({ isTerminal: true, pickupType: 0, departureMinutes: 720 });
  const entries = [originPt0, originPt1, middlePt0, middlePt2, terminalPt0];

  describe('identity / fast-path', () => {
    it('returns the input reference unchanged when both toggles are false', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showOriginOnly: false,
        showBoardableOnly: false,
      });
      expect(result).toBe(entries);
    });
  });

  describe('showOriginOnly only', () => {
    it('keeps origin entries (boardable AND non-boardable origins)', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showOriginOnly: true,
        showBoardableOnly: false,
      });
      expect(result).toEqual([originPt0, originPt1]);
    });
  });

  describe('showBoardableOnly only', () => {
    it('keeps pickup_type=0 entries at non-pure-terminal positions', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showOriginOnly: false,
        showBoardableOnly: true,
      });
      // originPt0 (origin, pt=0): kept
      // originPt1 (origin, pt=1): excluded by pickUpState
      // middlePt0 (middle, pt=0): kept
      // middlePt2 (middle, pt=2): excluded by pickUpState
      // terminalPt0 (pure terminal, pt=0): excluded by position
      expect(result).toEqual([originPt0, middlePt0]);
    });
  });

  describe('both toggles on (AND composition)', () => {
    it('keeps only origin AND boardable entries', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showOriginOnly: true,
        showBoardableOnly: true,
      });
      // originPt0 alone matches: isOrigin=true AND pickup_type=0
      expect(result).toEqual([originPt0]);
    });
  });

  describe('generic preservation', () => {
    it('preserves the input element type at the type level', () => {
      const contextual: ContextualTimetableEntry[] = [
        { ...makeEntry({ isOrigin: true, pickupType: 0 }), serviceDate: new Date(2026, 3, 30) },
        { ...makeEntry({ pickupType: 1 }), serviceDate: new Date(2026, 3, 30) },
      ];
      const filtered: ContextualTimetableEntry[] = applyStopEventAttributeToggles(contextual, {
        showOriginOnly: true,
        showBoardableOnly: false,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].serviceDate.getTime()).toBe(contextual[0].serviceDate.getTime());
    });
  });
});
