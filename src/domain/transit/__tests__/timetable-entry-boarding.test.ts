import { describe, it, expect } from 'vitest';
import { isNoPassengerService, requiresArrangement } from '../timetable-entry-boarding';
import { makeEntry } from './make-timetable-entry';

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
