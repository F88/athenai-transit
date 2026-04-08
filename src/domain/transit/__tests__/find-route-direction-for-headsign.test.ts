import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { StopServiceType, TimetableEntry } from '../../../types/app/transit-composed';
import { findRouteDirectionForHeadsign } from '../find-route-direction-for-headsign';

function makeRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'routeA',
    route_short_name: 'A',
    route_short_names: {},
    route_long_name: 'Route A',
    route_long_names: {},
    route_type: 3,
    route_color: '00377E',
    route_text_color: 'FFFFFF',
    agency_id: 'agencyA',
    ...overrides,
  };
}

function makeEntry(options: {
  tripHeadsign: string;
  stopHeadsign?: string;
  departureMinutes?: number;
}): TimetableEntry {
  return {
    routeDirection: {
      route: makeRoute(),
      tripHeadsign: { name: options.tripHeadsign, names: {} },
      ...(options.stopHeadsign !== undefined
        ? {
            stopHeadsign: {
              name: options.stopHeadsign,
              names: {},
            },
          }
        : {}),
    },
    schedule: {
      departureMinutes: options.departureMinutes ?? 600,
      arrivalMinutes: options.departureMinutes ?? 600,
    },
    boarding: {
      pickupType: 0 as StopServiceType,
      dropOffType: 0 as StopServiceType,
    },
    patternPosition: {
      stopIndex: 0,
      totalStops: 1,
      isOrigin: false,
      isTerminal: false,
    },
  };
}

describe('findRouteDirectionForHeadsign', () => {
  it('prefers an entry whose stop_headsign matches the selected raw headsign', () => {
    const tripMatch = makeEntry({ tripHeadsign: 'A', departureMinutes: 600 });
    const stopMatch = makeEntry({
      tripHeadsign: 'Local A',
      stopHeadsign: 'A',
      departureMinutes: 605,
    });

    const result = findRouteDirectionForHeadsign([tripMatch, stopMatch], 'A');

    expect(result?.stopHeadsign?.name).toBe('A');
    expect(result?.tripHeadsign.name).toBe('Local A');
  });

  it('falls back to a trip_headsign match when no stop_headsign matches', () => {
    const result = findRouteDirectionForHeadsign(
      [makeEntry({ tripHeadsign: 'A' }), makeEntry({ tripHeadsign: 'B' })],
      'A',
    );

    expect(result?.tripHeadsign.name).toBe('A');
  });

  it('falls back to the first entry when no raw source matches', () => {
    const firstEntry = makeEntry({ tripHeadsign: 'A' });
    const secondEntry = makeEntry({ tripHeadsign: 'B' });

    const result = findRouteDirectionForHeadsign([firstEntry, secondEntry], 'C');

    expect(result).toBe(firstEntry.routeDirection);
  });

  it('returns undefined for an empty entry list', () => {
    expect(findRouteDirectionForHeadsign([], 'A')).toBeUndefined();
  });
});
