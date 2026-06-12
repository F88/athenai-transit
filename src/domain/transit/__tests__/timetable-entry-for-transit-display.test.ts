import { describe, it, expect } from 'vitest';
import {
  isAlightableForPassenger,
  isBoardableForPassenger,
} from '../timetable-entry-for-passenger';
import { isArrival, isDeparture } from '../timetable-entry-for-transit-display';
import { makeEntry } from './make-timetable-entry';

// The display-context judgments currently delegate to the
// passenger-perspective judgments; these tests pin a few literal
// expectations and the full delegation equivalence so any future
// display-policy divergence is a deliberate, test-visible change.

// ---------------------------------------------------------------------------
// isDeparture
// ---------------------------------------------------------------------------

describe('isDeparture', () => {
  it('presents a regular mid-route stop (pickupType 0) as a departure', () => {
    expect(isDeparture(makeEntry({ pickupType: 0 }))).toBe(true);
  });

  it('does not present the last stop as a departure even when the signal says boardable', () => {
    expect(isDeparture(makeEntry({ pickupType: 0, isLastStop: true }))).toBe(false);
  });

  it('matches isBoardableForPassenger for every signal/position combination', () => {
    // Both signals are varied so the equivalence also pins that a future
    // divergent implementation must not start reading the opposite signal.
    const serviceTypes = [0, 1, 2, 3] as const;
    const flags = [false, true] as const;
    for (const pickupType of serviceTypes) {
      for (const dropOffType of serviceTypes) {
        for (const isFirstStop of flags) {
          for (const isLastStop of flags) {
            const entry = makeEntry({ pickupType, dropOffType, isFirstStop, isLastStop });
            expect(
              isDeparture(entry),
              `pickup=${pickupType} dropOff=${dropOffType} first=${isFirstStop} last=${isLastStop}`,
            ).toBe(isBoardableForPassenger(entry));
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isArrival
// ---------------------------------------------------------------------------

describe('isArrival', () => {
  it('presents a regular mid-route stop (dropOffType 0) as an arrival', () => {
    expect(isArrival(makeEntry({ dropOffType: 0 }))).toBe(true);
  });

  it('does not present the first stop as an arrival even when the signal says alightable', () => {
    expect(isArrival(makeEntry({ dropOffType: 0, isFirstStop: true }))).toBe(false);
  });

  it('matches isAlightableForPassenger for every signal/position combination', () => {
    // Both signals are varied so the equivalence also pins that a future
    // divergent implementation must not start reading the opposite signal.
    const serviceTypes = [0, 1, 2, 3] as const;
    const flags = [false, true] as const;
    for (const pickupType of serviceTypes) {
      for (const dropOffType of serviceTypes) {
        for (const isFirstStop of flags) {
          for (const isLastStop of flags) {
            const entry = makeEntry({ pickupType, dropOffType, isFirstStop, isLastStop });
            expect(
              isArrival(entry),
              `pickup=${pickupType} dropOff=${dropOffType} first=${isFirstStop} last=${isLastStop}`,
            ).toBe(isAlightableForPassenger(entry));
          }
        }
      }
    }
  });
});
