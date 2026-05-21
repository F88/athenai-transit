import { describe, it, expect } from 'vitest';
import {
  addToHistory,
  buildHistorySelectionStop,
  createStopHistorySelection,
  MAX_HISTORY_SIZE,
} from '../stop-history';
import { makeStop } from '../../../__tests__/helpers';
import type { StopHistoryEntry } from '../stop-history';
import type { AppRouteTypeValue } from '../../../types/app/transit';

function makeEntry(
  id: string,
  routeTypes: AppRouteTypeValue[] = [3],
  selectedAt = 1000,
): StopHistoryEntry {
  return {
    stopId: id,
    snapshot: { name: id, lat: 35, lon: 139, routeTypes },
    selectedAt,
  };
}

describe('addToHistory', () => {
  it('adds a stop to empty history', () => {
    const stop = makeStop('A');
    const result = addToHistory([], createStopHistorySelection(stop, [3]), 1000);

    expect(result).toHaveLength(1);
    expect(result[0].stopId).toBe('A');
    expect(result[0].snapshot.name).toBe('Stop A');
    expect(result[0].snapshot.lat).toBe(stop.stop_lat);
    expect(result[0].snapshot.lon).toBe(stop.stop_lon);
    expect(result[0].snapshot.routeTypes).toEqual([3]);
    expect(result[0].selectedAt).toBe(1000);
  });

  it('prepends new stop to front of history', () => {
    const existing = [makeEntry('A')];
    const result = addToHistory(existing, createStopHistorySelection(makeStop('B'), [2]), 2000);

    expect(result).toHaveLength(2);
    expect(result[0].stopId).toBe('B');
    expect(result[1].stopId).toBe('A');
  });

  it('moves duplicate stop to front with updated timestamp', () => {
    const existing = [makeEntry('A', [3], 1000), makeEntry('B', [2], 900)];
    const result = addToHistory(existing, createStopHistorySelection(makeStop('B'), [2]), 2000);

    expect(result).toHaveLength(2);
    expect(result[0].stopId).toBe('B');
    expect(result[0].selectedAt).toBe(2000);
    expect(result[1].stopId).toBe('A');
  });

  it('updates routeTypes when moving duplicate to front', () => {
    const existing = [makeEntry('A', [3], 1000)];
    const result = addToHistory(existing, createStopHistorySelection(makeStop('A'), [0, 3]), 2000);

    expect(result).toHaveLength(1);
    expect(result[0].snapshot.routeTypes).toEqual([0, 3]);
  });

  it('caps history at MAX_HISTORY_SIZE', () => {
    const existing: StopHistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
      existing.push(makeEntry(`s${i}`, [3], i));
    }

    const result = addToHistory(existing, createStopHistorySelection(makeStop('new'), [3]), 9999);

    expect(result).toHaveLength(MAX_HISTORY_SIZE);
    expect(result[0].stopId).toBe('new');
    // Oldest entry (last in the original list) should be dropped
    expect(result.find((e) => e.stopId === `s${MAX_HISTORY_SIZE - 1}`)).toBeUndefined();
    // Earlier entries should still be present
    expect(result.find((e) => e.stopId === 's0')).toBeDefined();
  });

  it('does not exceed MAX_HISTORY_SIZE when adding duplicate', () => {
    const existing: StopHistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
      existing.push(makeEntry(`s${i}`, [3], i));
    }

    // Re-add an existing stop — should not grow
    const result = addToHistory(existing, createStopHistorySelection(makeStop('s5'), [3]), 9999);

    expect(result).toHaveLength(MAX_HISTORY_SIZE);
    expect(result[0].stopId).toBe('s5');
  });

  it('does not mutate original history array', () => {
    const existing = [makeEntry('A')];
    const originalLength = existing.length;

    addToHistory(existing, createStopHistorySelection(makeStop('B'), [3]), 2000);

    expect(existing).toHaveLength(originalLength);
  });

  it('handles multiple route types', () => {
    const result = addToHistory([], createStopHistorySelection(makeStop('X'), [0, 1, 2, 3]), 1000);

    expect(result[0].snapshot.routeTypes).toEqual([0, 1, 2, 3]);
  });
});

describe('MAX_HISTORY_SIZE', () => {
  it('is 20', () => {
    expect(MAX_HISTORY_SIZE).toBe(20);
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
    });
  });

  it('returns null when the stored history snapshot has no coordinates', () => {
    const result = buildHistorySelectionStop({
      stopId: 'A',
      snapshot: {
        name: 'A',
        lat: null,
        lon: null,
        routeTypes: [3],
      },
      selectedAt: 1000,
    });

    expect(result).toBeNull();
  });
});
