import { describe, it, expect } from 'vitest';
import {
  isDropOffOnly,
  isBoardingOnly,
  isPassThrough,
  requiresArrangement,
} from '../timetable-entry-boarding';
import { makeEntry } from './make-timetable-entry';

// ---------------------------------------------------------------------------
// isDropOffOnly
// ---------------------------------------------------------------------------

describe('isDropOffOnly', () => {
  it('returns true when pickupType is 1 (source signal)', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 1 }))).toBe(true);
  });

  it('returns true when isTerminal (pattern inference)', () => {
    expect(isDropOffOnly(makeEntry({ isTerminal: true }))).toBe(true);
  });

  it('returns false when pickupType is 2 and stop is not terminal', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 2, isTerminal: false }))).toBe(false);
  });

  it('returns false when pickupType is 3 and stop is not terminal', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 3, isTerminal: false }))).toBe(false);
  });

  it('returns true for terminal stop even when pickupType is 2', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 2, isTerminal: true }))).toBe(true);
  });

  it('returns true for terminal stop even when pickupType is 3', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 3, isTerminal: true }))).toBe(true);
  });

  it('returns false for regular mid-route stop', () => {
    expect(isDropOffOnly(makeEntry())).toBe(false);
  });

  it('returns true when both signals agree', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 1, isTerminal: true }))).toBe(true);
  });

  it('returns true when a circular stop is both origin and terminal', () => {
    expect(isDropOffOnly(makeEntry({ isOrigin: true, isTerminal: true, pickupType: 0 }))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// isBoardingOnly
// ---------------------------------------------------------------------------

describe('isBoardingOnly', () => {
  it('returns true when dropOffType is 1 (source signal)', () => {
    expect(isBoardingOnly(makeEntry({ dropOffType: 1 }))).toBe(true);
  });

  it('returns true when isOrigin (pattern inference)', () => {
    expect(isBoardingOnly(makeEntry({ isOrigin: true }))).toBe(true);
  });

  it('returns false for regular mid-route stop', () => {
    expect(isBoardingOnly(makeEntry())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPassThrough
// ---------------------------------------------------------------------------

describe('isPassThrough', () => {
  it('returns true when both pickup and dropoff are unavailable', () => {
    expect(isPassThrough(makeEntry({ pickupType: 1, dropOffType: 1 }))).toBe(true);
  });

  it('returns false when only pickup is unavailable', () => {
    expect(isPassThrough(makeEntry({ pickupType: 1 }))).toBe(false);
  });

  it('returns false for regular stop', () => {
    expect(isPassThrough(makeEntry())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requiresArrangement
// ---------------------------------------------------------------------------

describe('requiresArrangement', () => {
  it('returns true for phone required pickup', () => {
    expect(requiresArrangement(makeEntry({ pickupType: 2 }))).toBe(true);
  });

  it('returns true for coordinate required dropoff', () => {
    expect(requiresArrangement(makeEntry({ dropOffType: 3 }))).toBe(true);
  });

  it('returns false for regular stop', () => {
    expect(requiresArrangement(makeEntry())).toBe(false);
  });

  it('returns false for unavailable (1 is not an arrangement)', () => {
    expect(requiresArrangement(makeEntry({ pickupType: 1 }))).toBe(false);
  });
});
