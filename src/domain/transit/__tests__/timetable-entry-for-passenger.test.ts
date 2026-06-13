import { describe, it, expect } from 'vitest';
import {
  isAlightableForPassenger,
  isAlightableForPassengerBySignal,
  isAlightableForPassengerBySignalAndPosition,
  isBoardableForPassenger,
  isBoardableForPassengerBySignal,
  isBoardableForPassengerBySignalAndPosition,
  isEndpointSignalTrustedByPrefix,
  isEndpointSignalTrustedByRoute,
} from '../timetable-entry-for-passenger';
import type { Route } from '../../../types/app/transit';
import { makeEntry } from './make-timetable-entry';

// ---------------------------------------------------------------------------
// isEndpointSignalTrustedByRoute (per-source endpoint-signal trust policy)
// ---------------------------------------------------------------------------

function routeWithId(routeId: string): Route {
  return {
    route_id: routeId,
    route_type: 1,
    agency_id: `${routeId.split(':')[0]}:agency`,
    route_short_name: '',
    route_short_names: {},
    route_long_name: '',
    route_long_names: {},
    route_color: '000000',
    route_text_color: 'FFFFFF',
  };
}

describe('isEndpointSignalTrustedByPrefix', () => {
  it('trusts the configured through-running rail/subway source prefixes', () => {
    expect(isEndpointSignalTrustedByPrefix('tome')).toBe(true);
    expect(isEndpointSignalTrustedByPrefix('twrr')).toBe(true);
    expect(isEndpointSignalTrustedByPrefix('toaran')).toBe(true);
  });

  it('does not trust prefixes outside the set', () => {
    expect(isEndpointSignalTrustedByPrefix('minkuru')).toBe(false);
    expect(isEndpointSignalTrustedByPrefix('kobus')).toBe(false);
    expect(isEndpointSignalTrustedByPrefix('')).toBe(false);
  });
});

describe('isEndpointSignalTrustedByRoute', () => {
  it('trusts through-running rail/subway sources whose endpoint signals are spec-correct', () => {
    expect(isEndpointSignalTrustedByRoute(routeWithId('tome:5'))).toBe(true); // Tokyo Metro
    expect(isEndpointSignalTrustedByRoute(routeWithId('twrr:1'))).toBe(true); // TWR Rinkai
    expect(isEndpointSignalTrustedByRoute(routeWithId('toaran:4'))).toBe(true); // Toei Train
  });

  it('does not trust sources outside the set (absence is not a reliability judgment)', () => {
    expect(isEndpointSignalTrustedByRoute(routeWithId('minkuru:1'))).toBe(false); // Toei Bus
    expect(isEndpointSignalTrustedByRoute(routeWithId('kobus:10'))).toBe(false); // Keio Bus (diligent but no through-running)
    expect(isEndpointSignalTrustedByRoute(routeWithId('yht:3'))).toBe(false); // Yokohama Municipal Subway
    expect(isEndpointSignalTrustedByRoute(routeWithId('unknown:1'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBoardableForPassenger (PROVISIONAL interim rule: signal boardable && not last stop)
// ---------------------------------------------------------------------------

describe('isBoardableForPassenger', () => {
  it('returns true for a regular mid-route stop (pickupType 0)', () => {
    expect(isBoardableForPassenger(makeEntry({ pickupType: 0 }))).toBe(true);
  });

  it('returns true for the first stop (a trip departs from its first stop)', () => {
    expect(isBoardableForPassenger(makeEntry({ pickupType: 0, isFirstStop: true }))).toBe(true);
  });

  it('returns false when pickupType is 1 (no pickup available)', () => {
    expect(isBoardableForPassenger(makeEntry({ pickupType: 1 }))).toBe(false);
  });

  it('returns false for the last stop even when the signal says boardable', () => {
    expect(isBoardableForPassenger(makeEntry({ pickupType: 0, isLastStop: true }))).toBe(false);
  });

  it('returns false for the last stop with pickupType 1 (both reasons)', () => {
    expect(isBoardableForPassenger(makeEntry({ pickupType: 1, isLastStop: true }))).toBe(false);
  });

  it('returns true for arrangement-required boarding (pickupType 2 / 3) mid-route', () => {
    expect(isBoardableForPassenger(makeEntry({ pickupType: 2 }))).toBe(true);
    expect(isBoardableForPassenger(makeEntry({ pickupType: 3 }))).toBe(true);
  });

  it('ignores dropOffType', () => {
    expect(isBoardableForPassenger(makeEntry({ pickupType: 0, dropOffType: 1 }))).toBe(true);
  });

  it('returns false for a single-stop pattern (isFirstStop && isLastStop) under the interim rule', () => {
    // Current PROVISIONAL behavior: the last-stop inference wins even on
    // single-stop patterns (e.g. Tokyo Metro through-trips onto JR with one
    // served row at Ayase, pickup 0). Revisiting this is part of Issue #162.
    expect(
      isBoardableForPassenger(makeEntry({ pickupType: 0, isFirstStop: true, isLastStop: true })),
    ).toBe(false);
  });

  it('releases a last-stop boardable row for an endpoint-signal-trusted source', () => {
    // tome (Tokyo Metro) is endpoint-signal-trusted, so the selector judges
    // by signal alone: a last-stop through-service row stays boardable.
    expect(
      isBoardableForPassenger(
        makeEntry({ pickupType: 0, isLastStop: true, route: routeWithId('tome:5') }),
      ),
    ).toBe(true);
  });

  it('matches the interim truth table for every signal/position combination', () => {
    // Expected = boardable per the signal (pickupType !== 1) and not the
    // pattern's last stop. isFirstStop never affects the result. Written as
    // literal expectations so the spec is pinned independently of any
    // implementation expression.
    const pickupTypes = [0, 1, 2, 3] as const;
    const flags = [false, true] as const;
    for (const pickupType of pickupTypes) {
      for (const isFirstStop of flags) {
        for (const isLastStop of flags) {
          const expected = !isLastStop && pickupType !== 1;
          const entry = makeEntry({ pickupType, isFirstStop, isLastStop });
          expect(
            isBoardableForPassenger(entry),
            `pickup=${pickupType} first=${isFirstStop} last=${isLastStop}`,
          ).toBe(expected);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isBoardableForPassengerBySignal
// ---------------------------------------------------------------------------

describe('isBoardableForPassengerBySignal', () => {
  it('judges from the raw pickup_type alone, ignoring the position', () => {
    expect(isBoardableForPassengerBySignal(0)).toBe(true);
    expect(isBoardableForPassengerBySignal(1)).toBe(false);
    expect(isBoardableForPassengerBySignal(2)).toBe(true);
    expect(isBoardableForPassengerBySignal(3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isBoardableForPassengerBySignalAndPosition
// ---------------------------------------------------------------------------

describe('isBoardableForPassengerBySignalAndPosition', () => {
  it('judges from the raw pickup_type and the last-stop flag', () => {
    expect(isBoardableForPassengerBySignalAndPosition(0, false)).toBe(true);
    expect(isBoardableForPassengerBySignalAndPosition(1, false)).toBe(false);
    expect(isBoardableForPassengerBySignalAndPosition(0, true)).toBe(false);
    expect(isBoardableForPassengerBySignalAndPosition(2, false)).toBe(true);
    expect(isBoardableForPassengerBySignalAndPosition(3, false)).toBe(true);
  });

  it('matches isBoardableForPassenger for every signal/position combination', () => {
    // makeEntry's route prefix ('r1') is not endpoint-signal-trusted, so
    // isBoardableForPassenger selects this signal-and-position form. This
    // pins the equivalence from the other side so the two cannot drift apart.
    const pickupTypes = [0, 1, 2, 3] as const;
    const flags = [false, true] as const;
    for (const pickupType of pickupTypes) {
      for (const isFirstStop of flags) {
        for (const isLastStop of flags) {
          const entry = makeEntry({ pickupType, isFirstStop, isLastStop });
          expect(
            isBoardableForPassengerBySignalAndPosition(pickupType, isLastStop),
            `pickup=${pickupType} first=${isFirstStop} last=${isLastStop}`,
          ).toBe(isBoardableForPassenger(entry));
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isAlightableForPassenger (PROVISIONAL interim rule: signal alightable && not first stop)
// ---------------------------------------------------------------------------

describe('isAlightableForPassenger', () => {
  it('returns true for a regular mid-route stop (dropOffType 0)', () => {
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 0 }))).toBe(true);
  });

  it('returns true for the last stop (a trip arrives at its last stop)', () => {
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 0, isLastStop: true }))).toBe(true);
  });

  it('returns false when dropOffType is 1 (no drop off available)', () => {
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 1 }))).toBe(false);
  });

  it('returns false for the first stop even when the signal says alightable', () => {
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 0, isFirstStop: true }))).toBe(false);
  });

  it('returns false for the first stop with dropOffType 1 (both reasons)', () => {
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 1, isFirstStop: true }))).toBe(false);
  });

  it('returns true for arrangement-required alighting (dropOffType 2 / 3) mid-route', () => {
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 2 }))).toBe(true);
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 3 }))).toBe(true);
  });

  it('ignores pickupType', () => {
    expect(isAlightableForPassenger(makeEntry({ dropOffType: 0, pickupType: 1 }))).toBe(true);
  });

  it('returns false for a single-stop pattern (isFirstStop && isLastStop) under the interim rule', () => {
    // Mirror of the isBoardableForPassenger single-stop case; see Issue #162.
    expect(
      isAlightableForPassenger(makeEntry({ dropOffType: 0, isFirstStop: true, isLastStop: true })),
    ).toBe(false);
  });

  it('releases a first-stop alightable row for an endpoint-signal-trusted source', () => {
    // tome (Tokyo Metro) is endpoint-signal-trusted, so the selector judges
    // by signal alone: a first-stop through-service arrival stays alightable.
    expect(
      isAlightableForPassenger(
        makeEntry({ dropOffType: 0, isFirstStop: true, route: routeWithId('tome:5') }),
      ),
    ).toBe(true);
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
            isAlightableForPassenger(entry),
            `dropOff=${dropOffType} first=${isFirstStop} last=${isLastStop}`,
          ).toBe(expected);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isAlightableForPassengerBySignal
// ---------------------------------------------------------------------------

describe('isAlightableForPassengerBySignal', () => {
  it('judges from the raw drop_off_type alone, ignoring the position', () => {
    expect(isAlightableForPassengerBySignal(0)).toBe(true);
    expect(isAlightableForPassengerBySignal(1)).toBe(false);
    expect(isAlightableForPassengerBySignal(2)).toBe(true);
    expect(isAlightableForPassengerBySignal(3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isAlightableForPassengerBySignalAndPosition
// ---------------------------------------------------------------------------

describe('isAlightableForPassengerBySignalAndPosition', () => {
  it('judges from the raw drop_off_type and the first-stop flag', () => {
    expect(isAlightableForPassengerBySignalAndPosition(0, false)).toBe(true);
    expect(isAlightableForPassengerBySignalAndPosition(1, false)).toBe(false);
    expect(isAlightableForPassengerBySignalAndPosition(0, true)).toBe(false);
    expect(isAlightableForPassengerBySignalAndPosition(2, false)).toBe(true);
    expect(isAlightableForPassengerBySignalAndPosition(3, false)).toBe(true);
  });

  it('matches isAlightableForPassenger for every signal/position combination', () => {
    // makeEntry's route prefix ('r1') is not endpoint-signal-trusted, so
    // isAlightableForPassenger selects this signal-and-position form. This
    // pins the equivalence from the other side so the two cannot drift apart.
    const dropOffTypes = [0, 1, 2, 3] as const;
    const flags = [false, true] as const;
    for (const dropOffType of dropOffTypes) {
      for (const isFirstStop of flags) {
        for (const isLastStop of flags) {
          const entry = makeEntry({ dropOffType, isFirstStop, isLastStop });
          expect(
            isAlightableForPassengerBySignalAndPosition(dropOffType, isFirstStop),
            `dropOff=${dropOffType} first=${isFirstStop} last=${isLastStop}`,
          ).toBe(isAlightableForPassenger(entry));
        }
      }
    }
  });
});
