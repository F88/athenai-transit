/**
 * Tests for build-transit-display-data.ts.
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeContextualEntry, makeRoute, makeStop } from '../../../../__tests__/helpers';
import type { InfoLevel } from '../../../../types/app/settings';
import type {
  AppRouteTypeValue,
  Route,
  TimetableEntryAttributes,
} from '../../../../types/app/transit';
import type {
  ContextualTimetableEntry,
  StopWithContext,
} from '../../../../types/app/transit-composed';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../../route-type-display-order';
import { getTimetableEntryAttributes } from '../../timetable-entry-attributes';
import {
  categoryQualifies,
  clusterCandidatesByRouteType,
  filterStopsWithinRadius,
  groupCandidatesIntoBoards,
  sortAndCapTransitDisplayData,
  sortByCategory,
  sortTransitDisplayDataWithMetaData,
  toTransitDisplayCandidates,
  transitDisplayMaxEntriesFor,
  type TransitDisplayData,
  type TransitDisplayCandidate,
  type TransitDisplayCategory,
  type TransitDisplayCondition,
  type TransitDisplayDataWithMetaData,
} from '../build-transit-display-data';

// categoryQualifies delegates origin/terminal determination to this domain
// function (which may change over time), so the categoryQualifies unit tests
// mock it to pin only categoryQualifies' own branching.
vi.mock('../../timetable-entry-attributes', () => ({
  getTimetableEntryAttributes: vi.fn(),
}));

describe('transitDisplayMaxEntriesFor', () => {
  it('returns the configured row cap for each info level', () => {
    expect(transitDisplayMaxEntriesFor('simple')).toBe(10);
    expect(transitDisplayMaxEntriesFor('normal')).toBe(10);
    expect(transitDisplayMaxEntriesFor('detailed')).toBe(20);
    expect(transitDisplayMaxEntriesFor('verbose')).toBe(20);
  });

  it('returns a positive cap for every info level', () => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    for (const level of levels) {
      expect(transitDisplayMaxEntriesFor(level)).toBeGreaterThan(0);
    }
  });
});

const busRoute = makeRoute('bus', 3); // route_type 3
const railRoute = makeRoute('rail', 2); // route_type 2
const subwayRoute = makeRoute('subway', 1); // route_type 1

/** Minimal stop context; clustering only reads each candidate's route_type, not the stop. */
const STUB_STOP: StopWithContext = {
  stop: makeStop('stub'),
  agencies: [],
  routes: [busRoute],
  routeTypes: [3],
  stopTimes: [],
  stopServiceState: 'boardable',
};

/** A candidate for a trip on the given route (route.route_type drives clustering). */
function candidateOf(route: Route): TransitDisplayCandidate {
  return { timetableEntry: makeContextualEntry({ route }), stop: STUB_STOP };
}

describe('sortByCategory', () => {
  /** A candidate with explicit departure / arrival minutes (and optional service date). */
  function candidateWithTimes(opts: {
    dep: number;
    arr?: number;
    serviceDate?: Date;
  }): TransitDisplayCandidate {
    const entry = makeContextualEntry({
      route: busRoute,
      departureMinutes: opts.dep,
      arrivalMinutes: opts.arr ?? opts.dep,
      ...(opts.serviceDate ? { serviceDate: opts.serviceDate } : {}),
    });
    return { timetableEntry: entry, stop: STUB_STOP };
  }

  it("'departures': orders earliest departure first", () => {
    const result = sortByCategory(
      [
        candidateWithTimes({ dep: 900 }),
        candidateWithTimes({ dep: 800 }),
        candidateWithTimes({ dep: 850 }),
      ],
      'departures',
    );
    expect(result.map((c) => c.timetableEntry.schedule.departureMinutes)).toEqual([800, 850, 900]);
  });

  it("'arrivals': orders by arrival time, not departure time", () => {
    const a = candidateWithTimes({ dep: 800, arr: 900 });
    const b = candidateWithTimes({ dep: 850, arr: 810 });
    // departures uses departureMinutes -> a (800) before b (850)
    expect(
      sortByCategory([a, b], 'departures').map((c) => c.timetableEntry.schedule.departureMinutes),
    ).toEqual([800, 850]);
    // arrivals uses arrivalMinutes -> b (810) before a (900)
    expect(
      sortByCategory([a, b], 'arrivals').map((c) => c.timetableEntry.schedule.arrivalMinutes),
    ).toEqual([810, 900]);
  });

  it('orders by service date then time (earlier date first even with a later time)', () => {
    // makeContextualEntry defaults serviceDate to 2026-01-01.
    const lateOnDay1 = candidateWithTimes({ dep: 1400 }); // 2026-01-01, 23:20
    const earlyOnDay2 = candidateWithTimes({ dep: 100, serviceDate: new Date('2026-01-02') }); // next day, 01:40

    expect(sortByCategory([earlyOnDay2, lateOnDay1], 'departures')).toEqual([
      lateOnDay1,
      earlyOnDay2,
    ]);
  });

  it('compares by resolved wall-clock, so an overnight (>= 24:00) entry sorts past the next day', () => {
    // The sort uses minutesToDate().getTime(), not a naive (serviceDate, minutes)
    // ordering. A day-1 trip at 26:00 rolls over to day-2 02:00, so it must sort
    // AFTER a day-2 trip at 01:00 -- the opposite of a naive date-then-minutes sort.
    const overnightOnDay1 = candidateWithTimes({ dep: 1560 }); // 2026-01-01, 26:00 -> 01-02 02:00
    const earlyOnDay2 = candidateWithTimes({ dep: 60, serviceDate: new Date('2026-01-02') }); // 01-02 01:00

    expect(sortByCategory([overnightOnDay1, earlyOnDay2], 'departures')).toEqual([
      earlyOnDay2,
      overnightOnDay1,
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(sortByCategory([], 'departures')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const c900 = candidateWithTimes({ dep: 900 });
    const c800 = candidateWithTimes({ dep: 800 });
    const input = [c900, c800];

    sortByCategory(input, 'departures');

    expect(input).toEqual([c900, c800]);
  });
});

describe('categoryQualifies', () => {
  // The entry content is irrelevant: getTimetableEntryAttributes is mocked, so
  // only the flags it returns drive the result.
  const ENTRY = makeContextualEntry({ route: busRoute });

  /** Make the mocked getTimetableEntryAttributes return the given flags (rest false). */
  function withAttributes(flags: Partial<TimetableEntryAttributes>): void {
    vi.mocked(getTimetableEntryAttributes).mockReturnValue({
      isTerminal: false,
      isOrigin: false,
      isPickupUnavailable: false,
      isDropOffUnavailable: false,
      ...flags,
    });
  }

  describe('departures', () => {
    it('excludes terminal entries', () => {
      withAttributes({ isTerminal: true });
      expect(categoryQualifies(ENTRY, 'departures')).toBe(false);
    });

    it('includes non-terminal entries and ignores isOrigin', () => {
      withAttributes({ isTerminal: false, isOrigin: true });
      expect(categoryQualifies(ENTRY, 'departures')).toBe(true);
    });

    it('excludes un-boardable entries (isPickupUnavailable)', () => {
      withAttributes({ isPickupUnavailable: true });
      expect(categoryQualifies(ENTRY, 'departures')).toBe(false);
    });

    it('ignores isDropOffUnavailable (still qualifies, boarding is unaffected)', () => {
      withAttributes({ isDropOffUnavailable: true });
      expect(categoryQualifies(ENTRY, 'departures')).toBe(true);
    });
  });

  describe('arrivals', () => {
    it('excludes origin entries', () => {
      withAttributes({ isOrigin: true });
      expect(categoryQualifies(ENTRY, 'arrivals')).toBe(false);
    });

    it('includes non-origin entries and ignores isTerminal', () => {
      withAttributes({ isOrigin: false, isTerminal: true });
      expect(categoryQualifies(ENTRY, 'arrivals')).toBe(true);
    });

    it('ignores isPickupUnavailable (still qualifies, alighting is unaffected)', () => {
      withAttributes({ isPickupUnavailable: true });
      expect(categoryQualifies(ENTRY, 'arrivals')).toBe(true);
    });

    it('excludes un-alightable entries (isDropOffUnavailable)', () => {
      withAttributes({ isDropOffUnavailable: true });
      expect(categoryQualifies(ENTRY, 'arrivals')).toBe(false);
    });
  });

  it('a plain entry (no terminal/origin) qualifies for both categories', () => {
    withAttributes({});

    expect(categoryQualifies(ENTRY, 'departures')).toBe(true);
    expect(categoryQualifies(ENTRY, 'arrivals')).toBe(true);
  });

  it('delegates terminal/origin determination to getTimetableEntryAttributes', () => {
    withAttributes({});

    categoryQualifies(ENTRY, 'departures');

    expect(getTimetableEntryAttributes).toHaveBeenCalledWith(ENTRY);
  });
});

describe('filterStopsWithinRadius', () => {
  /** A stop context at a given distance (metres), with a unique id for assertions. */
  function stopAtDistance(stopId: string, distance: number | undefined): StopWithContext {
    return { ...STUB_STOP, stop: makeStop(stopId), distance };
  }

  it('keeps stops within the radius and drops the ones beyond it', () => {
    const near = stopAtDistance('near', 50);
    const far = stopAtDistance('far', 150);

    expect(filterStopsWithinRadius([near, far], 100)).toEqual([near]);
  });

  it('keeps a stop exactly at the radius (boundary is inclusive)', () => {
    const onEdge = stopAtDistance('edge', 100);

    expect(filterStopsWithinRadius([onEdge], 100)).toEqual([onEdge]);
  });

  it('keeps a stop at distance 0', () => {
    const here = stopAtDistance('here', 0);

    expect(filterStopsWithinRadius([here], 100)).toEqual([here]);
  });

  it('drops stops whose distance is undefined', () => {
    const unknown = stopAtDistance('unknown', undefined);
    const near = stopAtDistance('near', 10);

    expect(filterStopsWithinRadius([unknown, near], 100)).toEqual([near]);
  });

  it('returns an empty array when no stop is within the radius', () => {
    const far = stopAtDistance('far', 500);

    expect(filterStopsWithinRadius([far], 100)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(filterStopsWithinRadius([], 100)).toEqual([]);
  });

  it('preserves the input order of the surviving stops', () => {
    const a = stopAtDistance('a', 10);
    const b = stopAtDistance('b', 90);
    const c = stopAtDistance('c', 40);

    const result = filterStopsWithinRadius([a, b, c], 100);

    expect(result.map((s) => s.stop.stop_id)).toEqual(['a', 'b', 'c']);
  });
});

describe('clusterCandidatesByRouteType', () => {
  it("'route': one cluster per route type in display order, candidates placed by type", () => {
    const subway = candidateOf(subwayRoute); // route_type 1
    const bus = candidateOf(busRoute); // route_type 3

    const clusters = clusterCandidatesByRouteType([subway, bus], { kind: 'route' });

    // One cluster per ROUTE_TYPE_DISPLAY_ORDER entry, each a single-type cluster.
    expect(clusters.map((c) => c.routeTypes)).toEqual(ROUTE_TYPE_DISPLAY_ORDER.map((t) => [t]));
    expect(clusters.find((c) => c.routeTypes[0] === busRoute.route_type)?.candidates).toEqual([
      bus,
    ]);
    expect(clusters.find((c) => c.routeTypes[0] === subwayRoute.route_type)?.candidates).toEqual([
      subway,
    ]);
  });

  it("'none': a single cluster of all candidates; routeTypes are present types in display order", () => {
    const subway = candidateOf(subwayRoute); // 1
    const bus = candidateOf(busRoute); // 3

    const clusters = clusterCandidatesByRouteType([subway, bus], { kind: 'none' });

    expect(clusters).toHaveLength(1);
    // 3 precedes 1 in ROUTE_TYPE_DISPLAY_ORDER.
    expect(clusters[0].routeTypes).toEqual([3, 1]);
    expect(clusters[0].candidates).toEqual([subway, bus]);
  });

  it("'custom': one cluster per group, keeping each group's own order (not display order)", () => {
    const subway = candidateOf(subwayRoute); // 1
    const rail = candidateOf(railRoute); // 2
    const bus = candidateOf(busRoute); // 3

    const clusters = clusterCandidatesByRouteType([subway, rail, bus], {
      kind: 'custom',
      groups: [[1], [1, 2], [3, 1]],
    });

    expect(clusters).toHaveLength(3);
    // [1, 2] stays [1, 2] (group order), not the display order [2, 1].
    expect(clusters.map((c) => c.routeTypes)).toEqual([[1], [1, 2], [3, 1]]);
  });

  it("'custom': overlapping groups put a route type on every matching board", () => {
    const subway = candidateOf(subwayRoute); // 1
    const rail = candidateOf(railRoute); // 2

    const clusters = clusterCandidatesByRouteType([subway, rail], {
      kind: 'custom',
      groups: [[1], [1, 2]],
    });

    // subway (1) appears in both clusters; candidates keep the input order.
    expect(clusters[0].candidates).toEqual([subway]);
    expect(clusters[1].candidates).toEqual([subway, rail]);
  });

  it("'custom': drops route types absent from the candidates", () => {
    const subway = candidateOf(subwayRoute); // 1; route_type 2 is absent

    const clusters = clusterCandidatesByRouteType([subway], { kind: 'custom', groups: [[2, 1]] });

    expect(clusters[0].routeTypes).toEqual([1]); // 2 dropped (not present)
    expect(clusters[0].candidates).toEqual([subway]);
  });

  it("'route': keeps the input order of candidates within a single type's cluster", () => {
    const bus1 = candidateOf(busRoute); // 3
    const bus2 = candidateOf(busRoute); // 3

    const clusters = clusterCandidatesByRouteType([bus1, bus2], { kind: 'route' });

    const busCluster = clusters.find((c) => c.routeTypes[0] === busRoute.route_type);
    expect(busCluster?.candidates).toEqual([bus1, bus2]);
  });

  it("'route': returns the full display-order skeleton even with no candidates (all clusters empty)", () => {
    const clusters = clusterCandidatesByRouteType([], { kind: 'route' });

    // Structure is data-independent: one single-type cluster per display-order entry.
    expect(clusters.map((c) => c.routeTypes)).toEqual(ROUTE_TYPE_DISPLAY_ORDER.map((t) => [t]));
    expect(clusters.every((c) => c.candidates.length === 0)).toBe(true);
  });

  it("'none': returns a single empty cluster with no route types for no candidates", () => {
    const clusters = clusterCandidatesByRouteType([], { kind: 'none' });

    expect(clusters).toEqual([{ routeTypes: [], candidates: [] }]);
  });

  it("'custom': returns no clusters for an empty groups list", () => {
    const bus = candidateOf(busRoute);

    expect(clusterCandidatesByRouteType([bus], { kind: 'custom', groups: [] })).toEqual([]);
  });
});

describe('groupCandidatesIntoBoards', () => {
  // groupCandidatesIntoBoards routes through categoryQualifies ->
  // getTimetableEntryAttributes (mocked at the top). Make the mock faithful for
  // the only flags categoryQualifies reads, derived from the entry itself, so
  // each candidate gets its own terminal/origin result.
  beforeEach(() => {
    vi.mocked(getTimetableEntryAttributes).mockImplementation((entry) => ({
      isTerminal: entry.patternPosition.isTerminal,
      isOrigin: entry.patternPosition.isOrigin,
      isPickupUnavailable: false,
      isDropOffUnavailable: false,
    }));
  });

  /** A candidate with an explicit direction and terminal/origin position. */
  function cand(
    opts: { route?: Route; direction?: 0 | 1; isOrigin?: boolean; isTerminal?: boolean } = {},
  ): TransitDisplayCandidate {
    return {
      timetableEntry: makeContextualEntry({
        route: opts.route ?? busRoute,
        direction: opts.direction,
        isOrigin: opts.isOrigin,
        isTerminal: opts.isTerminal,
      }),
      stop: STUB_STOP,
    };
  }

  const notSplit: TransitDisplayCondition = {
    maxEntries: 100,
    routeGrouping: { kind: 'none' },
    splitByDirection: false,
  };
  const split: TransitDisplayCondition = { ...notSplit, splitByDirection: true };

  it('not split: produces a departures and an arrivals board per cluster', () => {
    const a = cand({ direction: 0 });
    const b = cand({ direction: 1 });

    const boards = groupCandidatesIntoBoards([a, b], notSplit);

    expect(boards).toHaveLength(2);
    expect(boards.map((bd) => bd.category)).toEqual(['departures', 'arrivals']);
    for (const bd of boards) {
      expect(bd.routeTypes).toEqual([3]);
      expect(bd.directions).toEqual([0, 1]); // present directions of the board's candidates
      expect(bd.data).toEqual([a, b]);
    }
  });

  it("not split: excludes terminal from departures and origin from arrivals, narrowing each board's directions", () => {
    const plain0 = cand({ direction: 0 }); // qualifies both
    const terminal1 = cand({ direction: 1, isTerminal: true }); // arrivals only

    const boards = groupCandidatesIntoBoards([plain0, terminal1], notSplit);

    const departures = boards.find((bd) => bd.category === 'departures');
    const arrivals = boards.find((bd) => bd.category === 'arrivals');

    expect(departures?.data).toEqual([plain0]); // terminal1 dropped
    expect(departures?.directions).toEqual([0]); // direction 1 no longer present
    expect(arrivals?.data).toEqual([plain0, terminal1]);
    expect(arrivals?.directions).toEqual([0, 1]);
  });

  it('split: one board per present (direction, category); undefined maps to "none", absent buckets dropped', () => {
    const noDir = cand({}); // direction undefined
    const dir0 = cand({ direction: 0 });
    // no direction 1 -> its buckets are empty and dropped

    const boards = groupCandidatesIntoBoards([noDir, dir0], split);

    // Category-major: all departures (in direction order) before all arrivals.
    expect(boards.map((bd) => ({ directions: bd.directions, category: bd.category }))).toEqual([
      { directions: ['none'], category: 'departures' },
      { directions: [0], category: 'departures' },
      { directions: ['none'], category: 'arrivals' },
      { directions: [0], category: 'arrivals' },
    ]);
    // each bucket keeps only its own direction's candidate
    expect(boards[0].data).toEqual([noDir]); // none-departures
    expect(boards[1].data).toEqual([dir0]); // 0-departures
  });

  it('split: drops a board left empty after category qualification', () => {
    const terminal0 = cand({ direction: 0, isTerminal: true }); // arrivals only

    const boards = groupCandidatesIntoBoards([terminal0], split);

    // direction-0 departures board is empty (terminal excluded) and dropped.
    expect(boards).toHaveLength(1);
    expect(boards[0].directions).toEqual([0]);
    expect(boards[0].category).toBe('arrivals');
    expect(boards[0].data).toEqual([terminal0]);
  });

  it('returns no boards for empty input', () => {
    expect(groupCandidatesIntoBoards([], notSplit)).toEqual([]);
    expect(groupCandidatesIntoBoards([], split)).toEqual([]);
  });

  it("respects the route grouping: 'route' yields per-route-type boards in display order", () => {
    const bus = cand({ route: busRoute }); // 3
    const subway = cand({ route: subwayRoute }); // 1

    const boards = groupCandidatesIntoBoards([bus, subway], {
      maxEntries: 100,
      routeGrouping: { kind: 'route' },
      splitByDirection: false,
    });

    // Empty route-type clusters are dropped; 3 precedes 1 in display order, and
    // each surviving type yields a departures + arrivals board.
    expect(boards.map((bd) => ({ routeTypes: bd.routeTypes, category: bd.category }))).toEqual([
      { routeTypes: [3], category: 'departures' },
      { routeTypes: [3], category: 'arrivals' },
      { routeTypes: [1], category: 'departures' },
      { routeTypes: [1], category: 'arrivals' },
    ]);
  });
});

describe('sortAndCapTransitDisplayData', () => {
  /** A candidate with explicit departure / arrival minutes. */
  function candWithTimes(dep: number, arr: number = dep): TransitDisplayCandidate {
    return {
      timetableEntry: makeContextualEntry({
        route: busRoute,
        departureMinutes: dep,
        arrivalMinutes: arr,
      }),
      stop: STUB_STOP,
    };
  }

  /** A board carrying the given category and candidates (metadata is incidental). */
  function boardOf(
    category: TransitDisplayCategory,
    candidates: TransitDisplayCandidate[],
  ): TransitDisplayData {
    return { routeTypes: [3], directions: ['none'], category, data: candidates };
  }

  it("sorts each board's candidates by its own category's time", () => {
    const dep = boardOf('departures', [candWithTimes(900), candWithTimes(800), candWithTimes(850)]);
    const arr = boardOf('arrivals', [candWithTimes(700, 900), candWithTimes(710, 810)]);

    const [sortedDep, sortedArr] = sortAndCapTransitDisplayData([dep, arr], 100);

    expect(sortedDep.data.map((c) => c.timetableEntry.schedule.departureMinutes)).toEqual([
      800, 850, 900,
    ]);
    // arrivals board sorts by arrivalMinutes (810 before 900), not departure time
    expect(sortedArr.data.map((c) => c.timetableEntry.schedule.arrivalMinutes)).toEqual([810, 900]);
  });

  it('caps each board to maxEntries, keeping the earliest after sorting', () => {
    const board = boardOf('departures', [
      candWithTimes(900),
      candWithTimes(800),
      candWithTimes(850),
      candWithTimes(700),
    ]);

    const [capped] = sortAndCapTransitDisplayData([board], 2);

    expect(capped.data.map((c) => c.timetableEntry.schedule.departureMinutes)).toEqual([700, 800]);
  });

  it('preserves board metadata (routeTypes, directions, category)', () => {
    const board: TransitDisplayData = {
      routeTypes: [2, 1],
      directions: [0, 'none'],
      category: 'departures',
      data: [candWithTimes(800)],
    };

    const [result] = sortAndCapTransitDisplayData([board], 100);

    expect(result.routeTypes).toEqual([2, 1]);
    expect(result.directions).toEqual([0, 'none']);
    expect(result.category).toBe('departures');
  });

  it('does not mutate the input board candidates', () => {
    const c900 = candWithTimes(900);
    const c800 = candWithTimes(800);
    const board = boardOf('departures', [c900, c800]);

    sortAndCapTransitDisplayData([board], 100);

    expect(board.data).toEqual([c900, c800]);
  });

  it('returns an empty array for no boards', () => {
    expect(sortAndCapTransitDisplayData([], 100)).toEqual([]);
  });

  it('keeps an empty board empty', () => {
    const [result] = sortAndCapTransitDisplayData([boardOf('departures', [])], 100);

    expect(result.data).toEqual([]);
  });
});

describe('toTransitDisplayCandidates', () => {
  /** A stop context carrying the given stopTimes (other fields are incidental). */
  function stopWith(stopId: string, stopTimes: ContextualTimetableEntry[]): StopWithContext {
    return { ...STUB_STOP, stop: makeStop(stopId), stopTimes };
  }

  it("flattens a stop's stopTimes into (entry, stopWithContext) pairs", () => {
    const e0 = makeContextualEntry({ departureMinutes: 600 });
    const e1 = makeContextualEntry({ departureMinutes: 700 });
    const stop = stopWith('s1', [e0, e1]);

    expect(toTransitDisplayCandidates([stop])).toEqual([
      { timetableEntry: e0, stop: stop },
      { timetableEntry: e1, stop: stop },
    ]);
  });

  it('preserves stop order then stopTime order without reordering by time', () => {
    const a0 = makeContextualEntry({ departureMinutes: 600 });
    const a1 = makeContextualEntry({ departureMinutes: 610 });
    const b0 = makeContextualEntry({ departureMinutes: 500 }); // earlier, but later stop
    const stopA = stopWith('a', [a0, a1]);
    const stopB = stopWith('b', [b0]);

    const candidates = toTransitDisplayCandidates([stopA, stopB]);

    // Declaration order is kept (b0 at 500 stays last); each entry keeps its source stop.
    expect(candidates.map((c) => c.timetableEntry)).toEqual([a0, a1, b0]);
    expect(candidates.map((c) => c.stop)).toEqual([stopA, stopA, stopB]);
  });

  it('contributes nothing for a stop with no stopTimes', () => {
    const empty = stopWith('empty', []);
    const e0 = makeContextualEntry({});
    const withTimes = stopWith('s', [e0]);

    expect(toTransitDisplayCandidates([empty, withTimes])).toEqual([
      { timetableEntry: e0, stop: withTimes },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(toTransitDisplayCandidates([])).toEqual([]);
  });
});

describe('sortTransitDisplayDataWithMetaData', () => {
  /** A display whose only meaningful fields for ordering are route type, category, direction. */
  function display(
    routeType: AppRouteTypeValue,
    category: TransitDisplayCategory,
    directions: readonly (0 | 1 | 'none')[] = ['none'],
  ): TransitDisplayDataWithMetaData {
    return {
      meta: { category, routeTypes: [routeType], directions, max: 10, radius: 100 },
      data: { routeTypes: [routeType], directions, category, data: [] },
    };
  }

  it('orders by route type in ROUTE_TYPE_DISPLAY_ORDER (ferry not hoisted)', () => {
    // display order is [3, 11, 0, 2, 1, 12, 4, ...]: bus(3) < rail(2) < subway(1) < ferry(4)
    const bus = display(3, 'departures');
    const rail = display(2, 'departures');
    const subway = display(1, 'departures');
    const ferry = display(4, 'departures');

    const sorted = sortTransitDisplayDataWithMetaData([subway, ferry, rail, bus]);

    expect(sorted.map((d) => d.meta.routeTypes[0])).toEqual([3, 2, 1, 4]);
  });

  it('within a route type, departures come before arrivals', () => {
    const arr = display(2, 'arrivals');
    const dep = display(2, 'departures');

    expect(sortTransitDisplayDataWithMetaData([arr, dep]).map((d) => d.meta.category)).toEqual([
      'departures',
      'arrivals',
    ]);
  });

  it('within a category, orders by direction (none, 0, 1)', () => {
    const d1 = display(2, 'departures', [1]);
    const d0 = display(2, 'departures', [0]);
    const dn = display(2, 'departures', ['none']);

    expect(
      sortTransitDisplayDataWithMetaData([d1, d0, dn]).map((d) => d.meta.directions[0]),
    ).toEqual(['none', 0, 1]);
  });

  it('applies the three levels together: route type -> category -> direction', () => {
    const railArr0 = display(2, 'arrivals', [0]);
    const busDep = display(3, 'departures', ['none']);
    const railDep1 = display(2, 'departures', [1]);
    const railDep0 = display(2, 'departures', [0]);
    const busArr = display(3, 'arrivals', ['none']);

    const sorted = sortTransitDisplayDataWithMetaData([
      railArr0,
      busDep,
      railDep1,
      railDep0,
      busArr,
    ]);

    expect(
      sorted.map((d) => ({
        rt: d.meta.routeTypes[0],
        category: d.meta.category,
        dir: d.meta.directions[0],
      })),
    ).toEqual([
      { rt: 3, category: 'departures', dir: 'none' },
      { rt: 3, category: 'arrivals', dir: 'none' },
      { rt: 2, category: 'departures', dir: 0 },
      { rt: 2, category: 'departures', dir: 1 },
      { rt: 2, category: 'arrivals', dir: 0 },
    ]);
  });

  it('does not mutate the input array', () => {
    const a = display(2, 'departures');
    const b = display(3, 'departures');
    const input = [a, b];

    sortTransitDisplayDataWithMetaData(input);

    expect(input).toEqual([a, b]);
  });

  it('returns an empty array for empty input', () => {
    expect(sortTransitDisplayDataWithMetaData([])).toEqual([]);
  });
});
