import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { ContextualTimetableEntry, TimetableEntry } from '../../../types/app/transit-composed';
import {
  applyStopEventAttributeToggles,
  applyStopEventAttributeTogglesToStops,
  filterByAgency,
  filterByRouteType,
  filterByStopEventAttributes,
  matchesBoardability,
  omitStopsWithoutStopTimes,
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
    isLastStop?: boolean;
    isFirstStop?: boolean;
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
      isLastStop: overrides.isLastStop ?? false,
      isFirstStop: overrides.isFirstStop ?? false,
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
        makeEntry({ isLastStop: true }),
        makeEntry({ isLastStop: true }),
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
      const entries = [makeEntry({ isLastStop: true }), makeEntry({ isLastStop: true })];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
    });
  });

  describe('includeNonBoardable = false (simple/normal)', () => {
    it('filters out terminal entries', () => {
      const entries = [
        makeEntry(),
        makeEntry({ isLastStop: true }),
        makeEntry({ isLastStop: true }),
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
      const entries = [makeEntry({ isLastStop: true }), makeEntry({ isLastStop: true })];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(2);
    });

    it('preserves non-terminal entries from multiple routes', () => {
      const entries = [
        makeEntry({ route: routeA }),
        makeEntry({ route: routeA, isLastStop: true }),
        makeEntry({ route: routeB }),
        makeEntry({ route: routeB, isLastStop: true }),
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
        makeEntry({ isLastStop: true }),
        makeEntry(),
        makeEntry({ isLastStop: true }),
        makeEntry({ isLastStop: true }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries.length + result.omitted.nonBoardable).toBe(entries.length);
    });

    it('holds when includeNonBoardable is true', () => {
      const entries = [makeEntry(), makeEntry({ isLastStop: true })];
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
      const result = prepareStopTimetable([makeEntry({ isLastStop: true })], false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('preserves entry order', () => {
      const entries = [
        makeEntry({ departureMinutes: 600 }),
        makeEntry({ departureMinutes: 480, isLastStop: true }),
        makeEntry({ departureMinutes: 540 }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries[0].schedule.departureMinutes).toBe(600);
      expect(result.entries[1].schedule.departureMinutes).toBe(540);
    });

    it('keeps pickup_type=0/2/3 entries; removes only pickup_type=1 (noPickupAvailable)', () => {
      // pickup_type=2 (mustPhoneAgency) and 3 (mustCoordinateWithDriver) are
      // operator-arranged pickup signals — boarding is still possible, so they
      // are kept alongside pickup_type=0. Only pickup_type=1 (noPickupAvailable)
      // is excluded.
      const entries = [
        makeEntry({ pickupType: 0 }), // kept (regularlyScheduledPickup)
        makeEntry({ pickupType: 1 }), // removed (noPickupAvailable)
        makeEntry({ pickupType: 2 }), // kept (mustPhoneAgency)
        makeEntry({ pickupType: 3 }), // kept (mustCoordinateWithDriver)
        makeEntry({ dropOffType: 1 }), // kept (default pickupType=0, drop-off side ignored)
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(4);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('isFirstStop alone does not trigger removal (origin remains boardable)', () => {
      // Only pure terminal (= !isFirstStop && isLastStop) or pickupType !== 0
      // triggers removal. 1-stop trips (isFirstStop && isLastStop) match the
      // 'origin' position and are kept.
      const entries = [
        makeEntry({ isFirstStop: true }),
        makeEntry({ isFirstStop: true, isLastStop: true }),
        makeEntry({ isFirstStop: false }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('removes pure terminal (isLastStop=true, !isFirstStop) and pickupType=1', () => {
      // The new caller drops entries on two independent grounds:
      //   pure terminal (= isLastStop=true, !isFirstStop) → position axis excludes
      //   pickupType=1 (anywhere in the pattern) → pickUpState axis excludes
      const entries = [
        makeEntry({ isLastStop: true, pickupType: 0 }),
        makeEntry({ isLastStop: false, pickupType: 1 }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(2);
    });

    it('1-stop trip (isFirstStop && isLastStop, pickupType=0) is kept as origin', () => {
      // 1-stop trips have the same stop as both origin and terminal.
      // The position axis matches via 'origin', and pickUpState='regularlyScheduledPickup'
      // matches pickup_type=0, so the entry is kept (= depot/yard origin).
      const entries = [makeEntry({ isLastStop: true, isFirstStop: true }), makeEntry()];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('does not modify the input array', () => {
      const entries = [makeEntry(), makeEntry({ isLastStop: true }), makeEntry()];
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
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.nonBoardable).toBe(1);
    });

    it('includes terminals when includeNonBoardable is true', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('returns empty when all matching entries are terminal', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
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
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
        // routeB North: 3 terminal (must NOT appear in routeA omitted)
        makeEntry({ route: routeB, headsign: 'North', isLastStop: true }),
        makeEntry({ route: routeB, headsign: 'North', isLastStop: true }),
        makeEntry({ route: routeB, headsign: 'North', isLastStop: true }),
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
        makeEntry({ route: routeA, headsign: 'South', isLastStop: true }),
        makeEntry({ route: routeA, headsign: 'South', isLastStop: true }),
        makeEntry({ route: routeA, headsign: 'South', isLastStop: true }),
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
          makeEntry({ route: routeA, headsign: 'Shinjuku', isLastStop: true }),
        ),
        // 京王バス route2: all terminal
        ...Array.from({ length: 3 }, () =>
          makeEntry({ route: routeB, headsign: 'Shinjuku', isLastStop: true }),
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
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
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
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
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

    it('keeps pickup_type=0/2/3 entries within route+headsign; removes only pickup_type=1', () => {
      // Same rule as prepareStopTimetable: pickup_type=2/3 are kept.
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

    it('1-stop trip (isFirstStop && isLastStop) is kept as origin within route+headsign', () => {
      // 1-stop trips match the 'origin' position and are kept.
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isFirstStop: true }),
        makeEntry({ route: routeA, headsign: 'North', isFirstStop: true, isLastStop: true }),
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
        makeEntry({ route: routeB, headsign: 'South', isLastStop: true }),
      );
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.nonBoardable).toBe(0); // not 100
    });

    it('circular route: isLastStop && isFirstStop both true → kept (origin match)', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true, isFirstStop: true }),
        makeEntry({ route: routeA, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.nonBoardable).toBe(0);
    });

    it('does not modify the input array', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isLastStop: true }),
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

describe('applyStopEventAttributeTogglesToStops', () => {
  it('returns the input reference unchanged when both toggles are false', () => {
    const stops = [{ stopTimes: [makeEntry({ isFirstStop: true })] }, { stopTimes: [makeEntry()] }];

    const result = applyStopEventAttributeTogglesToStops(stops, {
      showFirstStopOnly: false,
      showBoardableOnly: false,
    });

    expect(result).toBe(stops);
  });

  it('keeps unchanged entry content and empties only the stops that do not match', () => {
    const untouched = { stopTimes: [makeEntry({ isFirstStop: true })] };
    const changed = { stopTimes: [makeEntry({ isFirstStop: false })] };

    const result = applyStopEventAttributeTogglesToStops([untouched, changed], {
      showFirstStopOnly: true,
      showBoardableOnly: false,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).not.toBe(untouched);
    expect(result[0]?.stopTimes).toEqual(untouched.stopTimes);
    expect(result[0]?.stopTimes[0]).toBe(untouched.stopTimes[0]);
    expect(result[1]).not.toBe(changed);
    expect(result[1]?.stopTimes).toEqual([]);
  });

  it('handles empty input', () => {
    expect(
      applyStopEventAttributeTogglesToStops([], {
        showFirstStopOnly: true,
        showBoardableOnly: true,
      }),
    ).toEqual([]);
  });
});

describe('omitStopsWithoutStopTimes', () => {
  it('removes only empty stops and preserves surviving stop references', () => {
    const nonEmptyA = { stopTimes: [makeEntry()] };
    const empty = { stopTimes: [] };
    const nonEmptyB = { stopTimes: [makeEntry({ isFirstStop: true })] };

    const result = omitStopsWithoutStopTimes([nonEmptyA, empty, nonEmptyB]);

    expect(result).toEqual([nonEmptyA, nonEmptyB]);
    expect(result[0]).toBe(nonEmptyA);
    expect(result[1]).toBe(nonEmptyB);
  });

  it('returns empty when all stops are empty', () => {
    expect(omitStopsWithoutStopTimes([{ stopTimes: [] }, { stopTimes: [] }])).toEqual([]);
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
      const entries = [makeEntry(), makeEntry({ isLastStop: true })];
      const result = filterByStopEventAttributes(entries, {});
      expect(result).toBe(entries);
    });

    it('returns an empty array when active axes are provided for empty input', () => {
      const result = filterByStopEventAttributes([], {
        position: new Set(['first']),
        pickUpState: new Set(['regularlyScheduledPickup']),
      });
      expect(result).toEqual([]);
    });
  });

  describe('position axis', () => {
    const first = makeEntry({ isFirstStop: true, departureMinutes: 480 });
    const last = makeEntry({ isLastStop: true, departureMinutes: 540 });
    const middle = makeEntry({ departureMinutes: 600 });
    const entries = [first, last, middle];

    it('keeps only first entries', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['first']),
      });
      expect(result).toEqual([first]);
    });

    it('keeps only last entries', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['last']),
      });
      expect(result).toEqual([last]);
    });

    it('keeps only middle entries (= neither first nor last)', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['middle']),
      });
      expect(result).toEqual([middle]);
    });

    it('keeps first OR last when both are listed', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['first', 'last']),
      });
      expect(result).toEqual([first, last]);
    });

    it('returns empty array for an empty Set (literal "match nothing")', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(),
      });
      expect(result).toEqual([]);
    });

    describe('single-stop trip (isFirstStop AND isLastStop)', () => {
      const oneStop = makeEntry({ isFirstStop: true, isLastStop: true });

      it('matches "firstAndLast"', () => {
        const result = filterByStopEventAttributes([oneStop], {
          position: new Set(['firstAndLast']),
        });
        expect(result).toEqual([oneStop]);
      });

      it('does NOT match "first" alone', () => {
        const result = filterByStopEventAttributes([oneStop], {
          position: new Set(['first']),
        });
        expect(result).toEqual([]);
      });

      it('does NOT match "last" alone', () => {
        const result = filterByStopEventAttributes([oneStop], {
          position: new Set(['last']),
        });
        expect(result).toEqual([]);
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
    // Maps 1:1 to GTFS pickup_type values; isLastStop is NOT mixed in.
    const pt0Plain = makeEntry({ pickupType: 0, departureMinutes: 480 }); // regularlyScheduledPickup
    const pt1Plain = makeEntry({ pickupType: 1, departureMinutes: 540 }); // noPickupAvailable
    const pt0Terminal = makeEntry({ pickupType: 0, isLastStop: true, departureMinutes: 600 }); // regularlyScheduledPickup (pt=0)
    const pt2Plain = makeEntry({ pickupType: 2, departureMinutes: 660 }); // mustPhoneAgency
    const pt3Plain = makeEntry({ pickupType: 3, departureMinutes: 720 }); // mustCoordinateWithDriver
    const entries = [pt0Plain, pt1Plain, pt0Terminal, pt2Plain, pt3Plain];

    it('keeps regularlyScheduledPickup entries (= pickup_type === 0) regardless of isLastStop', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['regularlyScheduledPickup']),
      });
      expect(result).toEqual([pt0Plain, pt0Terminal]);
    });

    it('keeps noPickupAvailable entries (= pickup_type === 1)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['noPickupAvailable']),
      });
      expect(result).toEqual([pt1Plain]);
    });

    it('keeps mustPhoneAgency entries (= pickup_type === 2)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['mustPhoneAgency']),
      });
      expect(result).toEqual([pt2Plain]);
    });

    it('keeps mustCoordinateWithDriver entries (= pickup_type === 3)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['mustCoordinateWithDriver']),
      });
      expect(result).toEqual([pt3Plain]);
    });

    it('keeps everything when all four states are listed', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set([
          'regularlyScheduledPickup',
          'noPickupAvailable',
          'mustPhoneAgency',
          'mustCoordinateWithDriver',
        ]),
      });
      expect(result).toEqual(entries);
    });

    it('keeps multiple states as union (regularlyScheduledPickup OR noPickupAvailable)', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(['regularlyScheduledPickup', 'noPickupAvailable']),
      });
      expect(result).toEqual([pt0Plain, pt1Plain, pt0Terminal]);
    });

    it('returns empty array for an empty Set', () => {
      const result = filterByStopEventAttributes(entries, {
        pickUpState: new Set(),
      });
      expect(result).toEqual([]);
    });

    it('classifies a single-stop trip (isFirstStop && isLastStop, pt=0) as regularlyScheduledPickup', () => {
      // pickUpState only looks at pickup_type; isFirstStop / isLastStop
      // do not influence the classification.
      const oneStop = makeEntry({ isFirstStop: true, isLastStop: true, pickupType: 0 });
      const result = filterByStopEventAttributes([oneStop], {
        pickUpState: new Set(['regularlyScheduledPickup']),
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
    const originBoardable = makeEntry({ isFirstStop: true, departureMinutes: 540 });
    const originDropOff = makeEntry({ isFirstStop: true, pickupType: 1, departureMinutes: 600 });
    const middleBoardable = makeEntry({ departureMinutes: 660 });
    const terminalDropOff = makeEntry({ isLastStop: true, departureMinutes: 720 });
    const entries = [originBoardable, originDropOff, middleBoardable, terminalDropOff];

    it('combines position and pickUpState (first AND boardable)', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['first', 'firstAndLast']),
        pickUpState: new Set(['regularlyScheduledPickup']),
      });
      expect(result).toEqual([originBoardable]);
    });

    it('combines all three axes', () => {
      const result = filterByStopEventAttributes(entries, {
        position: new Set(['first', 'middle', 'firstAndLast']),
        pickUpState: new Set(['regularlyScheduledPickup']),
        schedule: { fromMinutes: 600, toMinutes: 720 },
      });
      expect(result).toEqual([middleBoardable]);
    });

    it('combines arrival-based schedule filtering with position and pickUpState', () => {
      const originEarlyArrival = makeEntryWithArrival(900, 500, { isFirstStop: true });
      const originLateArrival = makeEntryWithArrival(900, 560, { isFirstStop: true });
      const middleLateArrival = makeEntryWithArrival(900, 580);
      const originLateDropOff = makeEntryWithArrival(900, 600, {
        isFirstStop: true,
        pickupType: 1,
      });

      const result = filterByStopEventAttributes(
        [originEarlyArrival, originLateArrival, middleLateArrival, originLateDropOff],
        {
          position: new Set(['first', 'firstAndLast']),
          pickUpState: new Set(['regularlyScheduledPickup']),
          schedule: { field: 'arrival', fromMinutes: 540 },
        },
      );

      expect(result).toEqual([originLateArrival]);
    });

    it('keeps a single-stop trip when firstAndLast and boardable both match', () => {
      // 1-stop trip (isFirstStop && isLastStop) matches 'firstAndLast'.
      // With pickup_type=0 the entry is also classified as boardable,
      // so all axes match and the entry is kept.
      const oneStop = makeEntry({
        isFirstStop: true,
        isLastStop: true,
        pickupType: 0,
        departureMinutes: 540,
      });
      const result = filterByStopEventAttributes([oneStop], {
        position: new Set(['firstAndLast']),
        pickUpState: new Set(['regularlyScheduledPickup']),
      });
      expect(result).toEqual([oneStop]);
    });
  });

  describe('generic preservation', () => {
    it('preserves the input element type at the type level', () => {
      // Type-level check: `tsc --noEmit` will fail if the function ever
      // narrows the result back to `TimetableEntry[]`. Runtime is just a
      // sanity smoke test that the call works. Both entries have
      // pickup_type=0 (default), so pickUpState='regularlyScheduledPickup' keeps both
      // regardless of isLastStop.
      const branded: (TimetableEntry & { _brand: 'sample' })[] = [
        Object.assign(makeEntry(), { _brand: 'sample' as const }),
        Object.assign(makeEntry({ pickupType: 1 }), { _brand: 'sample' as const }),
      ];
      const filtered: (TimetableEntry & { _brand: 'sample' })[] = filterByStopEventAttributes(
        branded,
        { pickUpState: new Set(['regularlyScheduledPickup']) },
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
        pickUpState: new Set(['regularlyScheduledPickup']),
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
  const originPt0 = makeEntry({ isFirstStop: true, pickupType: 0, departureMinutes: 480 });
  const originPt1 = makeEntry({ isFirstStop: true, pickupType: 1, departureMinutes: 540 });
  const middlePt0 = makeEntry({ pickupType: 0, departureMinutes: 600 });
  const middlePt2 = makeEntry({ pickupType: 2, departureMinutes: 660 });
  const terminalPt0 = makeEntry({ isLastStop: true, pickupType: 0, departureMinutes: 720 });
  const entries = [originPt0, originPt1, middlePt0, middlePt2, terminalPt0];

  describe('identity / fast-path', () => {
    it('returns the input reference unchanged when both toggles are false', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showFirstStopOnly: false,
        showBoardableOnly: false,
      });
      expect(result).toBe(entries);
    });
  });

  describe('showOriginOnly only', () => {
    it('keeps origin entries (boardable AND non-boardable origins)', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showFirstStopOnly: true,
        showBoardableOnly: false,
      });
      expect(result).toEqual([originPt0, originPt1]);
    });
  });

  describe('showBoardableOnly only', () => {
    it('keeps pickup_type=0/2/3 entries at non-pure-terminal positions', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showFirstStopOnly: false,
        showBoardableOnly: true,
      });
      // originPt0 (origin, pt=0): kept
      // originPt1 (origin, pt=1): excluded by pickUpState (noPickupAvailable)
      // middlePt0 (middle, pt=0): kept
      // middlePt2 (middle, pt=2): kept (mustPhoneAgency -- boarding is possible)
      // terminalPt0 (pure terminal, pt=0): excluded by position
      expect(result).toEqual([originPt0, middlePt0, middlePt2]);
    });
  });

  describe('both toggles on (AND composition)', () => {
    it('keeps only origin AND boardable entries', () => {
      const result = applyStopEventAttributeToggles(entries, {
        showFirstStopOnly: true,
        showBoardableOnly: true,
      });
      // originPt0 alone matches: isFirstStop=true AND pickup_type=0
      expect(result).toEqual([originPt0]);
    });
  });

  describe('generic preservation', () => {
    it('preserves the input element type at the type level', () => {
      const contextual: ContextualTimetableEntry[] = [
        { ...makeEntry({ isFirstStop: true, pickupType: 0 }), serviceDate: new Date(2026, 3, 30) },
        { ...makeEntry({ pickupType: 1 }), serviceDate: new Date(2026, 3, 30) },
      ];
      const filtered: ContextualTimetableEntry[] = applyStopEventAttributeToggles(contextual, {
        showFirstStopOnly: true,
        showBoardableOnly: false,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].serviceDate.getTime()).toBe(contextual[0].serviceDate.getTime());
    });
  });
});

// ---------------------------------------------------------------------------
// matchesBoardability
// ---------------------------------------------------------------------------

describe('matchesBoardability', () => {
  // boardable: pickup_type=0, middle stop (isDeparture === true)
  const boardable = makeEntry({ pickupType: 0, isFirstStop: false, isLastStop: false });
  // not-boardable: last stop (isDeparture === false regardless of pickup signal)
  const notBoardable = makeEntry({ pickupType: 0, isLastStop: true });

  it('empty set -> false for boardable entry', () => {
    expect(matchesBoardability(boardable, new Set())).toBe(false);
  });

  it('empty set -> false for not-boardable entry', () => {
    expect(matchesBoardability(notBoardable, new Set())).toBe(false);
  });

  it("Set(['bordable']) -> true for boardable entry", () => {
    expect(matchesBoardability(boardable, new Set(['bordable']))).toBe(true);
  });

  it("Set(['bordable']) -> false for not-boardable entry", () => {
    expect(matchesBoardability(notBoardable, new Set(['bordable']))).toBe(false);
  });

  it("Set(['notBoardable']) -> false for boardable entry", () => {
    expect(matchesBoardability(boardable, new Set(['notBoardable']))).toBe(false);
  });

  it("Set(['notBoardable']) -> true for not-boardable entry", () => {
    expect(matchesBoardability(notBoardable, new Set(['notBoardable']))).toBe(true);
  });

  it("Set(['bordable', 'notBoardable']) -> true for boardable entry", () => {
    expect(matchesBoardability(boardable, new Set(['bordable', 'notBoardable']))).toBe(true);
  });

  it("Set(['bordable', 'notBoardable']) -> true for not-boardable entry", () => {
    expect(matchesBoardability(notBoardable, new Set(['bordable', 'notBoardable']))).toBe(true);
  });
});
