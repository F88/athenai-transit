import { describe, expect, it } from 'vitest';
import { aggregateSourceSize, formatBytes } from '../aggregate-source-size';
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
    shapesAvailable: false,
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

describe('formatBytes', () => {
  it('formats bytes below 1KB as B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats KB with 1 decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1023)).toBe('1023.0 KB');
  });

  it('formats MB with 1 decimal', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 3 + 1024 * 200)).toBe('3.2 MB');
  });

  it('formats GB with 1 decimal', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
  });
});
