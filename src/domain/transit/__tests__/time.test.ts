import { describe, it, expect } from 'vitest';
import { classifyRelativeTime, formatAbsoluteTime, groupByHour } from '../time';

describe('classifyRelativeTime', () => {
  const now = new Date(2026, 2, 4, 9, 0, 0);

  it('returns zero future minutes for exactly the same time', () => {
    expect(classifyRelativeTime(new Date(now.getTime()), now)).toEqual({
      kind: 'future',
      minutes: 0,
    });
  });

  it('returns zero future minutes for sub-minute future', () => {
    expect(classifyRelativeTime(new Date(now.getTime() + 30_000), now)).toEqual({
      kind: 'future',
      minutes: 0,
    });
  });

  it('returns past one minute for sub-minute past', () => {
    expect(classifyRelativeTime(new Date(now.getTime() - 30_000), now)).toEqual({
      kind: 'past',
      minutes: 1,
    });
  });

  it('returns past minutes from one minute ago and earlier', () => {
    expect(classifyRelativeTime(new Date(now.getTime() - 60_000), now)).toEqual({
      kind: 'past',
      minutes: 1,
    });
  });

  it('rounds past minutes up after the one-minute boundary', () => {
    expect(classifyRelativeTime(new Date(now.getTime() - 61_000), now)).toEqual({
      kind: 'past',
      minutes: 2,
    });
  });

  it('returns one future minute exactly at the one-minute boundary', () => {
    expect(classifyRelativeTime(new Date(now.getTime() + 60_000), now)).toEqual({
      kind: 'future',
      minutes: 1,
    });
  });

  it('returns future minutes from one minute ahead and later', () => {
    expect(classifyRelativeTime(new Date(now.getTime() + 5 * 60_000 + 30_000), now)).toEqual({
      kind: 'future',
      minutes: 5,
    });
  });
});

describe('formatAbsoluteTime', () => {
  it('formats morning time without leading zero on hour', () => {
    expect(formatAbsoluteTime(new Date(2026, 2, 4, 9, 5, 0))).toBe('9:05');
  });

  it('formats afternoon time', () => {
    expect(formatAbsoluteTime(new Date(2026, 2, 4, 14, 30, 0))).toBe('14:30');
  });

  it('formats midnight as 0:00', () => {
    expect(formatAbsoluteTime(new Date(2026, 2, 4, 0, 0, 0))).toBe('0:00');
  });

  it('pads minutes with leading zero', () => {
    expect(formatAbsoluteTime(new Date(2026, 2, 4, 9, 3, 0))).toBe('9:03');
  });

  it('formats :00 minutes correctly', () => {
    expect(formatAbsoluteTime(new Date(2026, 2, 4, 12, 0, 0))).toBe('12:00');
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
