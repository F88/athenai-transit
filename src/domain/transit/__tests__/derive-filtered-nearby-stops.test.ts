import { describe, expect, it } from 'vitest';

import type { AppRouteTypeValue } from '../../../types/app/transit';
import type {
  ContextualTimetableEntry,
  StopWithContext,
} from '../../../types/app/transit-composed';
import { deriveFilteredNearbyStops } from '../derive-filtered-nearby-stops';

function makeEntry(
  overrides: {
    isFirstStop?: boolean;
    isLastStop?: boolean;
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
      isFirstStop: overrides.isFirstStop ?? false,
      isLastStop: overrides.isLastStop ?? false,
    },
    tripLocator: { patternId: 'pattern-1', serviceId: 'svc-1', tripIndex: 0 },
    serviceDate: new Date('2026-01-01'),
  };
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
    const stop = makeStopWithContext('s', [3], [makeEntry({ isFirstStop: false, pickupType: 0 })]);

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
      [
        makeEntry({ isFirstStop: true, pickupType: 0 }),
        makeEntry({ isFirstStop: false, pickupType: 0 }),
      ],
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
    expect(result.filtered[0].stopTimes[0].patternPosition.isFirstStop).toBe(true);
  });

  it('narrows entries with showBoardableOnly by pickup type and pattern position', () => {
    const stop = makeStopWithContext(
      's',
      [3],
      [
        makeEntry({ isFirstStop: false, isLastStop: false, pickupType: 0 }), // boardable middle
        makeEntry({ isFirstStop: false, isLastStop: true, pickupType: 0 }), // pure terminal -- drops
        makeEntry({ isFirstStop: true, pickupType: 1 }), // non-boardable origin -- drops
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

  it('narrows entries to the intersection (origin AND boardable) when both toggles are on', () => {
    // filterTimetableEntries applies each toggle as a separate
    // narrowing step, so the result is the AND of both. The selector
    // must propagate that intersection through to `filtered` and have
    // `filteredCounts` reflect the post-AND tally.
    const stop = makeStopWithContext(
      's',
      [3],
      [
        // (a) origin + boardable middle-style -> KEEP
        makeEntry({ isFirstStop: true, isLastStop: false, pickupType: 0 }),
        // (b) origin + non-boardable -> drops (boardable filter)
        makeEntry({ isFirstStop: true, isLastStop: false, pickupType: 1 }),
        // (c) middle + boardable -> drops (origin filter)
        makeEntry({ isFirstStop: false, isLastStop: false, pickupType: 0 }),
        // (d) terminal + boardable -> drops (origin filter; isFirstStop=false)
        makeEntry({ isFirstStop: false, isLastStop: true, pickupType: 0 }),
      ],
    );

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [stop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: true,
      showBoardableOnly: true,
      omitEmptyStops: false,
    });

    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].stopTimes).toHaveLength(1);
    const survivor = result.filtered[0].stopTimes[0];
    expect(survivor.patternPosition.isFirstStop).toBe(true);
    expect(survivor.boarding.pickupType).toBe(0);

    // rawCounts is pre-globalFilter -- still sees the whole entry list
    // (1 stop, originCount=1 since the stop has at least one origin
    // entry, boardableCount=1 since at least one boardable entry exists).
    expect(result.rawCounts.total).toBe(1);
    expect(result.rawCounts.originCount).toBe(1);
    expect(result.rawCounts.boardableCount).toBe(1);

    // filteredCounts is post-globalFilter; still 1 stop because we did
    // not enable omitEmptyStops, and the remaining entry is both an
    // origin and boardable so all per-attribute counts are 1.
    expect(result.filteredCounts.total).toBe(1);
    expect(result.filteredCounts.originCount).toBe(1);
    expect(result.filteredCounts.boardableCount).toBe(1);
  });

  it('returns drop-off-only state when every pre-globalFilter entry is drop-off-only', () => {
    // Two drop-off-only entries via two different signals:
    //   - explicit pickupType=1
    //   - pattern inference (isLastStop=true), which the state helper
    //     also classifies as drop-off-only.
    const stop = makeStopWithContext(
      'dropoff',
      [3],
      [
        makeEntry({ isFirstStop: false, isLastStop: false, pickupType: 1 }),
        makeEntry({ isFirstStop: false, isLastStop: true, pickupType: 0 }),
      ],
    );

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [stop],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.timetableEntriesStateByStopId.get('dropoff')).toBe('drop-off-only');
  });

  it('produces a new stop object when toggles transform its stopTimes (does not mutate input)', () => {
    // With showOriginOnly on, `filterTimetableEntriesToStops`
    // produces a fresh outer object whose `stopTimes` is the narrowed
    // entry array. The wrapper must NOT be the same reference as the
    // input -- that would mean we mutated input -- but the inner `stop`
    // object should pass through by reference (we only swapped
    // stopTimes).
    const inputStopTimes = [
      makeEntry({ isFirstStop: true, pickupType: 0 }),
      makeEntry({ isFirstStop: false, pickupType: 0 }),
    ];
    const inputWrapper = makeStopWithContext('s', [3], inputStopTimes);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [inputWrapper],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: true,
      showBoardableOnly: false,
      omitEmptyStops: false,
    });

    expect(result.filtered[0]).not.toBe(inputWrapper);
    expect(result.filtered[0].stop).toBe(inputWrapper.stop);
    // The input must not have been mutated.
    expect(inputWrapper.stopTimes).toBe(inputStopTimes);
    expect(inputWrapper.stopTimes).toHaveLength(2);
  });

  it('reports every count field consistently across a realistic mixed-stop scenario', () => {
    // Five stops covering every classification the selector deals with:
    //   - dropped pre-filter (route type out of `enabledRouteTypes`)
    //   - origin + boardable
    //   - middle + boardable
    //   - drop-off-only (isLastStop=true) -> not boardable
    //   - empty stopTimes -> no service
    const subwayOnly = makeStopWithContext(
      'subway-only',
      [1],
      [makeEntry({ isFirstStop: true, pickupType: 0 })],
    );
    const originBoardable = makeStopWithContext(
      'origin-boardable',
      [3],
      [makeEntry({ isFirstStop: true, isLastStop: false, pickupType: 0 })],
    );
    const middleBoardable = makeStopWithContext(
      'middle-boardable',
      [3],
      [makeEntry({ isFirstStop: false, isLastStop: false, pickupType: 0 })],
    );
    const dropOffOnly = makeStopWithContext(
      'drop-off-only',
      [3],
      [makeEntry({ isFirstStop: false, isLastStop: true, pickupType: 0 })],
    );
    const noService = makeStopWithContext('no-service', [3], []);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [subwayOnly, originBoardable, middleBoardable, dropOffOnly, noService],
      enabledRouteTypes: ENABLED_BUS,
      showOriginOnly: false,
      showBoardableOnly: true,
      omitEmptyStops: true,
    });

    // rawCounts: post-routeType, pre-globalFilter. The subway-only
    // stop is dropped; the four bus stops remain. nonEmpty excludes
    // `no-service`. originCount counts only `origin-boardable`.
    // boardableCount counts stops with >=1 boardable entry: the two
    // boardable ones; `drop-off-only` and `no-service` are excluded.
    expect(result.rawCounts).toEqual({
      total: 4,
      nonEmpty: 3,
      originCount: 1,
      boardableCount: 2,
    });

    // filteredCounts: showBoardableOnly removes the entries inside
    // `drop-off-only`, which then becomes empty. omitEmptyStops then
    // drops both `drop-off-only` (newly empty) and `no-service`
    // (always empty). `origin-boardable` + `middle-boardable` remain.
    expect(result.filteredCounts).toEqual({
      total: 2,
      nonEmpty: 2,
      originCount: 1,
      boardableCount: 2,
    });

    // Filtered list reflects the same two stops in input order.
    expect(result.filtered.map((s) => s.stop.stop_id)).toEqual([
      'origin-boardable',
      'middle-boardable',
    ]);

    // State map snapshots the pre-globalFilter tier for all four
    // route-type-matched stops; subway-only must not appear.
    expect(result.timetableEntriesStateByStopId.has('subway-only')).toBe(false);
    expect(result.timetableEntriesStateByStopId.get('origin-boardable')).toBe('boardable');
    expect(result.timetableEntriesStateByStopId.get('middle-boardable')).toBe('boardable');
    expect(result.timetableEntriesStateByStopId.get('drop-off-only')).toBe('drop-off-only');
    expect(result.timetableEntriesStateByStopId.get('no-service')).toBe('no-service');
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
    // rawCounts still sees both -- it's pre-omit.
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
      [makeEntry({ isFirstStop: true, pickupType: 0 })],
    );
    const middleBoardable = makeStopWithContext(
      'middle',
      [3],
      [makeEntry({ isFirstStop: false, pickupType: 0 })],
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

  it('drops every stop when the entire input falls outside enabledRouteTypes', () => {
    // Operational scenario: the user opens an area where every nearby
    // stop is a non-bus mode (e.g. only subway / train stops near a
    // hub) while their settings have those modes off. Every stop must
    // disappear from filtered / counts / state map, and the result
    // shape must still be valid (empty Map, zeroed counts).
    const subwayStop = makeStopWithContext('subway', [1], [makeEntry()]);
    const trainStop = makeStopWithContext('train', [2], [makeEntry()]);
    const ferryStop = makeStopWithContext('ferry', [4], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [subwayStop, trainStop, ferryStop],
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

  it('drops every stop when enabledRouteTypes is an empty set', () => {
    // Operational scenario: the user has deselected every entry under
    // the route-type filter, so settings.visibleStopTypes is empty.
    // The selector must treat this as "nothing is enabled" rather than
    // "everything is enabled" -- `some()` over an empty set is false.
    const busStop = makeStopWithContext('bus', [3], [makeEntry()]);
    const subwayStop = makeStopWithContext('subway', [1], [makeEntry()]);

    const result = deriveFilteredNearbyStops({
      nearbyStopTimes: [busStop, subwayStop],
      enabledRouteTypes: new Set<number>(),
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

  it('returns the same stops list reference when no filter touches it', () => {
    // When all globalFilter toggles are off and omitEmptyStops is false,
    // filterTimetableEntriesToStops returns its input unchanged,
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
