import { describe, expect, it } from 'vitest';
import { relativeTimeColor, relativeTimeStyle, RELATIVE_TIME_BANDS } from '../time-style';

describe('relativeTimeStyle', () => {
  it('returns orange for imminent stop times (<=180s)', () => {
    expect(relativeTimeStyle(0).color).toBe('#fb8c00');
    expect(relativeTimeStyle(-60).color).toBe('#fb8c00');
    expect(relativeTimeStyle(60).color).toBe('#fb8c00');
    expect(relativeTimeStyle(180).color).toBe('#fb8c00');
  });

  it('returns green for 4-10 minutes (181-600s)', () => {
    expect(relativeTimeStyle(181).color).toBe('#43a047');
    expect(relativeTimeStyle(400).color).toBe('#43a047');
    expect(relativeTimeStyle(600).color).toBe('#43a047');
  });

  it('returns blue for 11-15 minutes (601-900s)', () => {
    expect(relativeTimeStyle(601).color).toBe('#1e88e5');
    expect(relativeTimeStyle(900).color).toBe('#1e88e5');
  });

  it('returns gray 0.8 for 16-30 minutes (901-1800s)', () => {
    const style = relativeTimeStyle(901);
    expect(style.color).toBe('#757575');
    expect(style.opacity).toBe(0.8);
    expect(relativeTimeStyle(1800).color).toBe('#757575');
  });

  it('returns gray 0.6 for 31-60 minutes (1801-3600s)', () => {
    const style = relativeTimeStyle(1801);
    expect(style.color).toBe('#757575');
    expect(style.opacity).toBe(0.6);
  });

  it('returns fallback for >60 minutes', () => {
    const style = relativeTimeStyle(3601);
    expect(style.color).toBe('#757575');
    expect(style.opacity).toBe(0.3);
  });

  it('returns textColor for each band', () => {
    expect(relativeTimeStyle(0).textColor).toBe('#ffffff');
    expect(relativeTimeStyle(400).textColor).toBe('#ffffff');
    expect(relativeTimeStyle(700).textColor).toBe('#ffffff');
  });
});

describe('relativeTimeColor', () => {
  it('returns color string for each band', () => {
    expect(relativeTimeColor(60)).toBe('#fb8c00');
    expect(relativeTimeColor(240)).toBe('#43a047');
    expect(relativeTimeColor(700)).toBe('#1e88e5');
    expect(relativeTimeColor(1200)).toBe('#757575');
    expect(relativeTimeColor(2400)).toBe('#757575');
    expect(relativeTimeColor(5000)).toBe('#757575');
  });
});

describe('RELATIVE_TIME_BANDS', () => {
  it('is sorted by max ascending', () => {
    for (let i = 1; i < RELATIVE_TIME_BANDS.length; i++) {
      expect(RELATIVE_TIME_BANDS[i].max).toBeGreaterThan(RELATIVE_TIME_BANDS[i - 1].max);
    }
  });
});
