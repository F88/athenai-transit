/**
 * Shared test fixture: build a real {@link TimetableEntry} with the given
 * boarding / position / schedule overrides (sensible mid-route defaults).
 *
 * Used by the timetable-entry-boarding / timetable-entry-schedule /
 * timetable-service-state test files.
 */

import type { TimetableEntry } from '../../../types/app/transit-composed';
import type { Route } from '../../../types/app/transit';

export const testRoute: Route = {
  route_id: 'r1',
  route_short_name: '都01',
  route_short_names: {},
  route_long_name: 'Test Route',
  route_long_names: {},
  route_type: 3,
  route_color: '2E7D32',
  route_text_color: 'FFFFFF',
  agency_id: 'test:agency',
};

export function makeEntry(
  overrides: {
    departureMinutes?: number;
    arrivalMinutes?: number;
    pickupType?: 0 | 1 | 2 | 3;
    dropOffType?: 0 | 1 | 2 | 3;
    isTerminal?: boolean;
    isOrigin?: boolean;
    stopIndex?: number;
    totalStops?: number;
    remainingMinutes?: number;
    route?: Route;
    headsign?: string;
  } = {},
): TimetableEntry {
  const route = overrides.route ?? testRoute;
  const headsign = overrides.headsign ?? 'Test Terminal';
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes ?? 480,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes ?? 480,
    },
    routeDirection: {
      route,
      tripHeadsign: { name: headsign, names: {} },
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 5,
      totalStops: overrides.totalStops ?? 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    insights:
      overrides.remainingMinutes !== undefined
        ? { remainingMinutes: overrides.remainingMinutes, totalMinutes: 0, freq: 0 }
        : undefined,
    tripLocator: { patternId: `${route.route_id}__${headsign}`, serviceId: 'test', tripIndex: 0 },
  };
}
