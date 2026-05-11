import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { ContextualTimetableEntry, TimetableEntry } from '../../../types/app/transit-composed';
import {
  sortTimetableEntriesByDisplayTime,
  sortTimetableEntriesByDisplayTimeChronologically,
} from '../sort-timetable-for-ui';

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
  arrivalMinutes?: number;
  isTerminal?: boolean;
  isOrigin?: boolean;
  stopIndex?: number;
  routeId?: string;
}): TimetableEntry {
  const route = makeRoute(overrides.routeId ?? 'test:R1');
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes,
    },
    routeDirection: {
      route,
      tripHeadsign: { name: 'Test', names: {} },
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 0,
      totalStops: 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    tripLocator: { patternId: `${route.route_id}__test`, serviceId: 'test', tripIndex: 0 },
  };
}

function makeContextualEntry(overrides: {
  serviceDate: Date;
  departureMinutes: number;
  arrivalMinutes?: number;
  isTerminal?: boolean;
  isOrigin?: boolean;
  routeId?: string;
}): ContextualTimetableEntry {
  return {
    ...makeEntry({
      departureMinutes: overrides.departureMinutes,
      arrivalMinutes: overrides.arrivalMinutes,
      isTerminal: overrides.isTerminal,
      isOrigin: overrides.isOrigin,
      routeId: overrides.routeId,
    }),
    serviceDate: overrides.serviceDate,
  };
}

const SERVICE_DAY_1 = new Date('2026-05-11T00:00:00+09:00');
const SERVICE_DAY_2 = new Date('2026-05-12T00:00:00+09:00');

describe('sortTimetableEntriesByDisplayTime', () => {
  describe('1. primary key: getDisplayMinutes', () => {
    it('sorts non-terminal entries ascending by departure (= display) minute', () => {
      const entries = [
        makeEntry({ departureMinutes: 600 }),
        makeEntry({ departureMinutes: 400 }),
        makeEntry({ departureMinutes: 500 }),
      ];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries.map((e) => e.schedule.departureMinutes)).toEqual([400, 500, 600]);
    });

    it('sorts terminal entries by arrival (= display), not by departure', () => {
      // Terminal with dwell: display = arrival, not departure.
      const earlierDisplay = makeEntry({
        departureMinutes: 10 * 60 + 19,
        arrivalMinutes: 10 * 60 + 16,
        isTerminal: true,
      });
      const laterDisplay = makeEntry({
        departureMinutes: 10 * 60 + 17,
        arrivalMinutes: 10 * 60 + 17,
        isTerminal: true,
      });
      // Input order: laterDisplay first (departure-time order would keep it
      // first because 10:17 < 10:19), but display order should put
      // earlierDisplay (arrival 10:16) first.
      const entries = [laterDisplay, earlierDisplay];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries[0]).toBe(earlierDisplay);
      expect(entries[1]).toBe(laterDisplay);
    });

    it('reproduces Issue #63 bus_park case: terminal with dwell vs same-route non-terminal', () => {
      // bus_yukkuri01 at bus_park (mock repo):
      //   - terminal entry (もり公園前 行): arr 09:05 / dep 09:08, display 09:05
      //   - non-terminal entry (あおば中央駅 行): dep 09:06, display 09:06
      // Upstream `sortTimetableEntriesByDepartureTime` would put non-terminal
      // first (06 < 08). After display sort, terminal (05) comes first.
      const nonTerminal = makeEntry({
        departureMinutes: 9 * 60 + 6,
      });
      const terminal = makeEntry({
        departureMinutes: 9 * 60 + 8,
        arrivalMinutes: 9 * 60 + 5,
        isTerminal: true,
      });
      const entries = [nonTerminal, terminal];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries[0]).toBe(terminal);
      expect(entries[1]).toBe(nonTerminal);
    });
  });

  describe('2. tie-break: schedule.arrivalMinutes', () => {
    it('orders entries with equal display by arrivalMinutes ascending', () => {
      // Two non-terminals with same display (= departure) but different arrival.
      // arr 10:28 / dep 10:30 vs arr 10:25 / dep 10:30: earlier arrival first.
      const laterArrival = makeEntry({
        departureMinutes: 10 * 60 + 30,
        arrivalMinutes: 10 * 60 + 28,
      });
      const earlierArrival = makeEntry({
        departureMinutes: 10 * 60 + 30,
        arrivalMinutes: 10 * 60 + 25,
      });
      const entries = [laterArrival, earlierArrival];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries[0]).toBe(earlierArrival);
      expect(entries[1]).toBe(laterArrival);
    });
  });

  describe('3. tie-break: schedule.departureMinutes', () => {
    it('orders entries with equal display + arrival by departureMinutes ascending', () => {
      // Two terminals sharing arrival (= display) but different departure dwell:
      //   A: arr 10:30 / dep 10:30 (no dwell)
      //   B: arr 10:30 / dep 10:33 (3-min dwell)
      // Display and arrival both tie at 10:30, so departure breaks: A leaves first.
      const noDwell = makeEntry({
        departureMinutes: 10 * 60 + 30,
        arrivalMinutes: 10 * 60 + 30,
        isTerminal: true,
      });
      const withDwell = makeEntry({
        departureMinutes: 10 * 60 + 33,
        arrivalMinutes: 10 * 60 + 30,
        isTerminal: true,
      });
      const entries = [withDwell, noDwell];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries[0]).toBe(noDwell);
      expect(entries[1]).toBe(withDwell);
    });
  });

  describe('4. tie-break: patternPosition.isOrigin (true first)', () => {
    it('places origin entries before non-origin when all time keys tie', () => {
      const nonOrigin = makeEntry({ departureMinutes: 600 });
      const origin = makeEntry({ departureMinutes: 600, isOrigin: true });
      const entries = [nonOrigin, origin];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries[0]).toBe(origin);
      expect(entries[1]).toBe(nonOrigin);
    });
  });

  describe('5. tie-break: patternPosition.isTerminal (true first)', () => {
    it('places terminal entries before non-terminal when origin status also ties', () => {
      // Both non-origin. Same arr/dep. One is terminal (dwell=0 case).
      const middle = makeEntry({
        departureMinutes: 600,
        arrivalMinutes: 600,
      });
      const terminal = makeEntry({
        departureMinutes: 600,
        arrivalMinutes: 600,
        isTerminal: true,
      });
      const entries = [middle, terminal];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries[0]).toBe(terminal);
      expect(entries[1]).toBe(middle);
    });
  });

  describe('priority order (display → arrival → isOrigin)', () => {
    it('applies higher-priority keys before lower-priority ones', () => {
      // Note: isTerminal flips display from departure to arrival, so an
      // entry with isTerminal=true and arr=490 has display=490 — that
      // is why e5 below sorts between e1 (display 400) and e2 (display 500).
      const e1 = makeEntry({ departureMinutes: 400 });
      // → display 400 (non-terminal)
      const e2 = makeEntry({
        departureMinutes: 500,
        arrivalMinutes: 480,
      });
      // → display 500, arrival 480
      const e3 = makeEntry({
        departureMinutes: 500,
        arrivalMinutes: 490,
      });
      // → display 500, arrival 490, isOrigin false
      const e4 = makeEntry({
        departureMinutes: 500,
        arrivalMinutes: 490,
        isOrigin: true,
      });
      // → display 500, arrival 490, isOrigin true (beats e3)
      const e5 = makeEntry({
        departureMinutes: 500,
        arrivalMinutes: 490,
        isTerminal: true,
      });
      // → display = arrival = 490 (terminal shifts display)
      const entries = [e5, e3, e1, e4, e2];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries).toEqual([e1, e5, e2, e4, e3]);
    });
  });

  describe('mutation contract', () => {
    it('mutates the input array in place', () => {
      const entries = [makeEntry({ departureMinutes: 600 }), makeEntry({ departureMinutes: 400 })];
      const before = entries;
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries).toBe(before);
      expect(entries.map((e) => e.schedule.departureMinutes)).toEqual([400, 600]);
    });

    it('returns the input array (for chaining)', () => {
      const entries = [makeEntry({ departureMinutes: 600 })];
      const returned = sortTimetableEntriesByDisplayTime(entries);
      expect(returned).toBe(entries);
    });
  });

  describe('edge cases', () => {
    it('handles an empty input', () => {
      const entries: TimetableEntry[] = [];
      sortTimetableEntriesByDisplayTime(entries);
      expect(entries).toEqual([]);
    });

    it('returns equally-keyed entries together (order between them unspecified)', () => {
      const a = makeEntry({ departureMinutes: 600, routeId: 'test:RA' });
      const b = makeEntry({ departureMinutes: 600, routeId: 'test:RB' });
      const entries = [a, b];
      sortTimetableEntriesByDisplayTime(entries);
      // Both keys (display/arrival/departure/isOrigin/isTerminal) tie.
      // Don't assert a specific order — just that both survive.
      expect(new Set(entries)).toEqual(new Set([a, b]));
      expect(entries.length).toBe(2);
    });
  });
});

describe('sortTimetableEntriesByDisplayTimeChronologically', () => {
  describe('1. primary key: absolute display time across service days', () => {
    it('orders cross-service-day entries by absolute time, not raw display minute', () => {
      // Reproduces the iyt2 Tokyo-Matsuyama overnight bus case:
      //   - A: serviceDate = day1, terminal arr = 1900 (= 31:40 from
      //     day1 midnight = day2 07:40 absolute)
      //   - B: serviceDate = day2, dep = 600 (= day2 10:00 absolute)
      // Raw minute compare would order B before A (600 < 1900), but the
      // visible absolute time is A (07:40) < B (10:00).
      const overnightArrival = makeContextualEntry({
        serviceDate: SERVICE_DAY_1,
        departureMinutes: 1900,
        arrivalMinutes: 1900,
        isTerminal: true,
      });
      const nextMorningDeparture = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 600,
      });
      const entries = [nextMorningDeparture, overnightArrival];
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(entries[0]).toBe(overnightArrival);
      expect(entries[1]).toBe(nextMorningDeparture);
    });

    it('interleaves yesterday-overnight, today-early, today-late correctly', () => {
      // Three entries spanning a 24-hour boundary, given in shuffled
      // input order. Expected absolute order: y2 < t1 < t2.
      const yesterdayOvernight = makeContextualEntry({
        serviceDate: SERVICE_DAY_1,
        departureMinutes: 24 * 60 + 30, // 24:30 = day2 00:30 absolute
      });
      const todayMorning = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 400, // day2 06:40 absolute
      });
      const todayLate = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 22 * 60, // day2 22:00 absolute
      });
      const entries = [todayLate, yesterdayOvernight, todayMorning];
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(entries[0]).toBe(yesterdayOvernight);
      expect(entries[1]).toBe(todayMorning);
      expect(entries[2]).toBe(todayLate);
    });

    it('uses arrivalMinutes (not departure) as display for terminals across days', () => {
      // Terminal A: serviceDate=day1, arr 1850 / dep 1900 → display = arr
      //   → absolute display = day2 06:50
      // Non-terminal B: serviceDate=day2, dep 410 → display = dep
      //   → absolute display = day2 06:50 (same)
      // Tie on absolute display. Tie-break (key 2 absolute arrival):
      //   A.arr abs = day2 06:50; B.arr abs = day2 06:50 (we make them tie).
      // Tie-break (key 3 absolute departure):
      //   A.dep abs = day2 07:00; B.dep abs = day2 06:50 → B first.
      const terminalOvernight = makeContextualEntry({
        serviceDate: SERVICE_DAY_1,
        arrivalMinutes: 24 * 60 + 6 * 60 + 50, // day2 06:50
        departureMinutes: 24 * 60 + 7 * 60, // day2 07:00
        isTerminal: true,
      });
      const todayEarly = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        arrivalMinutes: 6 * 60 + 50, // day2 06:50
        departureMinutes: 6 * 60 + 50, // day2 06:50
      });
      const entries = [terminalOvernight, todayEarly];
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      // Display tied. Arrival tied. Departure: B(06:50) < A(07:00) → B first.
      expect(entries[0]).toBe(todayEarly);
      expect(entries[1]).toBe(terminalOvernight);
    });
  });

  describe('2. tie-break: absolute arrivalMinutes', () => {
    it('orders entries with equal absolute display by absolute arrival ascending', () => {
      // Both non-terminal with display = departure. Same absolute display
      // but different absolute arrival (dwell at the stop differs).
      // Use same serviceDate so the absolute-vs-raw distinction is moot.
      const laterArrival = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 10 * 60 + 30,
        arrivalMinutes: 10 * 60 + 28,
      });
      const earlierArrival = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 10 * 60 + 30,
        arrivalMinutes: 10 * 60 + 25,
      });
      const entries = [laterArrival, earlierArrival];
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(entries[0]).toBe(earlierArrival);
      expect(entries[1]).toBe(laterArrival);
    });
  });

  describe('3. tie-break: isOrigin / isTerminal flags', () => {
    it('prefers origin entries when all time keys (abs display/arr/dep) tie', () => {
      const nonOrigin = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 600,
      });
      const origin = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 600,
        isOrigin: true,
      });
      const entries = [nonOrigin, origin];
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(entries[0]).toBe(origin);
      expect(entries[1]).toBe(nonOrigin);
    });

    it('prefers terminal entries when isOrigin status also ties', () => {
      const middle = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 600,
        arrivalMinutes: 600,
      });
      const terminal = makeContextualEntry({
        serviceDate: SERVICE_DAY_2,
        departureMinutes: 600,
        arrivalMinutes: 600,
        isTerminal: true,
      });
      const entries = [middle, terminal];
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(entries[0]).toBe(terminal);
      expect(entries[1]).toBe(middle);
    });
  });

  describe('mutation contract', () => {
    it('mutates the input array in place', () => {
      const entries = [
        makeContextualEntry({ serviceDate: SERVICE_DAY_2, departureMinutes: 600 }),
        makeContextualEntry({ serviceDate: SERVICE_DAY_2, departureMinutes: 400 }),
      ];
      const before = entries;
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(entries).toBe(before);
      expect(entries.map((e) => e.schedule.departureMinutes)).toEqual([400, 600]);
    });

    it('returns the input array (for chaining)', () => {
      const entries = [makeContextualEntry({ serviceDate: SERVICE_DAY_2, departureMinutes: 600 })];
      const returned = sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(returned).toBe(entries);
    });
  });

  describe('edge cases', () => {
    it('handles an empty input', () => {
      const entries: ContextualTimetableEntry[] = [];
      sortTimetableEntriesByDisplayTimeChronologically(entries);
      expect(entries).toEqual([]);
    });
  });
});
