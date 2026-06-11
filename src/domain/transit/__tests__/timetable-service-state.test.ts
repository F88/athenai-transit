import { describe, it, expect } from 'vitest';
import {
  getFilteredTimetableEntriesState,
  getStopServiceState,
  getTimetableEntriesState,
  hasBoardable,
} from '../timetable-service-state';
import { makeEntry } from './make-timetable-entry';
import type { StopServiceStateInput } from '../../../types/app/transit';

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
// getStopServiceState
// ---------------------------------------------------------------------------

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
