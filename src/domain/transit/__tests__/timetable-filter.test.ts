import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import { prepareStopTimetable, prepareRouteHeadsignTimetable } from '../timetable-filter';

// --- Test fixtures ---

const routeA: Route = {
  route_id: 'routeA',
  route_short_name: 'A',
  route_long_name: 'Route A',
  route_names: {},
  route_type: 3,
  route_color: '000000',
  route_text_color: 'FFFFFF',
  agency_id: 'test',
};

const routeB: Route = {
  route_id: 'routeB',
  route_short_name: 'B',
  route_long_name: 'Route B',
  route_names: {},
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
  } = {},
): TimetableEntry {
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes ?? 480,
      arrivalMinutes: overrides.departureMinutes ?? 480,
    },
    routeDirection: {
      route: overrides.route ?? routeA,
      headsign: overrides.headsign ?? 'Terminal',
      headsign_names: {},
    },
    boarding: { pickupType: overrides.pickupType ?? 0, dropOffType: overrides.dropOffType ?? 0 },
    patternPosition: {
      stopIndex: 0,
      totalStops: 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
  };
}

// ---------------------------------------------------------------------------
// prepareStopTimetable
// ---------------------------------------------------------------------------

describe('prepareStopTimetable', () => {
  describe('includeTerminals = true (detailed/verbose)', () => {
    it('returns all entries including terminals', () => {
      const entries = [
        makeEntry(),
        makeEntry({ isTerminal: true }),
        makeEntry({ isTerminal: true }),
      ];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.terminal).toBe(0);
    });

    it('returns all entries when none are terminal', () => {
      const entries = [makeEntry(), makeEntry(), makeEntry()];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.terminal).toBe(0);
    });

    it('returns all entries when all are terminal (drop-off only stop)', () => {
      const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.terminal).toBe(0);
    });
  });

  describe('includeTerminals = false (simple/normal)', () => {
    it('filters out terminal entries', () => {
      const entries = [
        makeEntry(),
        makeEntry({ isTerminal: true }),
        makeEntry({ isTerminal: true }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.terminal).toBe(2);
    });

    it('returns all entries when none are terminal', () => {
      const entries = [makeEntry(), makeEntry(), makeEntry()];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(3);
      expect(result.omitted.terminal).toBe(0);
    });

    it('returns empty when all are terminal (drop-off only stop)', () => {
      const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.terminal).toBe(2);
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
      expect(result.omitted.terminal).toBe(2);
    });
  });

  describe('invariant: entries.length + omitted.terminal = input.length', () => {
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
      expect(result.entries.length + result.omitted.terminal).toBe(entries.length);
    });

    it('holds when includeTerminals is true', () => {
      const entries = [makeEntry(), makeEntry({ isTerminal: true })];
      const result = prepareStopTimetable(entries, true);
      expect(result.entries.length + result.omitted.terminal).toBe(entries.length);
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      const result = prepareStopTimetable([], false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.terminal).toBe(0);
    });

    it('handles single non-terminal entry', () => {
      const result = prepareStopTimetable([makeEntry()], false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.terminal).toBe(0);
    });

    it('handles single terminal entry', () => {
      const result = prepareStopTimetable([makeEntry({ isTerminal: true })], false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.terminal).toBe(1);
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

    it('is not affected by boarding pickupType/dropOffType values', () => {
      // This function filters by isTerminal only, not by boarding types.
      // Entries with pickupType 2/3 (phone/coordinate) are not filtered.
      const entries = [
        makeEntry({ pickupType: 0 }),
        makeEntry({ pickupType: 1 }),
        makeEntry({ pickupType: 2 }),
        makeEntry({ pickupType: 3 }),
        makeEntry({ dropOffType: 1 }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(5);
      expect(result.omitted.terminal).toBe(0);
    });

    it('is not affected by isOrigin (only isTerminal matters)', () => {
      // isOrigin: true entries are kept — only isTerminal triggers removal.
      const entries = [
        makeEntry({ isOrigin: true }),
        makeEntry({ isOrigin: true, isTerminal: true }),
        makeEntry({ isOrigin: false }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.terminal).toBe(1);
    });

    it('filter criterion is isTerminal only, not boarding (mixed scenario)', () => {
      // terminal + pickupType=0: removed (terminal wins)
      // non-terminal + pickupType=1: kept (boarding does not affect filter)
      const entries = [
        makeEntry({ isTerminal: true, pickupType: 0 }),
        makeEntry({ isTerminal: false, pickupType: 1 }),
      ];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].boarding.pickupType).toBe(1);
      expect(result.omitted.terminal).toBe(1);
    });

    it('circular route: isTerminal && isOrigin both true → filtered out', () => {
      // Circular routes have the same stop as both origin and terminal.
      // isTerminal should win and the entry should be removed.
      const entries = [makeEntry({ isTerminal: true, isOrigin: true }), makeEntry()];
      const result = prepareStopTimetable(entries, false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.terminal).toBe(1);
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
      expect(result.entries[0].routeDirection.headsign).toBe('North');
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
      expect(result.entries[0].routeDirection.headsign).toBe('');
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
      expect(result.omitted.terminal).toBe(1);
    });

    it('includes terminals when includeTerminals is true', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries).toHaveLength(2);
      expect(result.omitted.terminal).toBe(0);
    });

    it('returns empty when all matching entries are terminal', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.terminal).toBe(2);
    });
  });

  describe('omitted scoping (PR #62 issue #5)', () => {
    it('omitted.terminal does not include other routes terminals', () => {
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
      expect(result.omitted.terminal).toBe(1); // not 4
    });

    it('omitted.terminal does not include other headsigns terminals', () => {
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
      expect(result.omitted.terminal).toBe(0);
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
        // 京王バス route1: boardable (departures)
        ...Array.from({ length: 2 }, () => makeEntry({ route: routeA, headsign: 'Nakano' })),
      ];
      // Route A Shinjuku: all 5 are terminal
      const resultA = prepareRouteHeadsignTimetable(entries, 'routeA', 'Shinjuku', false);
      expect(resultA.entries).toHaveLength(0);
      expect(resultA.omitted.terminal).toBe(5); // not 8 (5+3)

      // Route A Nakano: no terminals
      const resultB = prepareRouteHeadsignTimetable(entries, 'routeA', 'Nakano', false);
      expect(resultB.entries).toHaveLength(2);
      expect(resultB.omitted.terminal).toBe(0);
    });
  });

  describe('invariant: entries.length + omitted.terminal = matching entries count', () => {
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
          e.routeDirection.route.route_id === 'routeA' && e.routeDirection.headsign === 'North',
      ).length;
      expect(result.entries.length + result.omitted.terminal).toBe(totalMatching);
    });

    it('holds when includeTerminals is true', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North' }),
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
      expect(result.entries.length + result.omitted.terminal).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      const result = prepareRouteHeadsignTimetable([], 'routeA', 'North', false);
      expect(result.entries).toHaveLength(0);
      expect(result.omitted.terminal).toBe(0);
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

    it('is not affected by boarding pickupType/dropOffType values', () => {
      // Filtering is by isTerminal and route+headsign only, not boarding types.
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', pickupType: 0 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 1 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 2 }),
        makeEntry({ route: routeA, headsign: 'North', pickupType: 3 }),
        makeEntry({ route: routeA, headsign: 'North', dropOffType: 1 }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(5);
      expect(result.omitted.terminal).toBe(0);
    });

    it('is not affected by isOrigin (only isTerminal matters)', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isOrigin: true }),
        makeEntry({ route: routeA, headsign: 'North', isOrigin: true, isTerminal: true }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.terminal).toBe(1);
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
      expect(result.omitted.terminal).toBe(0); // not 100
    });

    it('circular route: isTerminal && isOrigin both true → filtered out', () => {
      const entries = [
        makeEntry({ route: routeA, headsign: 'North', isTerminal: true, isOrigin: true }),
        makeEntry({ route: routeA, headsign: 'North' }),
      ];
      const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
      expect(result.entries).toHaveLength(1);
      expect(result.omitted.terminal).toBe(1);
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
