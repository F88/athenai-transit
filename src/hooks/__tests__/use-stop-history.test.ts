import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useStopHistory } from '../use-stop-history';
import { makeStopMeta } from '../../__tests__/helpers';
import type { AppRouteTypeValue } from '../../types/app/transit';

const STORAGE_KEY = 'stop-history';

beforeEach(() => {
  localStorage.clear();
});

describe('useStopHistory', () => {
  describe('initial load', () => {
    it('returns empty history when localStorage is empty', () => {
      const { result } = renderHook(() => useStopHistory());
      expect(result.current.history).toEqual([]);
    });

    it('loads existing history from localStorage', () => {
      const entry = {
        stopWithMeta: makeStopMeta('A'),
        routeTypes: [3],
        selectedAt: 1000,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([entry]));

      const { result } = renderHook(() => useStopHistory());
      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].stopWithMeta.stop.stop_id).toBe('A');
      expect(result.current.history[0].routeTypes).toEqual([3]);
    });
  });

  describe('pushStop', () => {
    it('adds a stop to history and persists to localStorage', () => {
      const { result } = renderHook(() => useStopHistory());

      act(() => {
        result.current.pushStop(makeStopMeta('X'), [3]);
      });

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].stopWithMeta.stop.stop_id).toBe('X');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
        routeTypes: number[];
      }[];
      expect(stored).toHaveLength(1);
      expect(stored[0].routeTypes).toEqual([3]);
    });

    it('moves duplicate stop to front', () => {
      const { result } = renderHook(() => useStopHistory());

      act(() => {
        result.current.pushStop(makeStopMeta('A'), [3]);
      });
      act(() => {
        result.current.pushStop(makeStopMeta('B'), [2]);
      });
      act(() => {
        result.current.pushStop(makeStopMeta('A'), [3]);
      });

      expect(result.current.history).toHaveLength(2);
      expect(result.current.history[0].stopWithMeta.stop.stop_id).toBe('A');
      expect(result.current.history[1].stopWithMeta.stop.stop_id).toBe('B');
    });
  });

  describe('legacy migration', () => {
    it('migrates routeType (singular) to routeTypes (plural)', () => {
      const legacyEntry = {
        stopWithMeta: makeStopMeta('legacy'),
        routeType: 2,
        selectedAt: 500,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([legacyEntry]));

      const { result } = renderHook(() => useStopHistory());

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].routeTypes).toEqual([2]);
      // Legacy routeType should not remain
      expect('routeType' in result.current.history[0]).toBe(false);
    });

    it('defaults to [3] (bus) when legacy entry has no routeType', () => {
      const brokenEntry = {
        stopWithMeta: makeStopMeta('broken'),
        selectedAt: 100,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([brokenEntry]));

      const { result } = renderHook(() => useStopHistory());

      expect(result.current.history[0].routeTypes).toEqual([3]);
    });

    it('re-saves migrated data to localStorage immediately', () => {
      const legacyEntry = {
        stopWithMeta: makeStopMeta('old'),
        routeType: 1,
        selectedAt: 200,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([legacyEntry]));

      renderHook(() => useStopHistory());

      // localStorage should now contain the new format
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
        routeTypes: number[];
        routeType?: number;
      }[];
      expect(stored).toHaveLength(1);
      expect(stored[0].routeTypes).toEqual([1]);
      expect(stored[0]).not.toHaveProperty('routeType');
    });

    it('drops entries with corrupted stopWithMeta', () => {
      const validEntry = {
        stopWithMeta: makeStopMeta('valid'),
        routeTypes: [3],
        selectedAt: 100,
      };
      const corruptedEntries = [
        { routeTypes: [3], selectedAt: 50 }, // missing stopWithMeta
        { stopWithMeta: null, routeTypes: [3], selectedAt: 60 }, // null stopWithMeta
        { stopWithMeta: { stop: null }, routeTypes: [3], selectedAt: 70 }, // null stop
        { stopWithMeta: { stop: {} }, routeTypes: [3], selectedAt: 80 }, // missing stop_id
        { stopWithMeta: 'invalid', routeTypes: [3], selectedAt: 90 }, // non-object
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...corruptedEntries, validEntry]));

      const { result } = renderHook(() => useStopHistory());

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].stopWithMeta.stop.stop_id).toBe('valid');
    });

    it('preserves data shape when no migration is needed', () => {
      const newEntry = {
        stopWithMeta: makeStopMeta('new'),
        routeTypes: [0, 3] as AppRouteTypeValue[],
        selectedAt: 300,
      };
      const json = JSON.stringify([newEntry]);
      localStorage.setItem(STORAGE_KEY, json);

      renderHook(() => useStopHistory());

      // Content should be equivalent (re-save happens but data is same shape)
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
        routeTypes: number[];
      }[];
      expect(stored[0].routeTypes).toEqual([0, 3]);
    });
  });
});
