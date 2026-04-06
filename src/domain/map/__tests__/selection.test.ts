import { describe, expect, it } from 'vitest';
import {
  buildTimetableEntriesMap,
  extractRouteIdsForStop,
  getRouteIdsForStop,
  resolveSelectedRouteIds,
} from '../selection';
import type { ContextualTimetableEntry, TimetableEntry } from '../../../types/app/transit-composed';
import { makeRoute, makeStop, makeStopWithContext } from '../../../__tests__/helpers';

function makeEntries(routeIds: string[]): ContextualTimetableEntry[] {
  return routeIds.map((id) => ({
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: makeRoute(id),
      tripHeadsign: { name: '', names: {} },
    },
    boarding: { pickupType: 0 as const, dropOffType: 0 as const },
    patternPosition: { stopIndex: 0, totalStops: 1, isTerminal: false, isOrigin: false },
    serviceDate: new Date('2026-01-01'),
  }));
}

describe('extractRouteIdsForStop', () => {
  it('returns empty set when stop is not in departures', () => {
    expect(extractRouteIdsForStop([], 'unknown')).toEqual(new Set());
  });

  it('extracts route IDs from departures', () => {
    const ctx = makeStopWithContext(makeStop('s1'), ['r1', 'r2']);
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1', 'r2']));
  });

  it('falls back to StopWithMeta.routes when departures are empty', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      departures: [] as ContextualTimetableEntry[],
      isBoardableOnServiceDay: true,
      agencies: [],
      routes: [makeRoute('r1'), makeRoute('r2')],
    };
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1', 'r2']));
  });

  it('returns empty set when both departures and routes are empty', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      departures: [] as ContextualTimetableEntry[],
      isBoardableOnServiceDay: false,
      agencies: [],
      routes: [],
    };
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set());
  });

  it('prefers departures over routes when both are available', () => {
    const stop = makeStop('s1');
    const ctx = {
      stop,
      routeTypes: [3 as const],
      departures: makeEntries(['r1']),
      isBoardableOnServiceDay: true,
      agencies: [],
      routes: [makeRoute('r1'), makeRoute('r2'), makeRoute('r3')],
    };
    expect(extractRouteIdsForStop([ctx], 's1')).toEqual(new Set(['r1']));
  });
});

describe('getRouteIdsForStop', () => {
  it('returns null when stopId is null', () => {
    const map = new Map<string, TimetableEntry[]>();
    expect(getRouteIdsForStop(null, map)).toBeNull();
  });

  it('returns null when stopId is not in map', () => {
    const map = new Map<string, TimetableEntry[]>();
    expect(getRouteIdsForStop('unknown-stop', map)).toBeNull();
  });

  it('returns null when entries are empty', () => {
    const map = new Map<string, TimetableEntry[]>([['stop-1', []]]);
    expect(getRouteIdsForStop('stop-1', map)).toBeNull();
  });

  it('returns a Set of route IDs for a stop with departures', () => {
    const map = new Map<string, TimetableEntry[]>([
      ['stop-1', makeEntries(['route-A', 'route-B', 'route-C'])],
    ]);
    const result = getRouteIdsForStop('stop-1', map);
    expect(result).toEqual(new Set(['route-A', 'route-B', 'route-C']));
  });
});

describe('buildTimetableEntriesMap', () => {
  it('returns an empty map for an empty array', () => {
    expect(buildTimetableEntriesMap([])).toEqual(new Map());
  });

  it('builds a map keyed by stop_id with entries as values', () => {
    const a = makeStopWithContext(makeStop('stop-a'), ['r1']);
    const b = makeStopWithContext(makeStop('stop-b'), ['r2']);
    const result = buildTimetableEntriesMap([a, b]);
    expect(result.size).toBe(2);
    expect(result.get('stop-a')).toBe(a.departures);
    expect(result.get('stop-b')).toBe(b.departures);
  });

  it('last entry wins when duplicate stop IDs exist', () => {
    const first = makeStopWithContext(makeStop('dup'), ['r1']);
    const second = makeStopWithContext(makeStop('dup'), ['r2']);
    const result = buildTimetableEntriesMap([first, second]);
    expect(result.size).toBe(1);
    expect(result.get('dup')).toBe(second.departures);
  });
});

describe('resolveSelectedRouteIds', () => {
  it('returns a Set with the route ID when selectedRouteId is provided', () => {
    const map = new Map<string, TimetableEntry[]>();
    const result = resolveSelectedRouteIds('route-X', null, map);
    expect(result).toEqual(new Set(['route-X']));
  });

  it('prioritizes selectedRouteId over selectedStopId', () => {
    const map = new Map<string, TimetableEntry[]>([
      ['stop-1', makeEntries(['route-A', 'route-B'])],
    ]);
    const result = resolveSelectedRouteIds('route-X', 'stop-1', map);
    expect(result).toEqual(new Set(['route-X']));
  });

  it('delegates to getRouteIdsForStop when selectedRouteId is null', () => {
    const map = new Map<string, TimetableEntry[]>([
      ['stop-1', makeEntries(['route-A', 'route-B'])],
    ]);
    const result = resolveSelectedRouteIds(null, 'stop-1', map);
    expect(result).toEqual(new Set(['route-A', 'route-B']));
  });

  it('returns null when both selectedRouteId and selectedStopId are null', () => {
    const map = new Map<string, TimetableEntry[]>();
    expect(resolveSelectedRouteIds(null, null, map)).toBeNull();
  });
});
