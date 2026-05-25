import { describe, expect, it } from 'vitest';

import type { AppRouteTypeValue } from '../../../types/app/transit';
import type { ContextualTimetableEntry, StopWithContext } from '../../../types/app/transit-composed';
import { deriveFilteredNearbyStops } from '../derive-filtered-nearby-stops';

function makeEntry(
  overrides: {
    isOrigin?: boolean;
    isTerminal?: boolean;
    pickupType?: 0 | 1 | 2 | 3;
  } = {},
): ContextualTimetableEntry {
  return {
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: {
        route_id: 'route-1',
        route_type: 3,
        agency_id: 'agency-1',
        route_short_name: '1',
        route_short_names: {},
        route_long_name: 'Route 1',
        route_long_names: {},
        route_color: '000000',
        route_text_color: 'FFFFFF',
      },
      tripHeadsign: { name: 'Terminal', names: {} },
    },
    boarding: { pickupType: overrides.pickupType ?? 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: 0,
      totalStops: 3,
      isOrigin: overrides.isOrigin ?? false,
      isTerminal: overrides.isTerminal ?? false,
    },
    tripLocator: { patternId: 'pattern-1', serviceId: 'svc-1', tripIndex: 0 },
    serviceDate: new Date('2026-01-01'),
  } as ContextualTimetableEntry;
}

function makeStopWithContext(
  stopId: string,
  routeTypes: AppRouteTypeValue[],
  stopTimes: ContextualTimetableEntry[],
): StopWithContext {
  return {
    stop: {
      stop_id: stopId,
      stop_name: stopId,
      stop_names: {},
      stop_lat: 35,
      stop_lon: 139,
      agency_id: 'agency-1',
      // The narrow type asserts the rest as well; cast keeps the test
      // setup short while still exercising the selector.
    } as StopWithContext['stop'],
    routeTypes,
    stopTimes,
    stopServiceState: stopTimes.length === 0 ? 'no-service' : 'boardable',
    agencies: [],
    routes: [],
  };
}

const ENABLED_BUS: ReadonlySet<number> = new Set([3]);
const ENABLED_BUS_TRAIN: ReadonlySet<number> = new Set([3, 2]);
const ENABLED_SUBWAY: ReadonlySet<number> = new Set([1]);

describe('deriveFilteredNearbyStops', () => {
  it('returns empty result for empty input', () => {
    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered).toEqual([]);
    expect(result.timetableEntriesStateByStopId.size).toBe(0);
    expect(result.rawCounts).toEqual({ total: 0, nonEmpty: 0, originCount: 0, boardableCount: 0 });
    expect(result.filteredCounts).toEqual({
      total: 0,
      nonEmpty: 0,
      originCount: 0,
      boardableCount: 0,
    });
  });

  it('drops stops whose routeTypes do not intersect with enabledRouteTypes', () => {
    const busStop = makeStopWithContext('bus', [3], [makeEntry()]);
    const subwayStop = makeStopWithContext('subway', [1], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [busStop, subwayStop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].stop.stop_id).toBe('bus');
    expect(result.timetableEntriesStateByStopId.has('bus')).toBe(true);
    expect(result.timetableEntriesStateByStopId.has('subway')).toBe(false);
    expect(result.rawCounts.total).toBe(1);
    expect(result.filteredCounts.total).toBe(1);
  });

  it('keeps a stop when any of its routeTypes is enabled', () => {
    // Multi-modal stop: bus + train. Enabling only train still keeps
    // the stop because `some` is the matching rule.
    const multiModalStop = makeStopWithContext('hub', [3, 2], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [multiModalStop],
      enabledRouteTypes: new Set([2]),
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].stop.stop_id).toBe('hub');
  });

  it('builds timetableEntriesStateByStopId from the pre-globalFilter (route-type-filtered) list', () => {
    // Origin-only filter would hide everything for this stop, but the
    // state map must still reflect the pre-globalFilter state so the
    // UI can distinguish "filter-hidden" from "no-service".
    const stop = makeStopWithContext('s', [3], [makeEntry({ isOrigin: false, pickupType: 0 })]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [stop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: true,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.timetableEntriesStateByStopId.get('s')).toBe('boardable');
    // But the filtered list is empty (no origin entries after the toggle).
    expect(result.filtered[0].stopTimes).toHaveLength(0);
  });

  it('narrows entries with showOriginOnly while keeping the stop in the list', () => {
    const stop = makeStopWithContext(
      's',
      [3],
      [makeEntry({ isOrigin: true, pickupType: 0 }), makeEntry({ isOrigin: false, pickupType: 0 })],
    );

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [stop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: true,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].stopTimes).toHaveLength(1);
    expect(result.filtered[0].stopTimes[0].patternPosition.isOrigin).toBe(true);
  });

  it('narrows entries with showBoardableOnly by pickup type and pattern position', () => {
    const stop = makeStopWithContext(
      's',
      [3],
      [
        makeEntry({ isOrigin: false, isTerminal: false, pickupType: 0 }), // boardable middle
        makeEntry({ isOrigin: false, isTerminal: true, pickupType: 0 }), // pure terminal — drops
        makeEntry({ isOrigin: true, pickupType: 1 }), // non-boardable origin — drops
      ],
    );

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [stop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: true,
      omitEmptyStops: false,
    });

    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].stopTimes).toHaveLength(1);
  });

  it('omits stops whose stopTimes become empty when omitEmptyStops is true', () => {
    const emptyStop = makeStopWithContext('empty', [3], []);
    const populatedStop = makeStopWithContext('full', [3], [makeEntry({ pickupType: 0 })]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [emptyStop, populatedStop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: true,
    });

    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].stop.stop_id).toBe('full');
    // rawCounts still sees both — it's pre-omit.
    expect(result.rawCounts.total).toBe(2);
    expect(result.filteredCounts.total).toBe(1);
  });

  it('keeps empty-stopTimes stops when omitEmptyStops is false', () => {
    const emptyStop = makeStopWithContext('empty', [3], []);
    const populatedStop = makeStopWithContext('full', [3], [makeEntry({ pickupType: 0 })]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [emptyStop, populatedStop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered).toHaveLength(2);
    expect(result.filtered.map((s) => s.stop.stop_id)).toEqual(['empty', 'full']);
  });

  it('reports rawCounts pre-globalFilter and filteredCounts post-globalFilter', () => {
    const originBoardable = makeStopWithContext(
      'origin',
      [3],
      [makeEntry({ isOrigin: true, pickupType: 0 })],
    );
    const middleBoardable = makeStopWithContext(
      'middle',
      [3],
      [makeEntry({ isOrigin: false, pickupType: 0 })],
    );

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [originBoardable, middleBoardable],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: true,
      showBoardableOnly: false,
      omitEmptyStops: true,
    });

    // rawCounts: both stops counted, route-type filter only.
    expect(result.rawCounts.total).toBe(2);
    expect(result.rawCounts.originCount).toBe(1);
    // filteredCounts: only the origin stop survives the globalFilter + omit.
    expect(result.filteredCounts.total).toBe(1);
    expect(result.filteredCounts.originCount).toBe(1);
  });

  it('returns no-service state for stops with empty stopTimes pre-filter', () => {
    const emptyStop = makeStopWithContext('empty', [3], []);
    const populatedStop = makeStopWithContext('full', [3], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [emptyStop, populatedStop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.timetableEntriesStateByStopId.get('empty')).toBe('no-service');
    expect(result.timetableEntriesStateByStopId.get('full')).toBe('boardable');
  });

  it('preserves input order through the filter pipeline', () => {
    const a = makeStopWithContext('a', [3], [makeEntry()]);
    const b = makeStopWithContext('b', [2], [makeEntry()]);
    const c = makeStopWithContext('c', [3], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [a, b, c],
      enabledRouteTypes: ENABLED_BUS_TRAIN,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered.map((s) => s.stop.stop_id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty result when no route type is enabled', () => {
    const stop = makeStopWithContext('s', [3], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [stop],
      enabledRouteTypes: ENABLED_SUBWAY,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered).toEqual([]);
    expect(result.timetableEntriesStateByStopId.size).toBe(0);
    expect(result.rawCounts.total).toBe(0);
    expect(result.filteredCounts.total).toBe(0);
  });

  it('returns the same stops list reference when no filter touches it', () => {
    // When all globalFilter toggles are off and omitEmptyStops is false,
    // applyStopEventAttributeTogglesToStops returns its input unchanged,
    // so `filtered` should be the route-type-filtered slice directly.
    // The element references themselves must be preserved.
    const stop = makeStopWithContext('s', [3], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [stop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered[0]).toBe(stop);
  });
});
