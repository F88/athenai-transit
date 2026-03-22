/**
 * Tests for build-service-groups.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { CalendarJson } from '../../../../../../src/types/data/transit-json';
import { buildServiceGroups } from '../build-service-groups';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a CalendarJson with specified services (no exceptions). */
function makeCalendar(
  services: { id: string; d: number[] }[],
  exceptions: CalendarJson['exceptions'] = [],
): CalendarJson {
  return {
    services: services.map((s) => ({
      i: s.id,
      d: s.d,
      s: '20260101',
      e: '20261231',
    })),
    exceptions,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildServiceGroups', () => {
  it('returns empty array for empty calendar', () => {
    const result = buildServiceGroups({ services: [], exceptions: [] });
    expect(result).toEqual([]);
  });

  it('groups standard weekday/saturday/sunday pattern', () => {
    const calendar = makeCalendar([
      { id: 'svc-wd-1', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'svc-wd-2', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'svc-sa', d: [0, 0, 0, 0, 0, 1, 0] },
      { id: 'svc-su', d: [0, 0, 0, 0, 0, 0, 1] },
    ]);

    const result = buildServiceGroups(calendar);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ key: 'wd', serviceIds: ['svc-wd-1', 'svc-wd-2'] });
    expect(result[1]).toEqual({ key: 'sa', serviceIds: ['svc-sa'] });
    expect(result[2]).toEqual({ key: 'su', serviceIds: ['svc-su'] });
  });

  it('recognizes every-day pattern as "all"', () => {
    const calendar = makeCalendar([{ id: 'svc-all', d: [1, 1, 1, 1, 1, 1, 1] }]);

    const result = buildServiceGroups(calendar);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'all', serviceIds: ['svc-all'] });
  });

  it('recognizes weekend pattern as "wk"', () => {
    const calendar = makeCalendar([
      { id: 'svc-wd', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'svc-wk', d: [0, 0, 0, 0, 0, 1, 1] },
    ]);

    const result = buildServiceGroups(calendar);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: 'wd', serviceIds: ['svc-wd'] });
    expect(result[1]).toEqual({ key: 'wk', serviceIds: ['svc-wk'] });
  });

  it('generates hash-based key for unknown patterns', () => {
    const calendar = makeCalendar([{ id: 'svc-mwf', d: [1, 0, 1, 0, 1, 0, 0] }]);

    const result = buildServiceGroups(calendar);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('d1010100');
    expect(result[0].serviceIds).toEqual(['svc-mwf']);
  });

  it('sorts known patterns by priority (wd → sa → su → wk → all)', () => {
    const calendar = makeCalendar([
      { id: 'svc-su', d: [0, 0, 0, 0, 0, 0, 1] },
      { id: 'svc-all', d: [1, 1, 1, 1, 1, 1, 1] },
      { id: 'svc-wd', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'svc-sa', d: [0, 0, 0, 0, 0, 1, 0] },
      { id: 'svc-wk', d: [0, 0, 0, 0, 0, 1, 1] },
    ]);

    const result = buildServiceGroups(calendar);
    const keys = result.map((g) => g.key);

    expect(keys).toEqual(['wd', 'sa', 'su', 'wk', 'all']);
  });

  it('places unknown patterns after known patterns, sorted alphabetically', () => {
    const calendar = makeCalendar([
      { id: 'svc-custom-b', d: [0, 1, 0, 1, 0, 0, 0] },
      { id: 'svc-wd', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'svc-custom-a', d: [1, 0, 1, 0, 1, 0, 0] },
    ]);

    const result = buildServiceGroups(calendar);
    const keys = result.map((g) => g.key);

    // wd first (known), then unknown alphabetically
    expect(keys[0]).toBe('wd');
    // d0101000 < d1010100 alphabetically
    expect(keys[1]).toBe('d0101000');
    expect(keys[2]).toBe('d1010100');
  });

  it('handles single service', () => {
    const calendar = makeCalendar([{ id: 'only-one', d: [1, 1, 1, 1, 1, 0, 0] }]);

    const result = buildServiceGroups(calendar);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'wd', serviceIds: ['only-one'] });
  });

  it('assigns each service_id to exactly one group', () => {
    const calendar = makeCalendar([
      { id: 'a', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'b', d: [1, 1, 1, 1, 1, 0, 0] },
      { id: 'c', d: [0, 0, 0, 0, 0, 1, 0] },
      { id: 'd', d: [0, 0, 0, 0, 0, 0, 1] },
      { id: 'e', d: [1, 0, 1, 0, 1, 0, 0] },
    ]);

    const result = buildServiceGroups(calendar);

    // Collect all serviceIds across all groups
    const allIds = result.flatMap((g) => g.serviceIds);
    const uniqueIds = new Set(allIds);

    // Each ID appears exactly once
    expect(allIds).toHaveLength(uniqueIds.size);
    expect(uniqueIds).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
  });

  it('ignores calendar_dates exceptions for grouping', () => {
    const calendar = makeCalendar(
      [
        { id: 'svc-wd', d: [1, 1, 1, 1, 1, 0, 0] },
        { id: 'svc-su', d: [0, 0, 0, 0, 0, 0, 1] },
      ],
      [
        // Exceptions should not affect grouping
        { i: 'svc-wd', d: '20260101', t: 2 }, // removed on New Year
        { i: 'svc-su', d: '20260101', t: 1 }, // added on New Year
      ],
    );

    const result = buildServiceGroups(calendar);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: 'wd', serviceIds: ['svc-wd'] });
    expect(result[1]).toEqual({ key: 'su', serviceIds: ['svc-su'] });
  });
});
