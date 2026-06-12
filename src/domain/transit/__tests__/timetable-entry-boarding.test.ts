import { describe, it, expect } from 'vitest';
import {
  isDropOffOnly,
  isNoPassengerService,
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

  it('returns true when isLastStop (pattern inference)', () => {
    expect(isDropOffOnly(makeEntry({ isLastStop: true }))).toBe(true);
  });

  it('returns false when pickupType is 2 and stop is not terminal', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 2, isLastStop: false }))).toBe(false);
  });

  it('returns false when pickupType is 3 and stop is not terminal', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 3, isLastStop: false }))).toBe(false);
  });

  it('returns true for terminal stop even when pickupType is 2', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 2, isLastStop: true }))).toBe(true);
  });

  it('returns true for terminal stop even when pickupType is 3', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 3, isLastStop: true }))).toBe(true);
  });

  it('returns false for regular mid-route stop', () => {
    expect(isDropOffOnly(makeEntry())).toBe(false);
  });

  it('returns true when both signals agree', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 1, isLastStop: true }))).toBe(true);
  });

  it('returns true when a circular stop is both origin and terminal', () => {
    expect(isDropOffOnly(makeEntry({ isFirstStop: true, isLastStop: true, pickupType: 0 }))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// isNoPassengerService
// ---------------------------------------------------------------------------

describe('isNoPassengerService', () => {
  it('returns true when both pickup and dropoff are unavailable', () => {
    expect(isNoPassengerService(makeEntry({ pickupType: 1, dropOffType: 1 }))).toBe(true);
  });

  it('returns false when only pickup is unavailable', () => {
    expect(isNoPassengerService(makeEntry({ pickupType: 1 }))).toBe(false);
  });

  it('returns false for regular stop', () => {
    expect(isNoPassengerService(makeEntry())).toBe(false);
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
