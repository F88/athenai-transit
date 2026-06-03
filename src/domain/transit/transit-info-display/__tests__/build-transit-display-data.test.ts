/**
 * Tests for build-transit-display-data.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { agencyTobus, baseStop, busRoute, createEntry } from '../../../../stories/fixtures';
import type { InfoLevel } from '../../../../types/app/settings';
import type {
  ContextualTimetableEntry,
  StopWithContext,
} from '../../../../types/app/transit-composed';
import {
  selectTransitDisplayEntries,
  transitDisplayMaxEntriesFor,
} from '../build-transit-display-data';

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

/** Wrap entries into a minimal {@link StopWithContext} with the given stop id. */
function makeStop(stopId: string, stopTimes: ContextualTimetableEntry[]): StopWithContext {
  return {
    stop: { ...baseStop, stop_id: stopId },
    agencies: [agencyTobus],
    routes: [busRoute],
    routeTypes: [3],
    stopTimes,
    stopServiceState: 'boardable',
  };
}

describe('selectTransitDisplayEntries', () => {
  it("flattens every stop's stopTimes into candidates paired with their stop", () => {
    const stopA = makeStop('A', [createEntry({ departureMinutes: 600 })]);
    const stopB = makeStop('B', [
      createEntry({ departureMinutes: 660 }),
      createEntry({ departureMinutes: 720 }),
    ]);

    const result = selectTransitDisplayEntries([stopA, stopB], 'departures');

    expect(result).toHaveLength(3);
    // Each candidate keeps the reference to the stop context it came from.
    const fromA = result.filter((c) => c.stopWithContext.stop.stop_id === 'A');
    const fromB = result.filter((c) => c.stopWithContext.stop.stop_id === 'B');
    expect(fromA).toHaveLength(1);
    expect(fromB).toHaveLength(2);
  });

  it('orders by departure time (earliest first) on the departure basis', () => {
    const stop = makeStop('A', [
      createEntry({ departureMinutes: 900 }),
      createEntry({ departureMinutes: 600 }),
      createEntry({ departureMinutes: 750 }),
    ]);

    const result = selectTransitDisplayEntries([stop], 'departures');

    expect(result.map((c) => c.entry.schedule.departureMinutes)).toEqual([600, 750, 900]);
  });

  it('orders by arrival time on the arrival basis (independent of departure order)', () => {
    // Departure order would be [600, 900]; arrival order is [610, 999].
    const early = createEntry({ departureMinutes: 600, arrivalMinutes: 999 });
    const late = createEntry({ departureMinutes: 900, arrivalMinutes: 610 });
    const stop = makeStop('A', [early, late]);

    const result = selectTransitDisplayEntries([stop], 'arrivals');

    expect(result.map((c) => c.entry.schedule.arrivalMinutes)).toEqual([610, 999]);
  });

  it('merges entries across stops into one chronological order', () => {
    const stopA = makeStop('A', [createEntry({ departureMinutes: 800 })]);
    const stopB = makeStop('B', [createEntry({ departureMinutes: 700 })]);

    const result = selectTransitDisplayEntries([stopA, stopB], 'departures');

    expect(result.map((c) => c.stopWithContext.stop.stop_id)).toEqual(['B', 'A']);
  });

  it('caps the result to maxEntries, keeping the earliest', () => {
    const stop = makeStop('A', [
      createEntry({ departureMinutes: 900 }),
      createEntry({ departureMinutes: 600 }),
      createEntry({ departureMinutes: 750 }),
      createEntry({ departureMinutes: 660 }),
    ]);

    const result = selectTransitDisplayEntries([stop], 'departures', 2);

    expect(result.map((c) => c.entry.schedule.departureMinutes)).toEqual([600, 660]);
  });

  it('treats service-day minutes >= 1440 as the next day when ordering', () => {
    // 25:00 (1500) is later than 01:00 (60) on the same service date.
    const afterMidnight = createEntry({ departureMinutes: 1500 });
    const earlyMorning = createEntry({ departureMinutes: 60 });
    const stop = makeStop('A', [afterMidnight, earlyMorning]);

    const result = selectTransitDisplayEntries([stop], 'departures');

    expect(result.map((c) => c.entry.schedule.departureMinutes)).toEqual([60, 1500]);
  });

  it('returns an empty array for no stops or stops with no entries', () => {
    expect(selectTransitDisplayEntries([], 'departures')).toEqual([]);
    expect(selectTransitDisplayEntries([makeStop('A', [])], 'departures')).toEqual([]);
  });

  it('returns an empty array when maxEntries is 0', () => {
    const stop = makeStop('A', [createEntry({ departureMinutes: 600 })]);
    expect(selectTransitDisplayEntries([stop], 'departures', 0)).toEqual([]);
  });
});
