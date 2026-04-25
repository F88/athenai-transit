import { describe, expect, it } from 'vitest';

import type { TripStopTime } from '@/types/app/transit-composed';

import { sortTripStopTimesByStopIndex } from '../sort-trip-stop-times';

interface CreateRowArgs {
  stopIndex: number;
  marker?: string;
}

function createRow({ stopIndex, marker }: CreateRowArgs): TripStopTime {
  // Only the fields exercised by the sort implementation are populated.
  // Other fields are set to harmless minimal stand-ins, since this test
  // only inspects identity and patternPosition.stopIndex ordering.
  return {
    stopMeta: undefined,
    routeTypes: [],
    timetableEntry: {
      tripLocator: { patternId: 'p', serviceId: 's', tripIndex: 0 },
      schedule: { departureMinutes: 0, arrivalMinutes: 0 },
      routeDirection: {
        route: {
          route_id: 'r',
          route_type: 3,
          agency_id: 'a',
          route_short_name: '',
          route_short_names: {},
          route_long_name: '',
          route_long_names: {},
          route_color: '',
          route_text_color: '',
        },
        tripHeadsign: { name: marker ?? '', names: {} },
      },
      boarding: { pickupType: 0, dropOffType: 0 },
      patternPosition: {
        stopIndex,
        totalStops: 100,
        isOrigin: false,
        isTerminal: false,
      },
    },
  };
}

function getStopIndexes(rows: readonly TripStopTime[]): number[] {
  return rows.map((row) => row.timetableEntry.patternPosition.stopIndex);
}

function getMarkers(rows: readonly TripStopTime[]): string[] {
  return rows.map((row) => row.timetableEntry.routeDirection.tripHeadsign.name);
}

describe('sortTripStopTimesByStopIndex', () => {
  describe('mutation behaviour', () => {
    it('mutates the input array in place and returns nothing', () => {
      const rows: TripStopTime[] = [createRow({ stopIndex: 2 }), createRow({ stopIndex: 0 })];
      const sameRef = rows;

      const result = sortTripStopTimesByStopIndex(rows);

      expect(result).toBeUndefined();
      // The function mutates the original array.
      expect(sameRef).toBe(rows);
      expect(getStopIndexes(rows)).toEqual([0, 2]);
    });
  });

  describe('basic ordering', () => {
    it('sorts a reversed array into ascending stopIndex order', () => {
      const rows: TripStopTime[] = [
        createRow({ stopIndex: 3 }),
        createRow({ stopIndex: 2 }),
        createRow({ stopIndex: 1 }),
        createRow({ stopIndex: 0 }),
      ];

      sortTripStopTimesByStopIndex(rows);

      expect(getStopIndexes(rows)).toEqual([0, 1, 2, 3]);
    });

    it('leaves an already-sorted array unchanged in stopIndex order', () => {
      const rows: TripStopTime[] = [
        createRow({ stopIndex: 0 }),
        createRow({ stopIndex: 1 }),
        createRow({ stopIndex: 2 }),
      ];

      sortTripStopTimesByStopIndex(rows);

      expect(getStopIndexes(rows)).toEqual([0, 1, 2]);
    });

    it('handles a randomly ordered array', () => {
      const rows: TripStopTime[] = [
        createRow({ stopIndex: 5 }),
        createRow({ stopIndex: 1 }),
        createRow({ stopIndex: 9 }),
        createRow({ stopIndex: 3 }),
        createRow({ stopIndex: 7 }),
      ];

      sortTripStopTimesByStopIndex(rows);

      expect(getStopIndexes(rows)).toEqual([1, 3, 5, 7, 9]);
    });
  });

  describe('preserves gaps when the input has missing stopIndexes', () => {
    it('keeps non-contiguous stopIndex values after sorting', () => {
      // Simulates the output of buildTripStopTimes when some pattern
      // entries were dropped: the surviving stopIndex values are not
      // contiguous, and sortTripStopTimesByStopIndex must not invent or
      // remove any rows.
      const rows: TripStopTime[] = [
        createRow({ stopIndex: 3 }),
        createRow({ stopIndex: 0 }),
        createRow({ stopIndex: 2 }),
      ];

      sortTripStopTimesByStopIndex(rows);

      expect(getStopIndexes(rows)).toEqual([0, 2, 3]);
    });
  });

  describe('edge cases', () => {
    it('does nothing for an empty array', () => {
      const rows: TripStopTime[] = [];

      sortTripStopTimesByStopIndex(rows);

      expect(rows).toEqual([]);
    });

    it('does nothing for a single-element array', () => {
      const rows: TripStopTime[] = [createRow({ stopIndex: 5 })];
      const original = rows[0];

      sortTripStopTimesByStopIndex(rows);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toBe(original);
      expect(getStopIndexes(rows)).toEqual([5]);
    });
  });

  describe('stability', () => {
    // Documented behaviour for the (unexpected) case of duplicate
    // stopIndex values: the relative order of the duplicates must be
    // preserved. Verifying this also guards against a future
    // implementation switch to a non-stable sort.
    it('preserves the relative order of elements with the same stopIndex', () => {
      const rows: TripStopTime[] = [
        createRow({ stopIndex: 2, marker: 'first-of-two' }),
        createRow({ stopIndex: 0, marker: 'origin' }),
        createRow({ stopIndex: 2, marker: 'second-of-two' }),
        createRow({ stopIndex: 1, marker: 'middle' }),
        createRow({ stopIndex: 2, marker: 'third-of-two' }),
      ];

      sortTripStopTimesByStopIndex(rows);

      expect(getStopIndexes(rows)).toEqual([0, 1, 2, 2, 2]);
      expect(getMarkers(rows)).toEqual([
        'origin',
        'middle',
        'first-of-two',
        'second-of-two',
        'third-of-two',
      ]);
    });
  });
});
