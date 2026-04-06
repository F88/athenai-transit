import { describe, it, expect } from 'vitest';
import {
  isDropOffOnly,
  isBoardingOnly,
  isPassThrough,
  requiresArrangement,
  hasDwellTime,
  getDwellMinutes,
  getRemainingMinutes,
  hasBoardableDeparture,
  filterBoardable,
  getDisplayMinutes,
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

function makeRoute(id: string, agencyId = 'test:agency'): Route {
  return {
    route_id: id,
    route_short_name: id,
    route_long_name: '',
    route_names: {},
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
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes ?? 480,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes ?? 480,
    },
    routeDirection: {
      route: overrides.route ?? testRoute,
      tripHeadsign: { name: overrides.headsign ?? 'Test Terminal', names: {} },
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

// ---------------------------------------------------------------------------
// hasBoardableDeparture
// ---------------------------------------------------------------------------

describe('hasBoardableDeparture', () => {
  it('returns false for empty array', () => {
    expect(hasBoardableDeparture([])).toBe(false);
  });

  it('returns true when at least one entry is boardable', () => {
    expect(hasBoardableDeparture([makeEntry(), makeEntry({ pickupType: 1 })])).toBe(true);
  });

  it('returns false when all entries are drop-off only (pickupType=1)', () => {
    expect(
      hasBoardableDeparture([makeEntry({ pickupType: 1 }), makeEntry({ pickupType: 1 })]),
    ).toBe(false);
  });

  it('returns false when all entries are terminal (pattern inference)', () => {
    expect(
      hasBoardableDeparture([makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })]),
    ).toBe(false);
  });

  it('returns true when terminal is mixed with non-terminal', () => {
    expect(hasBoardableDeparture([makeEntry({ isTerminal: true }), makeEntry()])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterBoardable
// ---------------------------------------------------------------------------

describe('filterBoardable', () => {
  describe('empty input', () => {
    it('returns empty array', () => {
      expect(filterBoardable([])).toEqual([]);
    });
  });

  describe('all boardable (!isDropOffOnly)', () => {
    it('returns single entry', () => {
      expect(filterBoardable([makeEntry()])).toHaveLength(1);
    });

    it('returns all entries', () => {
      expect(filterBoardable([makeEntry(), makeEntry(), makeEntry()])).toHaveLength(3);
    });

    it('keeps isOrigin entries', () => {
      expect(filterBoardable([makeEntry({ isOrigin: true })])).toHaveLength(1);
    });

    it('keeps pickupType=0 (available)', () => {
      expect(filterBoardable([makeEntry({ pickupType: 0 })])).toHaveLength(1);
    });

    it('keeps pickupType=2 (phone required) — requires arrangement but boardable', () => {
      expect(filterBoardable([makeEntry({ pickupType: 2 })])).toHaveLength(1);
    });

    it('keeps pickupType=3 (coordinate required) — requires arrangement but boardable', () => {
      expect(filterBoardable([makeEntry({ pickupType: 3 })])).toHaveLength(1);
    });
  });

  describe('all isDropOffOnly', () => {
    it('filters single terminal entry', () => {
      expect(filterBoardable([makeEntry({ isTerminal: true })])).toHaveLength(0);
    });

    it('filters single pickupType=1 entry', () => {
      expect(filterBoardable([makeEntry({ pickupType: 1 })])).toHaveLength(0);
    });

    it('filters multiple terminal entries', () => {
      const entries = [makeEntry({ isTerminal: true }), makeEntry({ isTerminal: true })];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('filters multiple pickupType=1 entries', () => {
      const entries = [makeEntry({ pickupType: 1 }), makeEntry({ pickupType: 1 })];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('filters when both isTerminal and pickupType=1 are set', () => {
      expect(filterBoardable([makeEntry({ isTerminal: true, pickupType: 1 })])).toHaveLength(0);
    });

    it('filters mix of terminal and pickupType=1', () => {
      const entries = [
        makeEntry({ isTerminal: true }),
        makeEntry({ pickupType: 1 }),
        makeEntry({ isTerminal: true, pickupType: 1 }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });
  });

  describe('mixed boardable and isDropOffOnly', () => {
    it('keeps boardable, filters terminal', () => {
      const boardable = makeEntry();
      const terminal = makeEntry({ isTerminal: true });
      expect(filterBoardable([terminal, boardable])).toEqual([boardable]);
    });

    it('keeps boardable, filters pickupType=1', () => {
      const boardable = makeEntry();
      const pickup1 = makeEntry({ pickupType: 1 });
      expect(filterBoardable([pickup1, boardable])).toEqual([boardable]);
    });

    it('keeps boardable, filters both terminal and pickupType=1', () => {
      const boardable = makeEntry();
      const terminal = makeEntry({ isTerminal: true });
      const pickup1 = makeEntry({ pickupType: 1 });
      expect(filterBoardable([terminal, boardable, pickup1])).toEqual([boardable]);
    });

    it('preserves order of boardable entries', () => {
      const a = makeEntry({ departureMinutes: 480 });
      const b = makeEntry({ departureMinutes: 540 });
      const c = makeEntry({ departureMinutes: 600 });
      const term = makeEntry({ departureMinutes: 500, isTerminal: true });
      expect(filterBoardable([a, term, b, c]).map((e) => e.schedule.departureMinutes)).toEqual([
        480, 540, 600,
      ]);
    });
  });

  describe('multi-route / multi-agency', () => {
    const routeA = makeRoute('route-A', 'agency-1');
    const routeB = makeRoute('route-B', 'agency-2');

    it('filters per-entry regardless of route (mixed agencies)', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true }), // agency-1, terminal
        makeEntry({ route: routeB }), // agency-2, boardable
        makeEntry({ route: routeA }), // agency-1, boardable
        makeEntry({ route: routeB, pickupType: 1 }), // agency-2, pickup unavailable
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result[0].routeDirection.route.route_id).toBe('route-B');
      expect(result[1].routeDirection.route.route_id).toBe('route-A');
    });

    it('returns empty when all routes are terminal (single agency)', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true }),
        makeEntry({ route: routeA, isTerminal: true }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('returns empty when all routes are drop-off only (multiple agencies)', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true }),
        makeEntry({ route: routeB, pickupType: 1 }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('keeps boardable entries from one agency while filtering terminal from another', () => {
      const entries = [
        makeEntry({ route: routeA, isTerminal: true, departureMinutes: 480 }),
        makeEntry({ route: routeB, departureMinutes: 490 }),
        makeEntry({ route: routeA, isTerminal: true, departureMinutes: 500 }),
        makeEntry({ route: routeB, departureMinutes: 510 }),
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.routeDirection.route.agency_id === 'agency-2')).toBe(true);
    });
  });

  describe('turnaround stop (同一路線で ORIG/TERM 交互 — 日野駅パターン)', () => {
    it('keeps ORIG entries and filters TERM entries from same route', () => {
      const route = makeRoute('route-bus');
      const entries = [
        makeEntry({ route, departureMinutes: 1255, isTerminal: true, pickupType: 1 }), // 20:55 着
        makeEntry({ route, departureMinutes: 1258, isTerminal: true, pickupType: 1 }), // 20:58 着
        makeEntry({ route, departureMinutes: 1260, isOrigin: true, pickupType: 0 }), // 21:00 発
        makeEntry({ route, departureMinutes: 1265, isTerminal: true, pickupType: 1 }), // 21:05 着
        makeEntry({ route, departureMinutes: 1270, isOrigin: true, pickupType: 0 }), // 21:10 発
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.schedule.departureMinutes)).toEqual([1260, 1270]);
    });
  });

  describe('pt=0 with isTerminal fallback (都バス — pt 未設定ソース)', () => {
    it('filters all entries when pt=0 but all are terminal', () => {
      // 都バスは pickup_type を設定しない (全て 0)。
      // isTerminal フォールバックで終点を検出。
      const entries = [
        makeEntry({ pickupType: 0, isTerminal: true, departureMinutes: 480 }),
        makeEntry({ pickupType: 0, isTerminal: true, departureMinutes: 540 }),
        makeEntry({ pickupType: 0, isTerminal: true, departureMinutes: 600 }),
      ];
      expect(filterBoardable(entries)).toHaveLength(0);
    });

    it('keeps non-terminal entries when pt=0', () => {
      const entries = [
        makeEntry({ pickupType: 0, isTerminal: true }),
        makeEntry({ pickupType: 0, isTerminal: false }),
        makeEntry({ pickupType: 0, isOrigin: true }),
      ];
      expect(filterBoardable(entries)).toHaveLength(2);
    });
  });

  describe('mid-route pickup unavailable (途中停留所で pt=1)', () => {
    it('filters pt=1 entry that is not terminal', () => {
      // 途中停留所だが乗車不可 — 本来の「降車専用」
      const entry = makeEntry({ pickupType: 1, isTerminal: false, stopIndex: 5, totalStops: 10 });
      expect(filterBoardable([entry])).toHaveLength(0);
    });

    it('keeps other entries at same stop when only some have pt=1', () => {
      const route = makeRoute('route-express');
      const entries = [
        makeEntry({ route, pickupType: 1, departureMinutes: 480 }), // express: no pickup
        makeEntry({ route, pickupType: 0, departureMinutes: 510 }), // local: pickup ok
        makeEntry({ route, pickupType: 1, departureMinutes: 540 }), // express: no pickup
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(1);
      expect(result[0].schedule.departureMinutes).toBe(510);
    });
  });

  describe('same route+headsign with mixed pt per departure', () => {
    it('filters individually even within same route+headsign', () => {
      // v2 pipeline では pt は便ごとの配列。同じ trip pattern でも
      // 便によって pt が異なりうる。
      const route = makeRoute('route-X');
      const entries = [
        makeEntry({ route, headsign: 'Terminal', pickupType: 0, departureMinutes: 480 }),
        makeEntry({ route, headsign: 'Terminal', pickupType: 1, departureMinutes: 510 }),
        makeEntry({ route, headsign: 'Terminal', pickupType: 0, departureMinutes: 540 }),
      ];
      const result = filterBoardable(entries);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.schedule.departureMinutes)).toEqual([480, 540]);
    });
  });

  describe('circular route edge case', () => {
    it('filters isTerminal && isOrigin — current behavior', () => {
      // Circular routes have the same stop as both origin and terminal.
      // isDropOffOnly returns true because isTerminal is checked.
      // This may cause false positives for circular routes where
      // passengers CAN board at the terminal/origin stop.
      const entry = makeEntry({ isTerminal: true, isOrigin: true });
      expect(filterBoardable([entry])).toHaveLength(0);
    });

    it('filters isTerminal && isOrigin even with pickupType=0', () => {
      // pt=0 is ambiguous (available OR not set). isTerminal takes precedence.
      const entry = makeEntry({ isTerminal: true, isOrigin: true, pickupType: 0 });
      expect(filterBoardable([entry])).toHaveLength(0);
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
});
