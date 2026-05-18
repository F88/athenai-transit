import { describe, expect, it } from 'vitest';
import { aggregateBoardingStopsCount, aggregateMaxTripsPerDay } from '../aggregate-source-counts';
import type { DataSourceInfo } from '../../../types/app/data-source-info';

function makeInfo(
  prefix: string,
  fields: {
    maxTripsPerDay?: number | null;
    boardingStopsCount?: number | null;
  },
): DataSourceInfo {
  return {
    prefix,
    feedVersion: null,
    feedValidity: { start: null, end: null },
    servicePeriod: null,
    totalSizeBytes: null,
    maxTripsPerDay: fields.maxTripsPerDay ?? null,
    boardingStopsCount: fields.boardingStopsCount ?? null,
    shapesAvailable: false,
    translationLanguages: [],
  };
}

describe('aggregateMaxTripsPerDay', () => {
  it('returns null for empty input', () => {
    expect(aggregateMaxTripsPerDay([])).toBeNull();
  });

  it('returns null when every entry has a null value', () => {
    expect(
      aggregateMaxTripsPerDay([
        makeInfo('a', { maxTripsPerDay: null }),
        makeInfo('b', { maxTripsPerDay: null }),
      ]),
    ).toBeNull();
  });

  it('sums maxTripsPerDay across entries', () => {
    expect(
      aggregateMaxTripsPerDay([
        makeInfo('a', { maxTripsPerDay: 1000 }),
        makeInfo('b', { maxTripsPerDay: 245 }),
      ]),
    ).toBe(1245);
  });

  it('skips null entries while keeping the others', () => {
    expect(
      aggregateMaxTripsPerDay([
        makeInfo('a', { maxTripsPerDay: 1000 }),
        makeInfo('b', { maxTripsPerDay: null }),
        makeInfo('c', { maxTripsPerDay: 245 }),
      ]),
    ).toBe(1245);
  });

  it('treats zero as a real value (not "missing")', () => {
    expect(aggregateMaxTripsPerDay([makeInfo('a', { maxTripsPerDay: 0 })])).toBe(0);
  });
});

describe('aggregateBoardingStopsCount', () => {
  it('returns null for empty input', () => {
    expect(aggregateBoardingStopsCount([])).toBeNull();
  });

  it('returns null when every entry has a null value', () => {
    expect(
      aggregateBoardingStopsCount([
        makeInfo('a', { boardingStopsCount: null }),
        makeInfo('b', { boardingStopsCount: null }),
      ]),
    ).toBeNull();
  });

  it('sums boardingStopsCount across entries', () => {
    expect(
      aggregateBoardingStopsCount([
        makeInfo('a', { boardingStopsCount: 800 }),
        makeInfo('b', { boardingStopsCount: 45 }),
      ]),
    ).toBe(845);
  });

  it('skips null entries while keeping the others', () => {
    expect(
      aggregateBoardingStopsCount([
        makeInfo('a', { boardingStopsCount: 800 }),
        makeInfo('b', { boardingStopsCount: null }),
        makeInfo('c', { boardingStopsCount: 45 }),
      ]),
    ).toBe(845);
  });

  it('treats zero as a real value (not "missing")', () => {
    expect(aggregateBoardingStopsCount([makeInfo('a', { boardingStopsCount: 0 })])).toBe(0);
  });
});
