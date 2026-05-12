import { describe, expect, it } from 'vitest';

import type { SelectedTripSnapshot, TripStopTime } from '@/types/app/transit-composed';
import { getRenderedTripStopRowKey, getVisibleTripStopRows } from '../trip-stop-rows';

function makeTripStopTime({
  stopIndex,
  totalStops,
  stopId,
}: {
  stopIndex: number;
  totalStops: number;
  stopId?: string;
}): TripStopTime {
  return {
    stopMeta: stopId
      ? {
          stop: { stop_id: stopId },
          agencies: [],
          routes: [],
        }
      : undefined,
    timetableEntry: {
      patternPosition: {
        stopIndex,
        totalStops,
        isOrigin: stopIndex === 0,
        isTerminal: stopIndex === totalStops - 1,
      },
    },
  } as TripStopTime;
}

function makeTripSnapshot(stopTimes: readonly TripStopTime[]): SelectedTripSnapshot {
  return {
    stopTimes,
  } as SelectedTripSnapshot;
}

describe('trip-stop-rows', () => {
  describe('getVisibleTripStopRows', () => {
    it('returns all dense rows when the rendered snapshot matches the trip snapshot', () => {
      const tripSnapshot = makeTripSnapshot([
        makeTripStopTime({ stopIndex: 0, totalStops: 3, stopId: 'stop-0' }),
        makeTripStopTime({ stopIndex: 2, totalStops: 3, stopId: 'stop-2' }),
      ]);

      const rows = getVisibleTripStopRows({
        tripSnapshot,
        renderedSnapshot: tripSnapshot,
        selectedPatternStopIndex: 1,
      });

      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ kind: 'stop', stopIndex: 0, totalStops: 3 });
      expect(rows[1]).toEqual({ kind: 'placeholder', stopIndex: 1, totalStops: 3 });
      expect(rows[2]).toMatchObject({ kind: 'stop', stopIndex: 2, totalStops: 3 });
    });

    it('returns only the initial window around the selected stop before the full list is restored', () => {
      const stopTimes = Array.from({ length: 20 }, (_, stopIndex) =>
        makeTripStopTime({
          stopIndex,
          totalStops: 20,
          stopId: `stop-${stopIndex}`,
        }),
      );
      const tripSnapshot = makeTripSnapshot(stopTimes);

      const rows = getVisibleTripStopRows({
        tripSnapshot,
        renderedSnapshot: null,
        selectedPatternStopIndex: 10,
      });

      expect(rows).toHaveLength(11);
      expect(rows[0]).toMatchObject({ kind: 'stop', stopIndex: 5, totalStops: 20 });
      expect(rows[10]).toMatchObject({ kind: 'stop', stopIndex: 15, totalStops: 20 });
    });

    it('clamps the initial window at the start of the pattern', () => {
      const stopTimes = Array.from({ length: 20 }, (_, stopIndex) =>
        makeTripStopTime({
          stopIndex,
          totalStops: 20,
          stopId: `stop-${stopIndex}`,
        }),
      );
      const tripSnapshot = makeTripSnapshot(stopTimes);

      const rows = getVisibleTripStopRows({
        tripSnapshot,
        renderedSnapshot: null,
        selectedPatternStopIndex: 0,
      });

      expect(rows).toHaveLength(6);
      expect(rows[0]).toMatchObject({ kind: 'stop', stopIndex: 0, totalStops: 20 });
      expect(rows[5]).toMatchObject({ kind: 'stop', stopIndex: 5, totalStops: 20 });
    });

    it('returns an empty array when there are no stop times', () => {
      const tripSnapshot = makeTripSnapshot([]);

      const rows = getVisibleTripStopRows({
        tripSnapshot,
        renderedSnapshot: null,
        selectedPatternStopIndex: 0,
      });

      expect(rows).toEqual([]);
    });
  });

  describe('getRenderedTripStopRowKey', () => {
    it('uses a placeholder prefix for placeholder rows', () => {
      expect(getRenderedTripStopRowKey({ kind: 'placeholder', stopIndex: 4, totalStops: 10 })).toBe(
        'placeholder:4',
      );
    });

    it('falls back to unknown-stop when a stop row has no stop id', () => {
      const row = {
        kind: 'stop' as const,
        stop: makeTripStopTime({ stopIndex: 7, totalStops: 10 }),
        stopIndex: 7,
        totalStops: 10,
      };

      expect(getRenderedTripStopRowKey(row)).toBe('(unknown-stop):7');
    });
  });
});
