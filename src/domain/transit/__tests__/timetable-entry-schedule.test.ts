import { describe, it, expect } from 'vitest';
import {
  getDisplayMinutes,
  getDwellMinutes,
  getRemainingMinutes,
  hasDwellTime,
} from '../timetable-entry-schedule';
import { makeEntry } from './make-timetable-entry';

// ---------------------------------------------------------------------------
// getDisplayMinutes
// ---------------------------------------------------------------------------

describe('getDisplayMinutes', () => {
  it('returns departureMinutes for non-terminal stop', () => {
    const entry = makeEntry({ departureMinutes: 600, arrivalMinutes: 598, isLastStop: false });
    expect(getDisplayMinutes(entry)).toBe(600);
  });

  it('returns arrivalMinutes for terminal stop', () => {
    const entry = makeEntry({ departureMinutes: 600, arrivalMinutes: 598, isLastStop: true });
    expect(getDisplayMinutes(entry)).toBe(598);
  });

  it('returns departureMinutes when arrival equals departure (non-terminal)', () => {
    const entry = makeEntry({ departureMinutes: 480, arrivalMinutes: 480, isLastStop: false });
    expect(getDisplayMinutes(entry)).toBe(480);
  });

  it('returns arrivalMinutes when arrival equals departure (terminal)', () => {
    const entry = makeEntry({ departureMinutes: 480, arrivalMinutes: 480, isLastStop: true });
    expect(getDisplayMinutes(entry)).toBe(480);
  });

  it('handles overnight times (>= 1440)', () => {
    const entry = makeEntry({ departureMinutes: 1500, arrivalMinutes: 1498, isLastStop: false });
    expect(getDisplayMinutes(entry)).toBe(1500);
  });

  it('handles overnight terminal times (>= 1440)', () => {
    const entry = makeEntry({ departureMinutes: 1500, arrivalMinutes: 1498, isLastStop: true });
    expect(getDisplayMinutes(entry)).toBe(1498);
  });
});

// ---------------------------------------------------------------------------
// hasDwellTime / getDwellMinutes
// ---------------------------------------------------------------------------

describe('hasDwellTime', () => {
  it('returns false when arrival equals departure', () => {
    expect(hasDwellTime(makeEntry({ departureMinutes: 480, arrivalMinutes: 480 }))).toBe(false);
  });

  it('returns true when arrival differs from departure', () => {
    expect(hasDwellTime(makeEntry({ departureMinutes: 482, arrivalMinutes: 480 }))).toBe(true);
  });
});

describe('getDwellMinutes', () => {
  it('returns 0 when no dwell time', () => {
    expect(getDwellMinutes(makeEntry({ departureMinutes: 480, arrivalMinutes: 480 }))).toBe(0);
  });

  it('returns difference when dwell time exists', () => {
    expect(getDwellMinutes(makeEntry({ departureMinutes: 485, arrivalMinutes: 483 }))).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getRemainingMinutes
// ---------------------------------------------------------------------------

describe('getRemainingMinutes', () => {
  it('returns remaining minutes when insights loaded', () => {
    expect(getRemainingMinutes(makeEntry({ remainingMinutes: 25 }))).toBe(25);
  });

  it('returns null when insights not loaded', () => {
    expect(getRemainingMinutes(makeEntry())).toBeNull();
  });

  it('returns 0 for terminal stop', () => {
    expect(getRemainingMinutes(makeEntry({ remainingMinutes: 0 }))).toBe(0);
  });
});
