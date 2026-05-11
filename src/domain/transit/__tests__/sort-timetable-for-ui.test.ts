import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import { sortTimetableEntriesByDisplayTime } from '../sort-timetable-for-ui';

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
