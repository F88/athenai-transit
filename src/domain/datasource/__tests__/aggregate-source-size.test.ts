import { describe, expect, it } from 'vitest';
import { aggregateSourceSize } from '../aggregate-source-size';
import type { DataSourceInfo } from '../../../types/app/data-source-info';

function makeInfo(prefix: string, totalSizeBytes: number | null): DataSourceInfo {
  return {
    prefix,
    feedVersion: null,
    feedValidity: { start: null, end: null },
    servicePeriod: null,
    totalSizeBytes,
    maxTripsPerDay: null,
    boardingStopsCount: null,
    routes: null,
    routeShapes: null,
    translationLanguages: [],
  };
}

describe('aggregateSourceSize', () => {
  it('returns null for empty input', () => {
    expect(aggregateSourceSize([])).toBeNull();
  });

  it('returns null when every entry has a null totalSizeBytes', () => {
    const infos = [makeInfo('a', null), makeInfo('b', null)];
    expect(aggregateSourceSize(infos)).toBeNull();
  });

  it('sums totalSizeBytes across entries', () => {
    const infos = [makeInfo('a', 1000), makeInfo('b', 500)];
    expect(aggregateSourceSize(infos)).toEqual({ totalBytes: 1500 });
  });

  it('silently skips entries whose totalSizeBytes is null', () => {
    const infos = [makeInfo('a', 1000), makeInfo('b', null), makeInfo('c', 500)];
    expect(aggregateSourceSize(infos)).toEqual({ totalBytes: 1500 });
  });

  it('treats a zero-byte total as a real value (not "missing")', () => {
    const infos = [makeInfo('a', 0)];
    // found = true once we see a non-null entry, even if it sums to 0
    expect(aggregateSourceSize(infos)).toEqual({ totalBytes: 0 });
  });
});
