import { describe, expect, it } from 'vitest';
import {
  aggregateBoardingStopsCount,
  aggregateMaxTripsPerDay,
  aggregateRouteTypeCounts,
  aggregateRouteShapesCount,
} from '../aggregate-source-counts';
import type { DataSourceInfo } from '../../../types/app/data-source-info';
import type { AppRouteTypeValue } from '../../../types/app/transit';

function makeInfo(
  prefix: string,
  fields: {
    maxTripsPerDay?: number | null;
    boardingStopsCount?: number | null;
    routeTypeCounts?: Partial<Record<AppRouteTypeValue, number>> | null;
    routeShapesCount?: number | null;
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
    routes:
      fields.routeTypeCounts === undefined || fields.routeTypeCounts === null
        ? null
        : { typeCounts: fields.routeTypeCounts },
    routeShapes:
      fields.routeShapesCount === undefined || fields.routeShapesCount === null
        ? null
        : { count: fields.routeShapesCount },
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

describe('aggregateRouteShapesCount', () => {
  it('returns null for empty input', () => {
    expect(aggregateRouteShapesCount([])).toBeNull();
  });

  it('returns null when every entry has a null value', () => {
    expect(
      aggregateRouteShapesCount([
        makeInfo('a', { routeShapesCount: null }),
        makeInfo('b', { routeShapesCount: null }),
      ]),
    ).toBeNull();
  });

  it('sums routeShapes counts across entries', () => {
    expect(
      aggregateRouteShapesCount([
        makeInfo('a', { routeShapesCount: 12 }),
        makeInfo('b', { routeShapesCount: 5 }),
      ]),
    ).toBe(17);
  });

  it('skips null entries while keeping the others', () => {
    expect(
      aggregateRouteShapesCount([
        makeInfo('a', { routeShapesCount: 12 }),
        makeInfo('b', { routeShapesCount: null }),
        makeInfo('c', { routeShapesCount: 5 }),
      ]),
    ).toBe(17);
  });

  it('treats zero as a real value (not "missing")', () => {
    expect(aggregateRouteShapesCount([makeInfo('a', { routeShapesCount: 0 })])).toBe(0);
  });
});

describe('aggregateRouteTypeCounts', () => {
  it('returns null for empty input', () => {
    expect(aggregateRouteTypeCounts([])).toBeNull();
  });

  it('returns null when every entry has a null value', () => {
    expect(
      aggregateRouteTypeCounts([
        makeInfo('a', { routeTypeCounts: null }),
        makeInfo('b', { routeTypeCounts: null }),
      ]),
    ).toBeNull();
  });

  it('sums routeTypeCounts across entries', () => {
    expect(
      aggregateRouteTypeCounts([
        makeInfo('a', { routeTypeCounts: { 1: 2, 3: 5 } }),
        makeInfo('b', { routeTypeCounts: { 3: 4, 4: 1 } }),
      ]),
    ).toEqual({ 1: 2, 3: 9, 4: 1 });
  });

  it('skips null entries while keeping the others', () => {
    expect(
      aggregateRouteTypeCounts([
        makeInfo('a', { routeTypeCounts: { 3: 5 } }),
        makeInfo('b', { routeTypeCounts: null }),
        makeInfo('c', { routeTypeCounts: { 3: 4, 12: 1 } }),
      ]),
    ).toEqual({ 3: 9, 12: 1 });
  });

  it('treats zero as a real value (not "missing")', () => {
    expect(aggregateRouteTypeCounts([makeInfo('a', { routeTypeCounts: { 3: 0 } })])).toEqual({
      3: 0,
    });
  });
});
