import { describe, expect, it } from 'vitest';
import { getHeadsignDisplayNames } from '../../../domain/transit/get-headsign-display-names';
import { MockRepository } from '../mock-repository';

function assertSuccess<T>(result: {
  success: boolean;
}): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(`Expected success but got failure: ${JSON.stringify(result)}`);
  }
}

describe('MockRepository i18n data', () => {
  it('provides multilingual stop, agency, and route names', async () => {
    const repository = new MockRepository();
    const result = await repository.getStopMetaById('sta_central');

    assertSuccess(result);

    expect(result.data.stop.stop_names.ko).toBe('아오바중앙역');
    expect(result.data.stop.stop_names['zh-Hant']).toBe('青葉中央站');

    const aobaAgency = result.data.agencies.find((agency) => agency.agency_id === 'mock:aoba');
    expect(aobaAgency?.agency_short_names['zh-Hant']).toBe('青葉巴士');

    const airportRoute = result.data.routes.find((route) => route.route_id === 'subway_airport');
    expect(airportRoute?.route_long_names.en).toBe('Airport Liner');
    expect(airportRoute?.route_long_names['zh-Hans']).toBe('机场线');
  });

  it('provides translated trip and stop headsigns', async () => {
    const repository = new MockRepository();
    const result = await repository.getFullDayTimetableEntries(
      'bus_library',
      new Date('2026-04-07T12:00:00+09:00'),
    );

    assertSuccess(result);

    const stopHeadsignEntry = result.data.find(
      (entry) =>
        entry.routeDirection.route.route_id === 'bus_nohd01' &&
        entry.routeDirection.stopHeadsign?.name === 'もり公園前・にじ橋',
    );
    expect(stopHeadsignEntry).toBeDefined();

    const stopDisplay = getHeadsignDisplayNames(
      stopHeadsignEntry!.routeDirection,
      ['zh-Hant'],
      ['ja'],
      'stop',
    );
    expect(stopDisplay.resolved.name).toBe('森公園前 / 彩虹橋');

    const tripHeadsignEntry = result.data.find(
      (entry) =>
        entry.routeDirection.route.route_id === 'bus_aoba01' &&
        entry.routeDirection.tripHeadsign.name === 'にじ橋',
    );
    expect(tripHeadsignEntry).toBeDefined();

    const tripDisplay = getHeadsignDisplayNames(
      tripHeadsignEntry!.routeDirection,
      ['ko'],
      ['ja'],
      'trip',
    );
    expect(tripDisplay.resolved.name).toBe('니지다리');
  });
});

// ---------------------------------------------------------------------------
// Issue #47: duplicate stop_id within pattern (mock fixtures)
// ---------------------------------------------------------------------------

describe('MockRepository duplicate stop_id within pattern (Issue #47)', () => {
  // Use a fixed time well within the service day to avoid flakiness from
  // current time or service date boundaries.
  const NOW = new Date('2026-04-07T12:00:00+09:00');

  // Pattern: [rs-1, rs-1, rs-2, rs-3]
  // rs-1 appears at consecutive positions 0 and 1 (dwell representation)
  // rs-3 is the terminal (extended route eastward)
  describe('進まない路線 bus_stuck [rs-1, rs-1, rs-2, rs-3]', () => {
    it('emits 2 entries per rs-1 departure (si=0, si=1)', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('rs-1', NOW);
      assertSuccess(result);

      const stuckEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_stuck',
      );
      // Each scheduled minute produces 2 entries (one per occurrence at si=0 and si=1)
      const siValues = new Set(stuckEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([0, 1]));

      // pattern has 4 stops, terminal is rs-3 at index 3
      for (const e of stuckEntries) {
        expect(e.patternPosition.totalStops).toBe(4);
        expect(e.patternPosition.isTerminal).toBe(false);
      }
      // si=0 is origin, si=1 is mid-trip (still rs-1 due to dwell)
      const siZero = stuckEntries.find((e) => e.patternPosition.stopIndex === 0);
      const siOne = stuckEntries.find((e) => e.patternPosition.stopIndex === 1);
      expect(siZero?.patternPosition.isOrigin).toBe(true);
      expect(siOne?.patternPosition.isOrigin).toBe(false);
    });

    it('emits same departure count for both rs-1 occurrences (no merging)', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('rs-1', NOW);
      assertSuccess(result);

      const bySi = new Map<number, number>();
      for (const e of result.data) {
        if (e.routeDirection.route.route_id !== 'bus_stuck') {
          continue;
        }
        const si = e.patternPosition.stopIndex;
        bySi.set(si, (bySi.get(si) ?? 0) + 1);
      }
      expect(bySi.size).toBe(2);
      const counts = [...bySi.values()];
      expect(counts[0]).toBe(counts[1]);
      expect(counts[0]).toBeGreaterThan(0);
    });

    it('rs-2 (mid) appears only at si=2 and is not terminal', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('rs-2', NOW);
      assertSuccess(result);

      const stuckEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_stuck',
      );
      expect(stuckEntries.length).toBeGreaterThan(0);
      for (const e of stuckEntries) {
        expect(e.patternPosition.stopIndex).toBe(2);
        expect(e.patternPosition.isTerminal).toBe(false);
        expect(e.patternPosition.isOrigin).toBe(false);
      }
    });

    it('rs-3 (terminal) is at si=3 with isTerminal=true', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('rs-3', NOW);
      assertSuccess(result);

      const stuckEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_stuck',
      );
      expect(stuckEntries.length).toBeGreaterThan(0);
      for (const e of stuckEntries) {
        expect(e.patternPosition.stopIndex).toBe(3);
        expect(e.patternPosition.isTerminal).toBe(true);
      }
    });
  });

  // Pattern: [r6-1, r6-2, r6-3, r6-5, r6-6, r6-4, r6-3]
  // 6 stops, 7 visits. r6-3 is the loop closing point, visited at index 2 and 6.
  // 電卓 7-segment のように 6 点で「6」を描く形状:
  //   r6-1 (spine top) → r6-2 (spine mid) → r6-3 (loop entry)
  //   → r6-5 (SW) → r6-6 (SE) → r6-4 (NE) → r6-3 (loop closes, terminal)
  describe('6 の字路線 bus_six [r6-1, r6-2, r6-3, r6-5, r6-6, r6-4, r6-3]', () => {
    it('emits entries with stopIndex 2 and 6 for r6-3 (loop closing point)', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r6-3', NOW);
      assertSuccess(result);

      const sixEntries = result.data.filter((e) => e.routeDirection.route.route_id === 'bus_six');
      const siValues = new Set(sixEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([2, 6]));

      // 7 visits in pattern. Terminal is r6-3 at index 6.
      for (const e of sixEntries) {
        expect(e.patternPosition.totalStops).toBe(7);
      }

      const siTwo = sixEntries.find((e) => e.patternPosition.stopIndex === 2);
      const siSix = sixEntries.find((e) => e.patternPosition.stopIndex === 6);

      // si=2 is the first loop entry (mid-trip), si=6 is the second visit (terminal)
      expect(siTwo?.patternPosition.isOrigin).toBe(false);
      expect(siTwo?.patternPosition.isTerminal).toBe(false);
      expect(siSix?.patternPosition.isOrigin).toBe(false);
      expect(siSix?.patternPosition.isTerminal).toBe(true);
    });

    it('emits 2x entries per scheduled minute at r6-3 (one per occurrence)', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r6-3', NOW);
      assertSuccess(result);

      const bySi = new Map<number, number>();
      for (const e of result.data) {
        if (e.routeDirection.route.route_id !== 'bus_six') {
          continue;
        }
        const si = e.patternPosition.stopIndex;
        bySi.set(si, (bySi.get(si) ?? 0) + 1);
      }
      expect(bySi.size).toBe(2);
      const counts = [...bySi.values()];
      expect(counts[0]).toBe(counts[1]);
      expect(counts[0]).toBeGreaterThan(0);
    });

    it('r6-1 (spine top, origin) appears only at si=0', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r6-1', NOW);
      assertSuccess(result);

      const sixEntries = result.data.filter((e) => e.routeDirection.route.route_id === 'bus_six');
      expect(sixEntries.length).toBeGreaterThan(0);
      for (const e of sixEntries) {
        expect(e.patternPosition.stopIndex).toBe(0);
        expect(e.patternPosition.isOrigin).toBe(true);
        expect(e.patternPosition.isTerminal).toBe(false);
      }
    });

    it('r6-2 (spine middle) appears only at si=1', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r6-2', NOW);
      assertSuccess(result);

      const sixEntries = result.data.filter((e) => e.routeDirection.route.route_id === 'bus_six');
      const siValues = new Set(sixEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([1]));
    });

    it('r6-5 (loop SW) appears only at si=3', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r6-5', NOW);
      assertSuccess(result);

      const sixEntries = result.data.filter((e) => e.routeDirection.route.route_id === 'bus_six');
      const siValues = new Set(sixEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([3]));
    });

    it('r6-6 (loop SE) appears only at si=4', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r6-6', NOW);
      assertSuccess(result);

      const sixEntries = result.data.filter((e) => e.routeDirection.route.route_id === 'bus_six');
      const siValues = new Set(sixEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([4]));
    });

    it('r6-4 (loop NE) appears only at si=5', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r6-4', NOW);
      assertSuccess(result);

      const sixEntries = result.data.filter((e) => e.routeDirection.route.route_id === 'bus_six');
      const siValues = new Set(sixEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([5]));
    });
  });

  // Pattern: [r8-3, r8-4, r8-5, r8-3, r8-1, r8-2, r8-3]
  // 5 unique stops, 7 visits. r8-3 is the figure-8 cross point at indices 0, 3, 6.
  // 上ループ: r8-3 → r8-4 → r8-5 → r8-3
  // 下ループ: r8-3 → r8-1 → r8-2 → r8-3
  describe('8 の字路線 bus_eight [r8-3, r8-4, r8-5, r8-3, r8-1, r8-2, r8-3]', () => {
    it('emits entries with stopIndex 0, 3, and 6 for r8-3 (cross point, 3 occurrences)', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r8-3', NOW);
      assertSuccess(result);

      const eightEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_eight',
      );
      const siValues = new Set(eightEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([0, 3, 6]));

      // 7 visits in pattern. Terminal is r8-3 at index 6.
      for (const e of eightEntries) {
        expect(e.patternPosition.totalStops).toBe(7);
      }

      const siZero = eightEntries.find((e) => e.patternPosition.stopIndex === 0);
      const siThree = eightEntries.find((e) => e.patternPosition.stopIndex === 3);
      const siSix = eightEntries.find((e) => e.patternPosition.stopIndex === 6);

      // si=0 origin, si=3 mid (figure-8 cross), si=6 terminal
      expect(siZero?.patternPosition.isOrigin).toBe(true);
      expect(siZero?.patternPosition.isTerminal).toBe(false);
      expect(siThree?.patternPosition.isOrigin).toBe(false);
      expect(siThree?.patternPosition.isTerminal).toBe(false);
      expect(siSix?.patternPosition.isOrigin).toBe(false);
      expect(siSix?.patternPosition.isTerminal).toBe(true);
    });

    it('emits 3x entries per scheduled minute (one per occurrence) at r8-3', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r8-3', NOW);
      assertSuccess(result);

      const bySi = new Map<number, number>();
      for (const e of result.data) {
        if (e.routeDirection.route.route_id !== 'bus_eight') {
          continue;
        }
        const si = e.patternPosition.stopIndex;
        bySi.set(si, (bySi.get(si) ?? 0) + 1);
      }
      expect(bySi.size).toBe(3);
      const counts = [...bySi.values()];
      expect(counts[0]).toBe(counts[1]);
      expect(counts[1]).toBe(counts[2]);
      expect(counts[0]).toBeGreaterThan(0);
    });

    it('r8-4 (upper loop) appears only at si=1', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r8-4', NOW);
      assertSuccess(result);

      const eightEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_eight',
      );
      const siValues = new Set(eightEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([1]));
    });

    it('r8-5 (upper loop) appears only at si=2', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r8-5', NOW);
      assertSuccess(result);

      const eightEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_eight',
      );
      const siValues = new Set(eightEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([2]));
    });

    it('r8-1 (lower loop) appears only at si=4', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r8-1', NOW);
      assertSuccess(result);

      const eightEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_eight',
      );
      const siValues = new Set(eightEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([4]));
    });

    it('r8-2 (lower loop) appears only at si=5', async () => {
      const repository = new MockRepository();
      const result = await repository.getFullDayTimetableEntries('r8-2', NOW);
      assertSuccess(result);

      const eightEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_eight',
      );
      const siValues = new Set(eightEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([5]));
    });
  });

  // ---------------------------------------------------------------------
  // Cross-cutting: getUpcomingTimetableEntries also handles occurrences
  // ---------------------------------------------------------------------
  describe('getUpcomingTimetableEntries occurrence handling', () => {
    it('includes all 3 occurrences of r8-3 in the upcoming list (8 の字 cross point)', async () => {
      const repository = new MockRepository();
      // Use early morning so all stop times are upcoming
      const result = await repository.getUpcomingTimetableEntries(
        'r8-3',
        new Date('2026-04-07T05:00:00+09:00'),
        100, // large limit to capture all occurrences
      );
      assertSuccess(result);

      const eightEntries = result.data.filter(
        (e) => e.routeDirection.route.route_id === 'bus_eight',
      );
      const siValues = new Set(eightEntries.map((e) => e.patternPosition.stopIndex));
      expect(siValues).toEqual(new Set([0, 3, 6]));
    });
  });
});
