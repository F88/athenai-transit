import { describe, it, expect } from 'vitest';
import { formatRelativeTime, formatAbsoluteTime, groupByHour } from '../time';

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-04T09:00:00');

  it('returns "まもなく" when departure is at the same time', () => {
    expect(formatRelativeTime(new Date('2026-03-04T09:00:00'), now)).toBe('まもなく');
  });

  it('returns "まもなく" when departure is in the past', () => {
    expect(formatRelativeTime(new Date('2026-03-04T08:55:00'), now)).toBe('まもなく');
  });

  it('returns "あと1分" for 1 minute ahead', () => {
    expect(formatRelativeTime(new Date('2026-03-04T09:01:00'), now)).toBe('あと1分');
  });

  it('returns "あと5分" for 5 minutes ahead', () => {
    expect(formatRelativeTime(new Date('2026-03-04T09:05:00'), now)).toBe('あと5分');
  });

  it('floors partial minutes (5m30s => あと5分)', () => {
    expect(formatRelativeTime(new Date('2026-03-04T09:05:30'), now)).toBe('あと5分');
  });

  it('handles large time differences', () => {
    expect(formatRelativeTime(new Date('2026-03-04T10:00:00'), now)).toBe('あと60分');
  });

  it('returns "まもなく" for exactly 0 seconds difference', () => {
    const same = new Date(now.getTime());
    expect(formatRelativeTime(same, now)).toBe('まもなく');
  });

  it('returns "まもなく" for sub-minute future (30 seconds)', () => {
    const dep = new Date(now.getTime() + 30_000);
    expect(formatRelativeTime(dep, now)).toBe('まもなく');
  });
});

describe('formatAbsoluteTime', () => {
  it('formats morning time without leading zero on hour', () => {
    expect(formatAbsoluteTime(new Date('2026-03-04T09:05:00'))).toBe('9:05');
  });

  it('formats afternoon time', () => {
    expect(formatAbsoluteTime(new Date('2026-03-04T14:30:00'))).toBe('14:30');
  });

  it('formats midnight as 0:00', () => {
    expect(formatAbsoluteTime(new Date('2026-03-04T00:00:00'))).toBe('0:00');
  });

  it('pads minutes with leading zero', () => {
    expect(formatAbsoluteTime(new Date('2026-03-04T09:03:00'))).toBe('9:03');
  });

  it('formats :00 minutes correctly', () => {
    expect(formatAbsoluteTime(new Date('2026-03-04T12:00:00'))).toBe('12:00');
  });
});

describe('groupByHour', () => {
  it('returns empty map for empty input', () => {
    expect(groupByHour([])).toEqual(new Map());
  });

  it('groups departures into correct hours', () => {
    // 540 = 9:00, 545 = 9:05, 600 = 10:00, 605 = 10:05
    const result = groupByHour([540, 545, 600, 605]);

    expect(result.get(9)).toEqual([0, 5]);
    expect(result.get(10)).toEqual([0, 5]);
    expect(result.size).toBe(2);
  });

  it('handles single departure', () => {
    const result = groupByHour([720]); // 12:00
    expect(result.get(12)).toEqual([0]);
  });

  it('handles midnight (hour 0)', () => {
    const result = groupByHour([0, 30]); // 0:00, 0:30
    expect(result.get(0)).toEqual([0, 30]);
  });

  it('handles late-night departures >= 24:00 (1440+ minutes)', () => {
    // 1440 = 24:00, 1470 = 24:30
    const result = groupByHour([1440, 1470]);
    expect(result.get(24)).toEqual([0, 30]);
  });

  it('handles hour 25 (1500+ minutes)', () => {
    const result = groupByHour([1500, 1515]); // 25:00, 25:15
    expect(result.get(25)).toEqual([0, 15]);
  });

  it('preserves minutes within each hour', () => {
    const result = groupByHour([541, 559]); // 9:01, 9:19
    expect(result.get(9)).toEqual([1, 19]);
  });

  it('handles departures at exact hour boundaries', () => {
    // 59 = 0:59, 60 = 1:00
    const result = groupByHour([59, 60]);
    expect(result.get(0)).toEqual([59]);
    expect(result.get(1)).toEqual([0]);
  });
});
