import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { ContextualTimetableEntry, TimetableEntry } from '../../../types/app/transit-composed';
import {
  sortTimetableEntriesByDepartureTime,
  sortTimetableEntriesChronologically,
} from '../sort-timetable-entries';

// --- Test fixtures ---

function makeRoute(routeId: string): Route {
  return {
    route_id: routeId,
    route_short_name: routeId,
    route_short_names: {},
    route_long_name: routeId,
    route_long_names: {},
    route_type: 3,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: 'test:agency',
  };
}

function makeEntry(overrides: {
  departureMinutes: number;
  stopIndex?: number;
  routeId?: string;
  headsign?: string;
}): TimetableEntry {
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes,
      arrivalMinutes: overrides.departureMinutes,
    },
    routeDirection: {
      route: makeRoute(overrides.routeId ?? 'test:R1'),
      tripHeadsign: { name: overrides.headsign ?? 'Terminal', names: {} },
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 0,
      totalStops: 10,
      isTerminal: false,
      isOrigin: false,
    },
  };
}

function makeContextualEntry(overrides: {
  serviceDate: Date;
  departureMinutes: number;
  stopIndex?: number;
  routeId?: string;
}): ContextualTimetableEntry {
  return {
    ...makeEntry({
      departureMinutes: overrides.departureMinutes,
      stopIndex: overrides.stopIndex,
      routeId: overrides.routeId,
    }),
    serviceDate: overrides.serviceDate,
  };
}

const YESTERDAY = new Date('2026-04-13T00:00:00+09:00');
const TODAY = new Date('2026-04-14T00:00:00+09:00');

describe('sortTimetableEntriesByDepartureTime', () => {
  describe('1. primary key: schedule.departureMinutes', () => {
    it('sorts entries by departureMinutes ascending', () => {
      const entries = [
        makeEntry({ departureMinutes: 600 }),
        makeEntry({ departureMinutes: 400 }),
        makeEntry({ departureMinutes: 500 }),
      ];
      sortTimetableEntriesByDepartureTime(entries);
      expect(entries.map((e) => e.schedule.departureMinutes)).toEqual([400, 500, 600]);
    });
  });

  describe('2. tie-break: patternPosition.stopIndex (Issue #47)', () => {
    it('breaks ties on departureMinutes by stopIndex ascending', () => {
      const entries = [
        makeEntry({ departureMinutes: 500, stopIndex: 3 }),
        makeEntry({ departureMinutes: 500, stopIndex: 1 }),
        makeEntry({ departureMinutes: 500, stopIndex: 2 }),
      ];
      sortTimetableEntriesByDepartureTime(entries);
      expect(entries.map((e) => e.patternPosition.stopIndex)).toEqual([1, 2, 3]);
    });

    it('reproduces kcbus 三条京阪前 consecutive duplicate ordering (kcbus:114410 ss=3 → ss=4)', () => {
      // kcbus:01000 (市バス10) 三条京阪前 連続重複の構造を再現
      // 同じ trip 内で同じ departure time、stopIndex だけが違う 2 entries
      const earlierStopIndex = makeEntry({ departureMinutes: 401, stopIndex: 4 });
      const laterStopIndex = makeEntry({ departureMinutes: 401, stopIndex: 5 });
      // 入力は逆順 (later, earlier) を意図的に渡す
      const entries = [laterStopIndex, earlierStopIndex];
      sortTimetableEntriesByDepartureTime(entries);
      // 期待: earlier (si=4) → later (si=5)
      expect(entries[0]).toBe(earlierStopIndex);
      expect(entries[1]).toBe(laterStopIndex);
    });
  });

  describe('3. tie-break: routeDirection.route.route_id', () => {
    it('breaks ties on (departureMinutes, stopIndex) by route_id ascending', () => {
      const entries = [
        makeEntry({ departureMinutes: 500, stopIndex: 0, routeId: 'test:R3' }),
        makeEntry({ departureMinutes: 500, stopIndex: 0, routeId: 'test:R1' }),
        makeEntry({ departureMinutes: 500, stopIndex: 0, routeId: 'test:R2' }),
      ];
      sortTimetableEntriesByDepartureTime(entries);
      expect(entries.map((e) => e.routeDirection.route.route_id)).toEqual([
        'test:R1',
        'test:R2',
        'test:R3',
      ]);
    });
  });

  describe('chain composition (all three keys engaged)', () => {
    it('applies departureMinutes → stopIndex → route_id in priority order', () => {
      // 9 entries covering all three key levels
      const entries: TimetableEntry[] = [
        // group A: departureMinutes=600
        makeEntry({ departureMinutes: 600, stopIndex: 0, routeId: 'test:R1' }),
        makeEntry({ departureMinutes: 600, stopIndex: 0, routeId: 'test:R2' }),
        makeEntry({ departureMinutes: 600, stopIndex: 1, routeId: 'test:R1' }),
        // group B: departureMinutes=500
        makeEntry({ departureMinutes: 500, stopIndex: 1, routeId: 'test:R2' }),
        makeEntry({ departureMinutes: 500, stopIndex: 0, routeId: 'test:R1' }),
        makeEntry({ departureMinutes: 500, stopIndex: 0, routeId: 'test:R2' }),
        // group C: departureMinutes=400
        makeEntry({ departureMinutes: 400, stopIndex: 0, routeId: 'test:R1' }),
      ];
      sortTimetableEntriesByDepartureTime(entries);
      const result = entries.map((e) => ({
        d: e.schedule.departureMinutes,
        si: e.patternPosition.stopIndex,
        r: e.routeDirection.route.route_id,
      }));
      expect(result).toEqual([
        // group C
        { d: 400, si: 0, r: 'test:R1' },
        // group B (departureMinutes=500): si then route_id
        { d: 500, si: 0, r: 'test:R1' },
        { d: 500, si: 0, r: 'test:R2' },
        { d: 500, si: 1, r: 'test:R2' },
        // group A (departureMinutes=600): si then route_id
        { d: 600, si: 0, r: 'test:R1' },
        { d: 600, si: 0, r: 'test:R2' },
        { d: 600, si: 1, r: 'test:R1' },
      ]);
    });
  });

  describe('return value', () => {
    it('mutates the input array in place', () => {
      const entries = [makeEntry({ departureMinutes: 600 }), makeEntry({ departureMinutes: 400 })];
      sortTimetableEntriesByDepartureTime(entries);
      expect(entries[0].schedule.departureMinutes).toBe(400);
      expect(entries[1].schedule.departureMinutes).toBe(600);
    });

    it('returns the same array reference for chaining', () => {
      const entries = [makeEntry({ departureMinutes: 500 })];
      const result = sortTimetableEntriesByDepartureTime(entries);
      expect(result).toBe(entries);
    });
  });
});

describe('sortTimetableEntriesChronologically', () => {
  describe('1. primary key: absolute departure time (cross-service-day)', () => {
    it('sorts entries within a single service day by departureMinutes', () => {
      const entries = [
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 600 }),
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 400 }),
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 500 }),
      ];
      sortTimetableEntriesChronologically(entries);
      expect(entries.map((e) => e.schedule.departureMinutes)).toEqual([400, 500, 600]);
    });

    it('interleaves yesterday overnight and today entries by absolute time', () => {
      // 昨日 service day の overnight (departureMinutes=1500 = 翌日 01:00 = 今日 01:00)
      const yesterdayOvernight = makeContextualEntry({
        serviceDate: YESTERDAY,
        departureMinutes: 1500, // = 今日 01:00
      });
      // 今日 service day の朝便 (departureMinutes=300 = 今日 05:00)
      const todayMorning = makeContextualEntry({
        serviceDate: TODAY,
        departureMinutes: 300, // = 今日 05:00
      });
      // 入力は逆順
      const entries = [todayMorning, yesterdayOvernight];
      sortTimetableEntriesChronologically(entries);
      // 期待: yesterdayOvernight (今日 01:00) が今日 05:00 より先
      expect(entries[0]).toBe(yesterdayOvernight);
      expect(entries[1]).toBe(todayMorning);
    });

    it('does not confuse minute value with absolute time across service days', () => {
      // 同じ minute 値だが service day が違う → 絶対時刻も違う
      const yesterdayLate = makeContextualEntry({
        serviceDate: YESTERDAY,
        departureMinutes: 1380, // = 昨日 23:00
      });
      const todayLate = makeContextualEntry({
        serviceDate: TODAY,
        departureMinutes: 1380, // = 今日 23:00
      });
      const entries = [todayLate, yesterdayLate];
      sortTimetableEntriesChronologically(entries);
      expect(entries[0]).toBe(yesterdayLate);
      expect(entries[1]).toBe(todayLate);
    });
  });

  describe('2. tie-break: patternPosition.stopIndex (Issue #47)', () => {
    it('breaks ties on absolute time by stopIndex ascending', () => {
      const entries = [
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 500, stopIndex: 3 }),
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 500, stopIndex: 1 }),
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 500, stopIndex: 2 }),
      ];
      sortTimetableEntriesChronologically(entries);
      expect(entries.map((e) => e.patternPosition.stopIndex)).toEqual([1, 2, 3]);
    });

    it('reproduces kcbus 三条京阪前 consecutive duplicate ordering (kcbus:114410 ss=3 → ss=4)', () => {
      // 同 trip 内連続重複: 同じ absolute time、stopIndex のみ違う
      const earlierStopIndex = makeContextualEntry({
        serviceDate: TODAY,
        departureMinutes: 401,
        stopIndex: 4,
      });
      const laterStopIndex = makeContextualEntry({
        serviceDate: TODAY,
        departureMinutes: 401,
        stopIndex: 5,
      });
      const entries = [laterStopIndex, earlierStopIndex];
      sortTimetableEntriesChronologically(entries);
      expect(entries[0]).toBe(earlierStopIndex);
      expect(entries[1]).toBe(laterStopIndex);
    });
  });

  describe('3. tie-break: routeDirection.route.route_id', () => {
    it('breaks ties on (absolute time, stopIndex) by route_id ascending', () => {
      const entries = [
        makeContextualEntry({
          serviceDate: TODAY,
          departureMinutes: 500,
          stopIndex: 0,
          routeId: 'test:R3',
        }),
        makeContextualEntry({
          serviceDate: TODAY,
          departureMinutes: 500,
          stopIndex: 0,
          routeId: 'test:R1',
        }),
        makeContextualEntry({
          serviceDate: TODAY,
          departureMinutes: 500,
          stopIndex: 0,
          routeId: 'test:R2',
        }),
      ];
      sortTimetableEntriesChronologically(entries);
      expect(entries.map((e) => e.routeDirection.route.route_id)).toEqual([
        'test:R1',
        'test:R2',
        'test:R3',
      ]);
    });
  });

  describe('chain composition (all three keys engaged across service days)', () => {
    it('applies absolute time → stopIndex → route_id in priority order', () => {
      const entries: ContextualTimetableEntry[] = [
        // group A: today, departureMinutes=600 (= 今日 10:00)
        makeContextualEntry({
          serviceDate: TODAY,
          departureMinutes: 600,
          stopIndex: 0,
          routeId: 'test:R2',
        }),
        makeContextualEntry({
          serviceDate: TODAY,
          departureMinutes: 600,
          stopIndex: 0,
          routeId: 'test:R1',
        }),
        // group B: yesterday, departureMinutes=1500 (= 今日 01:00)
        makeContextualEntry({
          serviceDate: YESTERDAY,
          departureMinutes: 1500,
          stopIndex: 1,
          routeId: 'test:R1',
        }),
        makeContextualEntry({
          serviceDate: YESTERDAY,
          departureMinutes: 1500,
          stopIndex: 0,
          routeId: 'test:R1',
        }),
      ];
      sortTimetableEntriesChronologically(entries);
      const result = entries.map((e) => ({
        d: e.schedule.departureMinutes,
        sd: e.serviceDate.getTime() === YESTERDAY.getTime() ? 'yest' : 'today',
        si: e.patternPosition.stopIndex,
        r: e.routeDirection.route.route_id,
      }));
      expect(result).toEqual([
        // group B (yesterday overnight = 今日 01:00) first by absolute time
        { d: 1500, sd: 'yest', si: 0, r: 'test:R1' }, // si=0 第一
        { d: 1500, sd: 'yest', si: 1, r: 'test:R1' }, // si=1 第二
        // group A (today 10:00) second
        { d: 600, sd: 'today', si: 0, r: 'test:R1' }, // route_id 順
        { d: 600, sd: 'today', si: 0, r: 'test:R2' },
      ]);
    });
  });

  describe('return value', () => {
    it('mutates the input array in place', () => {
      const entries = [
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 600 }),
        makeContextualEntry({ serviceDate: TODAY, departureMinutes: 400 }),
      ];
      sortTimetableEntriesChronologically(entries);
      expect(entries[0].schedule.departureMinutes).toBe(400);
      expect(entries[1].schedule.departureMinutes).toBe(600);
    });

    it('returns the same array reference for chaining', () => {
      const entries = [makeContextualEntry({ serviceDate: TODAY, departureMinutes: 500 })];
      const result = sortTimetableEntriesChronologically(entries);
      expect(result).toBe(entries);
    });
  });
});
