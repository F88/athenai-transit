import { describe, expect, it } from 'vitest';

import { makeStopMeta } from '../../../__tests__/helpers';
import type { StopWithMeta } from '../../../types/app/transit-composed';
import { filterStopsWithinDistance } from '../stop-meta-filter';

/** A stop meta at a given distance (metres), with a unique id for assertions. */
function stopAtDistance(stopId: string, distance: number | undefined): StopWithMeta {
  return { ...makeStopMeta(stopId), distance };
}

describe('filterStopsWithinDistance', () => {
  it('keeps stops within the distance and drops the ones beyond it', () => {
    const near = stopAtDistance('near', 50);
    const far = stopAtDistance('far', 150);

    expect(filterStopsWithinDistance([near, far], 100)).toEqual([near]);
  });

  it('keeps a stop exactly at the max distance (boundary is inclusive)', () => {
    const onEdge = stopAtDistance('edge', 100);

    expect(filterStopsWithinDistance([onEdge], 100)).toEqual([onEdge]);
  });

  it('keeps a stop at distance 0', () => {
    const here = stopAtDistance('here', 0);

    expect(filterStopsWithinDistance([here], 100)).toEqual([here]);
  });

  it('drops stops whose distance is undefined', () => {
    const unknown = stopAtDistance('unknown', undefined);
    const near = stopAtDistance('near', 10);

    expect(filterStopsWithinDistance([unknown, near], 100)).toEqual([near]);
  });

  it('returns an empty array when no stop is within the distance', () => {
    const far = stopAtDistance('far', 500);

    expect(filterStopsWithinDistance([far], 100)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(filterStopsWithinDistance([], 100)).toEqual([]);
  });

  it('preserves the input order of the surviving stops', () => {
    const a = stopAtDistance('a', 10);
    const b = stopAtDistance('b', 90);
    const c = stopAtDistance('c', 40);

    const result = filterStopsWithinDistance([a, b, c], 100);

    expect(result.map((s) => s.stop.stop_id)).toEqual(['a', 'b', 'c']);
  });
});
