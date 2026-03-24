import { describe, it, expect } from 'vitest';
import {
  isDropOffOnly,
  isBoardingOnly,
  isPassThrough,
  requiresArrangement,
  hasDwellTime,
  getDwellMinutes,
  getRemainingMinutes,
} from '../timetable-utils';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import type { Route } from '../../../types/app/transit';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const testRoute: Route = {
  route_id: 'r1',
  route_short_name: '都01',
  route_long_name: 'Test Route',
  route_names: {},
  route_type: 3,
  route_color: '2E7D32',
  route_text_color: 'FFFFFF',
  agency_id: 'test:agency',
};

function makeEntry(
  overrides: {
    departureMinutes?: number;
    arrivalMinutes?: number;
    pickupType?: 0 | 1 | 2 | 3;
    dropOffType?: 0 | 1 | 2 | 3;
    isTerminal?: boolean;
    isOrigin?: boolean;
    stopIndex?: number;
    totalStops?: number;
    remainingMinutes?: number;
  } = {},
): TimetableEntry {
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes ?? 480,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes ?? 480,
    },
    routeDirection: {
      route: testRoute,
      headsign: 'Test Terminal',
      headsign_names: {},
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 5,
      totalStops: overrides.totalStops ?? 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    insights:
      overrides.remainingMinutes !== undefined
        ? { remainingMinutes: overrides.remainingMinutes }
        : undefined,
  };
}

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

  it('returns false for regular mid-route stop', () => {
    expect(isDropOffOnly(makeEntry())).toBe(false);
  });

  it('returns true when both signals agree', () => {
    expect(isDropOffOnly(makeEntry({ pickupType: 1, isTerminal: true }))).toBe(true);
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
