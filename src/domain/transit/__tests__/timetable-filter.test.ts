import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import { prepareStopTimetable, prepareRouteHeadsignTimetable } from '../timetable-filter';

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
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: 0,
      totalStops: 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: false,
    },
  };
}

// ---------------------------------------------------------------------------
// prepareStopTimetable
// ---------------------------------------------------------------------------

describe('prepareStopTimetable', () => {
  it('returns all entries when includeTerminals is true', () => {
    const entries = [makeEntry(), makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
    const result = prepareStopTimetable(entries, true);
    expect(result.entries).toHaveLength(3);
    expect(result.omitted.terminal).toBe(0);
  });

  it('filters terminal entries when includeTerminals is false', () => {
    const entries = [makeEntry(), makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
    const result = prepareStopTimetable(entries, false);
    expect(result.entries).toHaveLength(1);
    expect(result.omitted.terminal).toBe(2);
  });

  it('returns accurate omitted.terminal count', () => {
    const entries = [
      makeEntry(),
      makeEntry(),
      makeEntry({ isTerminal: true }),
      makeEntry(),
      makeEntry({ isTerminal: true }),
      makeEntry({ isTerminal: true }),
    ];
    const result = prepareStopTimetable(entries, false);
    expect(result.entries).toHaveLength(3);
    expect(result.omitted.terminal).toBe(3);
  });

  it('handles empty array', () => {
    const result = prepareStopTimetable([], false);
    expect(result.entries).toHaveLength(0);
    expect(result.omitted.terminal).toBe(0);
  });

  it('handles all-terminal entries', () => {
    const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
    const result = prepareStopTimetable(entries, false);
    expect(result.entries).toHaveLength(0);
    expect(result.omitted.terminal).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// prepareRouteHeadsignTimetable
// ---------------------------------------------------------------------------

describe('prepareRouteHeadsignTimetable', () => {
  it('returns only entries matching route+headsign', () => {
    const entries = [
      makeEntry({ route: routeA, headsign: 'North' }),
      makeEntry({ route: routeA, headsign: 'South' }),
      makeEntry({ route: routeB, headsign: 'North' }),
    ];
    const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].routeDirection.headsign).toBe('North');
    expect(result.omitted.terminal).toBe(0);
  });

  it('computes omitted scoped to route+headsign, not entire stop', () => {
    const entries = [
      // routeA North: 2 normal + 1 terminal
      makeEntry({ route: routeA, headsign: 'North' }),
      makeEntry({ route: routeA, headsign: 'North' }),
      makeEntry({ route: routeA, headsign: 'North', isTerminal: true }),
      // routeB North: 3 terminal (should NOT appear in routeA's omitted)
      makeEntry({ route: routeB, headsign: 'North', isTerminal: true }),
      makeEntry({ route: routeB, headsign: 'North', isTerminal: true }),
      makeEntry({ route: routeB, headsign: 'North', isTerminal: true }),
    ];
    const result = prepareRouteHeadsignTimetable(entries, 'routeA', 'North', false);
    expect(result.entries).toHaveLength(2);
    // Only 1 terminal from routeA North, not 4 (1 + 3 from routeB)
    expect(result.omitted.terminal).toBe(1);
  });

  it('returns empty when no entries match', () => {
    const entries = [makeEntry({ route: routeA, headsign: 'North' })];
    const result = prepareRouteHeadsignTimetable(entries, 'routeB', 'South', false);
    expect(result.entries).toHaveLength(0);
    expect(result.omitted.terminal).toBe(0);
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

  it('handles empty array', () => {
    const result = prepareRouteHeadsignTimetable([], 'routeA', 'North', false);
    expect(result.entries).toHaveLength(0);
    expect(result.omitted.terminal).toBe(0);
  });
});
