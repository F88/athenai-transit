import { describe, expect, it } from 'vitest';
import { makeStop } from '../../../__tests__/helpers';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import type { StopHistoryEntry } from '../stop-history';
import { addToHistory, buildHistorySelectionStop, MAX_HISTORY_SIZE } from '../stop-history';
import { createStopReferenceSnapshot } from '../stop-reference-snapshot';

function makeEntry(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
  selectedAt = 1000,
): StopHistoryEntry {
  return {
    snapshot: { stopId: id, name: id, lat: 35, lon: 139, routeTypes, agencyNames: [] },
    selectedAt,
  };
}

describe('addToHistory', () => {
  it('adds a stop to empty history', () => {
    const stop = makeStop('A');
    const result = addToHistory([], createStopReferenceSnapshot(stop, [3]), 1000);

    expect(result).toHaveLength(1);
    expect(result[0].snapshot.stopId).toBe('A');
    expect(result[0].snapshot.name).toBe('Stop A');
    expect(result[0].snapshot.lat).toBe(stop.stop_lat);
    expect(result[0].snapshot.lon).toBe(stop.stop_lon);
    expect(result[0].snapshot.routeTypes).toEqual([3]);
    expect(result[0].snapshot.agencyNames).toEqual([]);
    expect(result[0].selectedAt).toBe(1000);
  });

  it('prepends new stop to front of history', () => {
    const existing = [makeEntry('A')];
    const result = addToHistory(existing, createStopReferenceSnapshot(makeStop('B'), [2]), 2000);

    expect(result).toHaveLength(2);
    expect(result[0].snapshot.stopId).toBe('B');
    expect(result[1].snapshot.stopId).toBe('A');
  });

  it('moves duplicate stop to front with updated timestamp', () => {
    const existing = [makeEntry('A', [3], 1000), makeEntry('B', [2], 900)];
    const result = addToHistory(existing, createStopReferenceSnapshot(makeStop('B'), [2]), 2000);

    expect(result).toHaveLength(2);
    expect(result[0].snapshot.stopId).toBe('B');
    expect(result[0].selectedAt).toBe(2000);
    expect(result[1].snapshot.stopId).toBe('A');
  });

  it('updates routeTypes when moving duplicate to front', () => {
    const existing = [makeEntry('A', [3], 1000)];
    const result = addToHistory(existing, createStopReferenceSnapshot(makeStop('A'), [0, 3]), 2000);

    expect(result).toHaveLength(1);
    expect(result[0].snapshot.routeTypes).toEqual([0, 3]);
  });

  it('caps history at MAX_HISTORY_SIZE', () => {
    const existing: StopHistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
      existing.push(makeEntry(`s${i}`, [3], i));
    }

    const result = addToHistory(existing, createStopReferenceSnapshot(makeStop('new'), [3]), 9999);

    expect(result).toHaveLength(MAX_HISTORY_SIZE);
    expect(result[0].snapshot.stopId).toBe('new');
    // Oldest entry (last in the original list) should be dropped
    expect(
      result.find((entry) => entry.snapshot.stopId === `s${MAX_HISTORY_SIZE - 1}`),
    ).toBeUndefined();
    // Earlier entries should still be present
    expect(result.find((entry) => entry.snapshot.stopId === 's0')).toBeDefined();
  });

  it('does not exceed MAX_HISTORY_SIZE when adding duplicate', () => {
    const existing: StopHistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
      existing.push(makeEntry(`s${i}`, [3], i));
    }

    // Re-add an existing stop — should not grow
    const result = addToHistory(existing, createStopReferenceSnapshot(makeStop('s5'), [3]), 9999);

    expect(result).toHaveLength(MAX_HISTORY_SIZE);
    expect(result[0].snapshot.stopId).toBe('s5');
  });

  it('does not mutate original history array', () => {
    const existing = [makeEntry('A')];
    const originalLength = existing.length;

    addToHistory(existing, createStopReferenceSnapshot(makeStop('B'), [3]), 2000);

    expect(existing).toHaveLength(originalLength);
  });

  it('handles multiple route types', () => {
    const result = addToHistory([], createStopReferenceSnapshot(makeStop('X'), [0, 1, 2, 3]), 1000);

    expect(result[0].snapshot.routeTypes).toEqual([0, 1, 2, 3]);
  });
});

describe('MAX_HISTORY_SIZE', () => {
  it('is 20', () => {
    expect(MAX_HISTORY_SIZE).toBe(20);
  });
});

describe('createStopReferenceSnapshot', () => {
  it('prefers translated stop names for plain Stop input when a language chain is provided', () => {
    const stop = {
      ...makeStop('A'),
      stop_name: '駅A',
      stop_names: { en: 'Station A' },
    };

    const result = createStopReferenceSnapshot(stop, [3], ['en']);

    expect(result).toEqual({
      stopId: 'A',
      name: 'Station A',
      lat: stop.stop_lat,
      lon: stop.stop_lon,
      routeTypes: [3],
      agencyNames: [],
      platformCode: undefined,
    });
  });

  it('preserves platform code in the stored snapshot', () => {
    const stop = {
      ...makeStop('A'),
      platform_code: 'P1',
    };

    const result = createStopReferenceSnapshot(stop, [3]);

    expect(result.platformCode).toBe('P1');
  });
});

describe('buildHistorySelectionStop', () => {
  it('builds a minimal Stop from a stored history snapshot with coordinates', () => {
    const result = buildHistorySelectionStop(makeEntry('A', [3], 1000));

    expect(result).toEqual({
      stop_id: 'A',
      stop_name: 'A',
      stop_names: {},
      stop_lat: 35,
      stop_lon: 139,
      location_type: 0,
      agency_id: '',
      platform_code: undefined,
    });
  });

  it('returns null when the stored history snapshot has no coordinates', () => {
    const result = buildHistorySelectionStop({
      snapshot: {
        stopId: 'A',
        name: 'A',
        lat: null,
        lon: null,
        routeTypes: [3],
        agencyNames: [],
      },
      selectedAt: 1000,
    });

    expect(result).toBeNull();
  });
});
