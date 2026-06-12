import { describe, it, expect } from 'vitest';
import { canAlight, canBoard, isArrival, isDeparture } from '../timetable-entry-for-passenger';
import { isDropOffOnly } from '../timetable-entry-boarding';
import { makeEntry } from './make-timetable-entry';

// ---------------------------------------------------------------------------
// canBoard
// ---------------------------------------------------------------------------

describe('canBoard', () => {
  it('returns true for pickupType 0 (regularly scheduled pickup)', () => {
    expect(canBoard(makeEntry({ pickupType: 0 }))).toBe(true);
  });

  it('returns false for pickupType 1 (no pickup available)', () => {
    expect(canBoard(makeEntry({ pickupType: 1 }))).toBe(false);
  });

  it('returns true for pickupType 2 (must phone agency)', () => {
    expect(canBoard(makeEntry({ pickupType: 2 }))).toBe(true);
  });

  it('returns true for pickupType 3 (must coordinate with driver)', () => {
    expect(canBoard(makeEntry({ pickupType: 3 }))).toBe(true);
  });

  it('ignores pattern position (signal-only): last stop with pickupType 0', () => {
    expect(canBoard(makeEntry({ pickupType: 0, isLastStop: true }))).toBe(true);
  });

  it('ignores pattern position (signal-only): single-stop pattern', () => {
    expect(canBoard(makeEntry({ pickupType: 0, isFirstStop: true, isLastStop: true }))).toBe(true);
  });

  it('ignores dropOffType', () => {
    expect(canBoard(makeEntry({ pickupType: 0, dropOffType: 1 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canAlight
// ---------------------------------------------------------------------------

describe('canAlight', () => {
  it('returns true for dropOffType 0 (regularly scheduled drop off)', () => {
    expect(canAlight(makeEntry({ dropOffType: 0 }))).toBe(true);
  });

  it('returns false for dropOffType 1 (no drop off available)', () => {
    expect(canAlight(makeEntry({ dropOffType: 1 }))).toBe(false);
  });

  it('returns true for dropOffType 2 (must phone agency)', () => {
    expect(canAlight(makeEntry({ dropOffType: 2 }))).toBe(true);
  });

  it('returns true for dropOffType 3 (must coordinate with driver)', () => {
    expect(canAlight(makeEntry({ dropOffType: 3 }))).toBe(true);
  });

  it('ignores pattern position (signal-only): first stop with dropOffType 0', () => {
    expect(canAlight(makeEntry({ dropOffType: 0, isFirstStop: true }))).toBe(true);
  });

  it('ignores pattern position (signal-only): single-stop pattern', () => {
    expect(canAlight(makeEntry({ dropOffType: 0, isFirstStop: true, isLastStop: true }))).toBe(
      true,
    );
  });

  it('ignores pickupType', () => {
    expect(canAlight(makeEntry({ dropOffType: 0, pickupType: 1 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isDeparture (PROVISIONAL interim rule: canBoard && !isLastStop)
// ---------------------------------------------------------------------------

describe('isDeparture', () => {
  it('returns true for a regular mid-route stop (pickupType 0)', () => {
    expect(isDeparture(makeEntry({ pickupType: 0 }))).toBe(true);
  });

  it('returns true for the first stop (a trip departs from its first stop)', () => {
    expect(isDeparture(makeEntry({ pickupType: 0, isFirstStop: true }))).toBe(true);
  });

  it('returns false when pickupType is 1 (no pickup available)', () => {
    expect(isDeparture(makeEntry({ pickupType: 1 }))).toBe(false);
  });

  it('returns false for the last stop even when the signal says boardable', () => {
    expect(isDeparture(makeEntry({ pickupType: 0, isLastStop: true }))).toBe(false);
  });

  it('returns false for the last stop with pickupType 1 (both reasons)', () => {
    expect(isDeparture(makeEntry({ pickupType: 1, isLastStop: true }))).toBe(false);
  });

  it('returns true for arrangement-required boarding (pickupType 2 / 3) mid-route', () => {
    expect(isDeparture(makeEntry({ pickupType: 2 }))).toBe(true);
    expect(isDeparture(makeEntry({ pickupType: 3 }))).toBe(true);
  });

  it('ignores dropOffType', () => {
    expect(isDeparture(makeEntry({ pickupType: 0, dropOffType: 1 }))).toBe(true);
  });

  it('returns false for a single-stop pattern (isFirstStop && isLastStop) under the interim rule', () => {
    // Current PROVISIONAL behavior: the last-stop inference wins even on
    // single-stop patterns (e.g. Tokyo Metro through-trips onto JR with one
    // served row at Ayase, pickup 0). Revisiting this is part of Issue #162.
    expect(isDeparture(makeEntry({ pickupType: 0, isFirstStop: true, isLastStop: true }))).toBe(
      false,
    );
  });

  it('equals !isDropOffOnly for every signal/position combination', () => {
    const pickupTypes = [0, 1, 2, 3] as const;
    const flags = [false, true] as const;
    for (const pickupType of pickupTypes) {
      for (const isFirstStop of flags) {
        for (const isLastStop of flags) {
          const entry = makeEntry({ pickupType, isFirstStop, isLastStop });
          expect(
            isDeparture(entry),
            `pickup=${pickupType} first=${isFirstStop} last=${isLastStop}`,
          ).toBe(!isDropOffOnly(entry));
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isArrival (PROVISIONAL interim rule: canAlight && !isFirstStop)
// ---------------------------------------------------------------------------

describe('isArrival', () => {
  it('returns true for a regular mid-route stop (dropOffType 0)', () => {
    expect(isArrival(makeEntry({ dropOffType: 0 }))).toBe(true);
  });

  it('returns true for the last stop (a trip arrives at its last stop)', () => {
    expect(isArrival(makeEntry({ dropOffType: 0, isLastStop: true }))).toBe(true);
  });

  it('returns false when dropOffType is 1 (no drop off available)', () => {
    expect(isArrival(makeEntry({ dropOffType: 1 }))).toBe(false);
  });

  it('returns false for the first stop even when the signal says alightable', () => {
    expect(isArrival(makeEntry({ dropOffType: 0, isFirstStop: true }))).toBe(false);
  });

  it('returns false for the first stop with dropOffType 1 (both reasons)', () => {
    expect(isArrival(makeEntry({ dropOffType: 1, isFirstStop: true }))).toBe(false);
  });

  it('returns true for arrangement-required alighting (dropOffType 2 / 3) mid-route', () => {
    expect(isArrival(makeEntry({ dropOffType: 2 }))).toBe(true);
    expect(isArrival(makeEntry({ dropOffType: 3 }))).toBe(true);
  });

  it('ignores pickupType', () => {
    expect(isArrival(makeEntry({ dropOffType: 0, pickupType: 1 }))).toBe(true);
  });

  it('returns false for a single-stop pattern (isFirstStop && isLastStop) under the interim rule', () => {
    // Mirror of the isDeparture single-stop case; see Issue #162.
    expect(isArrival(makeEntry({ dropOffType: 0, isFirstStop: true, isLastStop: true }))).toBe(
      false,
    );
  });

  it('matches the interim truth table for every signal/position combination', () => {
    // Expected = alightable per the signal (dropOffType !== 1) and not the
    // pattern's first stop. isLastStop never affects the result. Written as
    // literal expectations so the spec is pinned independently of any
    // implementation expression.
    const dropOffTypes = [0, 1, 2, 3] as const;
    const flags = [false, true] as const;
    for (const dropOffType of dropOffTypes) {
      for (const isFirstStop of flags) {
        for (const isLastStop of flags) {
          const expected = !isFirstStop && dropOffType !== 1;
          const entry = makeEntry({ dropOffType, isFirstStop, isLastStop });
          expect(
            isArrival(entry),
            `dropOff=${dropOffType} first=${isFirstStop} last=${isLastStop}`,
          ).toBe(expected);
        }
      }
    }
  });
});
