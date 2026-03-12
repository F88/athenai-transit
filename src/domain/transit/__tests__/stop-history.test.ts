import { describe, it, expect } from 'vitest';
import { addToHistory, MAX_HISTORY_SIZE } from '../stop-history';
import { makeStopMeta } from '../../../__tests__/helpers';
import type { StopHistoryEntry } from '../stop-history';
import type { RouteType } from '../../../types/app/transit';

function makeEntry(id: string, routeTypes: RouteType[] = [3], selectedAt = 1000): StopHistoryEntry {
  return { stopWithMeta: makeStopMeta(id), routeTypes, selectedAt };
}

describe('addToHistory', () => {
  it('adds a stop to empty history', () => {
    const meta = makeStopMeta('A');
    const result = addToHistory([], meta, [3], 1000);

    expect(result).toHaveLength(1);
    expect(result[0].stopWithMeta.stop.stop_id).toBe('A');
    expect(result[0].routeTypes).toEqual([3]);
    expect(result[0].selectedAt).toBe(1000);
  });

  it('prepends new stop to front of history', () => {
    const existing = [makeEntry('A')];
    const result = addToHistory(existing, makeStopMeta('B'), [2], 2000);

    expect(result).toHaveLength(2);
    expect(result[0].stopWithMeta.stop.stop_id).toBe('B');
    expect(result[1].stopWithMeta.stop.stop_id).toBe('A');
  });

  it('moves duplicate stop to front with updated timestamp', () => {
    const existing = [makeEntry('A', [3], 1000), makeEntry('B', [2], 900)];
    const result = addToHistory(existing, makeStopMeta('B'), [2], 2000);

    expect(result).toHaveLength(2);
    expect(result[0].stopWithMeta.stop.stop_id).toBe('B');
    expect(result[0].selectedAt).toBe(2000);
    expect(result[1].stopWithMeta.stop.stop_id).toBe('A');
  });

  it('updates routeTypes when moving duplicate to front', () => {
    const existing = [makeEntry('A', [3], 1000)];
    const result = addToHistory(existing, makeStopMeta('A'), [0, 3], 2000);

    expect(result).toHaveLength(1);
    expect(result[0].routeTypes).toEqual([0, 3]);
  });

  it('caps history at MAX_HISTORY_SIZE', () => {
    const existing: StopHistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
      existing.push(makeEntry(`s${i}`, [3], i));
    }

    const result = addToHistory(existing, makeStopMeta('new'), [3], 9999);

    expect(result).toHaveLength(MAX_HISTORY_SIZE);
    expect(result[0].stopWithMeta.stop.stop_id).toBe('new');
    // Oldest entry (last in the original list) should be dropped
    expect(
      result.find((e) => e.stopWithMeta.stop.stop_id === `s${MAX_HISTORY_SIZE - 1}`),
    ).toBeUndefined();
    // Earlier entries should still be present
    expect(result.find((e) => e.stopWithMeta.stop.stop_id === 's0')).toBeDefined();
  });

  it('does not exceed MAX_HISTORY_SIZE when adding duplicate', () => {
    const existing: StopHistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
      existing.push(makeEntry(`s${i}`, [3], i));
    }

    // Re-add an existing stop — should not grow
    const result = addToHistory(existing, makeStopMeta('s5'), [3], 9999);

    expect(result).toHaveLength(MAX_HISTORY_SIZE);
    expect(result[0].stopWithMeta.stop.stop_id).toBe('s5');
  });

  it('does not mutate original history array', () => {
    const existing = [makeEntry('A')];
    const originalLength = existing.length;

    addToHistory(existing, makeStopMeta('B'), [3], 2000);

    expect(existing).toHaveLength(originalLength);
  });

  it('handles multiple route types', () => {
    const result = addToHistory([], makeStopMeta('X'), [0, 1, 2, 3], 1000);

    expect(result[0].routeTypes).toEqual([0, 1, 2, 3]);
  });
});

describe('MAX_HISTORY_SIZE', () => {
  it('is 20', () => {
    expect(MAX_HISTORY_SIZE).toBe(20);
  });
});
