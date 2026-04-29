import { describe, expect, it } from 'vitest';

import type { TimetableEntry, TripStopTime } from '../../../types/app/transit-composed';
import type { Route } from '../../../types/app/transit';
import {
  buildStopByPatternIndex,
  getOriginStop,
  getPatternTotalStops,
  getStopAtPatternIndex,
  getTerminalStop,
} from '../trip-stop-times';

// --- Test fixtures ---

function makeRoute(routeId: string): Route {
  return {
    route_id: routeId,
    route_short_name: routeId,
    route_short_names: {},
    route_long_name: routeId,
    route_long_names: {},
    route_type: 2,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: 'test:agency',
  };
}

function makeEntry(args: { stopIndex: number; totalStops: number }): TimetableEntry {
  const route = makeRoute('test:R1');
  return {
    schedule: { departureMinutes: 0, arrivalMinutes: 0 },
    routeDirection: {
      route,
      tripHeadsign: { name: 'Terminal', names: {} },
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: args.stopIndex,
      totalStops: args.totalStops,
      isOrigin: args.stopIndex === 0,
      isTerminal: args.stopIndex === args.totalStops - 1,
    },
    tripLocator: { patternId: 'test:R1__Terminal', serviceId: 'test', tripIndex: 0 },
  };
}

function makeStop(args: { stopIndex: number; totalStops: number; stopId?: string }): TripStopTime {
  return {
    routeTypes: [],
    timetableEntry: makeEntry({ stopIndex: args.stopIndex, totalStops: args.totalStops }),
    // stopMeta is intentionally omitted; helpers under test only
    // read patternPosition fields, so the enrichment layer is irrelevant.
  };
}

/** Build a fully reconstructed array (no missing pattern positions). */
function makeFullStopTimes(totalStops: number): TripStopTime[] {
  return Array.from({ length: totalStops }, (_, i) => makeStop({ stopIndex: i, totalStops }));
}

// --- Tests ---

describe('getPatternTotalStops', () => {
  it('returns 0 for an empty array', () => {
    expect(getPatternTotalStops([])).toBe(0);
  });

  it('returns totalStops from any entry', () => {
    const stopTimes = makeFullStopTimes(16);
    expect(getPatternTotalStops(stopTimes)).toBe(16);
  });

  it('returns the count even when the first reconstructed entry is not stopIndex 0', () => {
    // Origin (stopIndex=0) is missing; first entry is stopIndex=1.
    const stopTimes = [
      makeStop({ stopIndex: 1, totalStops: 16 }),
      makeStop({ stopIndex: 2, totalStops: 16 }),
    ];
    expect(getPatternTotalStops(stopTimes)).toBe(16);
  });
});

describe('buildStopByPatternIndex', () => {
  it('returns an empty Map for an empty array', () => {
    expect(buildStopByPatternIndex([]).size).toBe(0);
  });

  it('keys entries by patternPosition.stopIndex', () => {
    const stopTimes = makeFullStopTimes(3);
    const map = buildStopByPatternIndex(stopTimes);

    expect(map.size).toBe(3);
    expect(map.get(0)).toBe(stopTimes[0]);
    expect(map.get(1)).toBe(stopTimes[1]);
    expect(map.get(2)).toBe(stopTimes[2]);
  });

  it('omits missing pattern positions', () => {
    // yurimo:Ariake-style: terminal (stopIndex=15) missing from a 16-stop pattern.
    const stopTimes = Array.from({ length: 15 }, (_, i) =>
      makeStop({ stopIndex: i, totalStops: 16 }),
    );
    const map = buildStopByPatternIndex(stopTimes);

    expect(map.size).toBe(15);
    expect(map.has(15)).toBe(false);
    expect(map.get(0)?.timetableEntry.patternPosition.stopIndex).toBe(0);
    expect(map.get(14)?.timetableEntry.patternPosition.stopIndex).toBe(14);
  });

  it('preserves all entries when an interior position is missing', () => {
    // Pattern of 5; stopIndex=2 missing (sparse middle).
    const stopTimes = [0, 1, 3, 4].map((idx) => makeStop({ stopIndex: idx, totalStops: 5 }));
    const map = buildStopByPatternIndex(stopTimes);

    expect(map.size).toBe(4);
    expect(map.has(2)).toBe(false);
    expect(map.get(0)).toBeDefined();
    expect(map.get(4)).toBeDefined();
  });
});

describe('getStopAtPatternIndex', () => {
  it('returns undefined for an empty array', () => {
    expect(getStopAtPatternIndex([], 0)).toBeUndefined();
  });

  it('returns the entry whose stopIndex matches the requested position', () => {
    const stopTimes = makeFullStopTimes(4);
    expect(getStopAtPatternIndex(stopTimes, 2)).toBe(stopTimes[2]);
  });

  it('returns undefined when the requested position is missing', () => {
    // stopIndex=3 missing.
    const stopTimes = [0, 1, 2, 4].map((idx) => makeStop({ stopIndex: idx, totalStops: 5 }));
    expect(getStopAtPatternIndex(stopTimes, 3)).toBeUndefined();
  });

  it('does not confuse array index with stopIndex', () => {
    // Origin missing; the first array element has stopIndex=1, not 0.
    const stopTimes = [1, 2, 3].map((idx) => makeStop({ stopIndex: idx, totalStops: 4 }));
    expect(getStopAtPatternIndex(stopTimes, 0)).toBeUndefined();
    expect(getStopAtPatternIndex(stopTimes, 1)?.timetableEntry.patternPosition.stopIndex).toBe(1);
  });
});

describe('getOriginStop', () => {
  it('returns undefined for an empty array', () => {
    expect(getOriginStop([])).toBeUndefined();
  });

  it('returns the entry flagged isOrigin', () => {
    const stopTimes = makeFullStopTimes(3);
    expect(getOriginStop(stopTimes)).toBe(stopTimes[0]);
  });

  it('returns undefined when the origin row was not reconstructed', () => {
    // Pattern of 3; origin (stopIndex=0) missing.
    const stopTimes = [1, 2].map((idx) => makeStop({ stopIndex: idx, totalStops: 3 }));
    expect(getOriginStop(stopTimes)).toBeUndefined();
  });
});

describe('getTerminalStop', () => {
  it('returns undefined for an empty array', () => {
    expect(getTerminalStop([])).toBeUndefined();
  });

  it('returns the entry flagged isTerminal', () => {
    const stopTimes = makeFullStopTimes(3);
    expect(getTerminalStop(stopTimes)).toBe(stopTimes[2]);
  });

  it('returns undefined for the yurimo short-turn pattern (terminal missing)', () => {
    // 16-stop pattern; reconstructed stopTimes only cover 0..14.
    // tripStopTimes[length-1] would incorrectly return stopIndex=14
    // (= ShinToyosu); the pattern terminal (= Toyosu) was not
    // reconstructed and the helper correctly reports undefined.
    const stopTimes = Array.from({ length: 15 }, (_, i) =>
      makeStop({ stopIndex: i, totalStops: 16 }),
    );
    expect(getTerminalStop(stopTimes)).toBeUndefined();
  });

  it('finds the terminal even when interior stops are missing', () => {
    // Pattern of 5; stopIndex=2 missing but origin and terminal present.
    const stopTimes = [0, 1, 3, 4].map((idx) => makeStop({ stopIndex: idx, totalStops: 5 }));
    expect(getTerminalStop(stopTimes)?.timetableEntry.patternPosition.stopIndex).toBe(4);
  });
});

describe('single-stop pattern', () => {
  it('treats the only entry as both origin and terminal', () => {
    const stopTimes = makeFullStopTimes(1);
    expect(getOriginStop(stopTimes)).toBe(stopTimes[0]);
    expect(getTerminalStop(stopTimes)).toBe(stopTimes[0]);
    expect(getPatternTotalStops(stopTimes)).toBe(1);
  });
});
