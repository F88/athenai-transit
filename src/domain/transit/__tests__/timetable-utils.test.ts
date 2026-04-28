import { describe, it, expect } from 'vitest';
import {
  isDropOffOnly,
  isBoardingOnly,
  isPassThrough,
  requiresArrangement,
  hasDwellTime,
  getDwellMinutes,
  getRemainingMinutes,
  hasBoardable,
  getDisplayMinutes,
  getStopServiceState,
  getTimetableEntriesState,
  getFilteredTimetableEntriesState,
} from '../timetable-utils';
import type { StopServiceStateInput } from '../../../types/app/transit';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import type { Route } from '../../../types/app/transit';
import { filterBoardable } from '../timetable-filter';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const testRoute: Route = {
  route_id: 'r1',
  route_short_name: '都01',
  route_short_names: {},
  route_long_name: 'Test Route',
  route_long_names: {},
  route_type: 3,
  route_color: '2E7D32',
  route_text_color: 'FFFFFF',
  agency_id: 'test:agency',
};

function makeRoute(id: string, agencyId = 'test:agency'): Route {
  return {
    route_id: id,
    route_short_name: id,
    route_short_names: {},
    route_long_name: '',
    route_long_names: {},
    route_type: 3,
    route_color: '2E7D32',
    route_text_color: 'FFFFFF',
    agency_id: agencyId,
  };
}

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
    route?: Route;
    headsign?: string;
  } = {},
): TimetableEntry {
  const route = overrides.route ?? testRoute;
  const headsign = overrides.headsign ?? 'Test Terminal';
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes ?? 480,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes ?? 480,
    },
    routeDirection: {
      route,
      tripHeadsign: { name: headsign, names: {} },
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
        ? { remainingMinutes: overrides.remainingMinutes, totalMinutes: 0, freq: 0 }
        : undefined,
    tripLocator: { patternId: `${route.route_id}__${headsign}`, serviceId: 'test', tripIndex: 0 },
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

// ---------------------------------------------------------------------------
// hasBoardable
// ---------------------------------------------------------------------------

describe('hasBoardable', () => {
  it('returns false for empty array', () => {
    expect(hasBoardable([])).toBe(false);
  });

  it('returns true when at least one entry is boardable', () => {
    expect(hasBoardable([makeEntry(), makeEntry({ pickupType: 1 })])).toBe(true);
  });

  it('returns false when all entries are drop-off only (pickupType=1)', () => {
    expect(hasBoardable([makeEntry({ pickupType: 1 }), makeEntry({ pickupType: 1 })])).toBe(false);
  });

  it('returns false when all entries are terminal (pattern inference)', () => {
    expect(hasBoardable([makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })])).toBe(
      false,
    );
  });

  it('returns true when terminal is mixed with non-terminal', () => {
    expect(hasBoardable([makeEntry({ isTerminal: true }), makeEntry()])).toBe(true);
  });
});

// -------------------------------------------------------------------------
// getDisplayMinutes
// -------------------------------------------------------------------------

describe('getDisplayMinutes', () => {
  it('returns departureMinutes for non-terminal stop', () => {
    const entry = makeEntry({ departureMinutes: 600, arrivalMinutes: 598, isTerminal: false });
    expect(getDisplayMinutes(entry)).toBe(600);
  });

  it('returns arrivalMinutes for terminal stop', () => {
    const entry = makeEntry({ departureMinutes: 600, arrivalMinutes: 598, isTerminal: true });
    expect(getDisplayMinutes(entry)).toBe(598);
  });

  it('returns departureMinutes when arrival equals departure (non-terminal)', () => {
    const entry = makeEntry({ departureMinutes: 480, arrivalMinutes: 480, isTerminal: false });
    expect(getDisplayMinutes(entry)).toBe(480);
  });

  it('returns arrivalMinutes when arrival equals departure (terminal)', () => {
    const entry = makeEntry({ departureMinutes: 480, arrivalMinutes: 480, isTerminal: true });
    expect(getDisplayMinutes(entry)).toBe(480);
  });

  it('handles overnight times (>= 1440)', () => {
    const entry = makeEntry({ departureMinutes: 1500, arrivalMinutes: 1498, isTerminal: false });
    expect(getDisplayMinutes(entry)).toBe(1500);
  });

  it('handles overnight terminal times (>= 1440)', () => {
    const entry = makeEntry({ departureMinutes: 1500, arrivalMinutes: 1498, isTerminal: true });
    expect(getDisplayMinutes(entry)).toBe(1498);
  });
});

// -------------------------------------------------------------------------
// getStopServiceState
// -------------------------------------------------------------------------

describe('getStopServiceState', () => {
  function makeInput(overrides: Partial<StopServiceStateInput> = {}): StopServiceStateInput {
    return {
      isBoardableOnServiceDay: overrides.isBoardableOnServiceDay ?? false,
      totalEntries: overrides.totalEntries ?? 0,
    };
  }

  it('returns "no-service" when totalEntries is 0', () => {
    expect(
      getStopServiceState(makeInput({ totalEntries: 0, isBoardableOnServiceDay: false })),
    ).toBe('no-service');
  });

  it('returns "no-service" even if isBoardableOnServiceDay is true (defensive)', () => {
    // This combination should not happen in practice, but the totalEntries
    // signal takes precedence — no entries means no service regardless.
    expect(getStopServiceState(makeInput({ totalEntries: 0, isBoardableOnServiceDay: true }))).toBe(
      'no-service',
    );
  });

  it('returns "drop-off-only" when entries exist but none are boardable', () => {
    expect(
      getStopServiceState(makeInput({ totalEntries: 5, isBoardableOnServiceDay: false })),
    ).toBe('drop-off-only');
  });

  it('returns "boardable" when at least one boardable entry exists', () => {
    expect(
      getStopServiceState(makeInput({ totalEntries: 10, isBoardableOnServiceDay: true })),
    ).toBe('boardable');
  });

  it('returns "boardable" for a single-entry boardable stop', () => {
    expect(getStopServiceState(makeInput({ totalEntries: 1, isBoardableOnServiceDay: true }))).toBe(
      'boardable',
    );
  });

  it('returns "drop-off-only" for a single-entry non-boardable stop', () => {
    expect(
      getStopServiceState(makeInput({ totalEntries: 1, isBoardableOnServiceDay: false })),
    ).toBe('drop-off-only');
  });
});

// ---------------------------------------------------------------------------
// getTimetableEntriesState
// ---------------------------------------------------------------------------

describe('getTimetableEntriesState', () => {
  it('returns "no-service" for empty entries', () => {
    expect(getTimetableEntriesState([])).toBe('no-service');
  });

  it('returns "boardable" when at least one entry is boardable', () => {
    const entries = [makeEntry(), makeEntry({ pickupType: 1 })];
    expect(getTimetableEntriesState(entries)).toBe('boardable');
  });

  it('returns "drop-off-only" when all entries are drop-off only (pickupType)', () => {
    const entries = [makeEntry({ pickupType: 1 }), makeEntry({ pickupType: 1 })];
    expect(getTimetableEntriesState(entries)).toBe('drop-off-only');
  });

  it('returns "drop-off-only" when all entries are terminal', () => {
    const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
    expect(getTimetableEntriesState(entries)).toBe('drop-off-only');
  });

  it('returns "boardable" when mixed boardable and terminal entries', () => {
    const entries = [makeEntry(), makeEntry({ isTerminal: true })];
    expect(getTimetableEntriesState(entries)).toBe('boardable');
  });

  it('returns "boardable" for a single boardable entry', () => {
    expect(getTimetableEntriesState([makeEntry()])).toBe('boardable');
  });

  it('returns "drop-off-only" for a single terminal entry', () => {
    expect(getTimetableEntriesState([makeEntry({ isTerminal: true })])).toBe('drop-off-only');
  });
});

// ---------------------------------------------------------------------------
// getFilteredTimetableEntriesState
// ---------------------------------------------------------------------------

describe('getFilteredTimetableEntriesState', () => {
  // Matrix of all physically-reachable (stopServiceState, upcomingEntriesState,
  // filteredEntriesState) combinations. The function is purely combinatorial,
  // so we enumerate the truth table directly.
  //
  // Constraints:
  //   - filtered is a subset of upcoming → if upcoming='no-service', filtered must be 'no-service'
  //   - upcoming is a subset of full-day → if stopServiceState='no-service', upcoming must be 'no-service'

  it('returns "no-service" when the repo has no data for this stop (case 1)', () => {
    expect(getFilteredTimetableEntriesState('no-service', 'no-service', 'no-service')).toBe(
      'no-service',
    );
  });

  it('returns "service-ended" when boardable repo but upcoming is empty (case 2, late-night)', () => {
    expect(getFilteredTimetableEntriesState('boardable', 'no-service', 'no-service')).toBe(
      'service-ended',
    );
  });

  it('returns "service-ended" when drop-off-only repo but upcoming is empty (case 3, late-night)', () => {
    expect(getFilteredTimetableEntriesState('drop-off-only', 'no-service', 'no-service')).toBe(
      'service-ended',
    );
  });

  it('returns "filter-hidden" when boardable repo + boardable upcoming but filtered empty (case 4)', () => {
    expect(getFilteredTimetableEntriesState('boardable', 'boardable', 'no-service')).toBe(
      'filter-hidden',
    );
  });

  it('returns "filter-hidden" when boardable repo + drop-off-only upcoming but filtered empty (case 5)', () => {
    expect(getFilteredTimetableEntriesState('boardable', 'drop-off-only', 'no-service')).toBe(
      'filter-hidden',
    );
  });

  it('returns "filter-hidden" when drop-off-only repo + drop-off-only upcoming but filtered empty (case 6)', () => {
    expect(getFilteredTimetableEntriesState('drop-off-only', 'drop-off-only', 'no-service')).toBe(
      'filter-hidden',
    );
  });

  it('returns "boardable" when boardable at every level (case 7, normal display)', () => {
    expect(getFilteredTimetableEntriesState('boardable', 'boardable', 'boardable')).toBe(
      'boardable',
    );
  });

  it('returns "drop-off-only" when filter removed all boardable from a boardable upcoming (case 8)', () => {
    expect(getFilteredTimetableEntriesState('boardable', 'boardable', 'drop-off-only')).toBe(
      'drop-off-only',
    );
  });

  it('returns "drop-off-only" when boardable repo but upcoming is already drop-off-only (case 9)', () => {
    expect(getFilteredTimetableEntriesState('boardable', 'drop-off-only', 'drop-off-only')).toBe(
      'drop-off-only',
    );
  });

  it('returns "drop-off-only" when drop-off-only at every level (case 10)', () => {
    expect(
      getFilteredTimetableEntriesState('drop-off-only', 'drop-off-only', 'drop-off-only'),
    ).toBe('drop-off-only');
  });

  it('stopServiceState="no-service" dominates regardless of other inputs (defensive)', () => {
    // These combinations are physically impossible (filtered cannot exist
    // if repo says no-service), but the function must remain total — the
    // repo's truth takes precedence.
    expect(getFilteredTimetableEntriesState('no-service', 'boardable', 'boardable')).toBe(
      'no-service',
    );
    expect(getFilteredTimetableEntriesState('no-service', 'drop-off-only', 'drop-off-only')).toBe(
      'no-service',
    );
  });
});
