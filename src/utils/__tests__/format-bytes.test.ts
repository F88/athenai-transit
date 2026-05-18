import { describe, expect, it } from 'vitest';
import { formatBytesForDisplay } from '../format-bytes';

describe('formatBytesForDisplay', () => {
  it('formats bytes below 1KB as B', () => {
    expect(formatBytesForDisplay(0)).toBe('0 B');
    expect(formatBytesForDisplay(512)).toBe('512 B');
    expect(formatBytesForDisplay(1023)).toBe('1023 B');
  });

  it('formats KB with 1 decimal by default', () => {
    expect(formatBytesForDisplay(1024)).toBe('1.0 KB');
    expect(formatBytesForDisplay(1536)).toBe('1.5 KB');
    expect(formatBytesForDisplay(1024 * 1023)).toBe('1023.0 KB');
  });

  it('formats MB with 1 decimal by default', () => {
    expect(formatBytesForDisplay(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytesForDisplay(1024 * 1024 * 3 + 1024 * 200)).toBe('3.2 MB');
  });

  it('formats GB with 1 decimal by default', () => {
    expect(formatBytesForDisplay(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatBytesForDisplay(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
  });

  it('supports configurable fraction digits', () => {
    expect(formatBytesForDisplay(1024 * 1024 * 3 + 1024 * 200, { fractionDigits: 0 })).toBe('3 MB');
    expect(formatBytesForDisplay(1536, { fractionDigits: 2 })).toBe('1.50 KB');
  });

  it('rounds instead of truncating', () => {
    expect(formatBytesForDisplay(1996, { fractionDigits: 0 })).toBe('2 KB');
    expect(formatBytesForDisplay(1024 * 1024 * 3 + 1024 * 900)).toBe('3.9 MB');
  });
});
