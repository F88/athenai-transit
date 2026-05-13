/**
 * Tests for route-type-priority.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { ROUTE_TYPE_OTHER, ROUTE_TYPE_PRIORITY } from '../route-type-priority';

describe('ROUTE_TYPE_PRIORITY', () => {
  it('begins with Bus (3) as the top-priority route type', () => {
    expect(ROUTE_TYPE_PRIORITY[0]).toBe(3);
  });

  it('places Tram (0) immediately after Bus', () => {
    expect(ROUTE_TYPE_PRIORITY[1]).toBe(0);
  });

  it('places Rail (2) ahead of Subway (1)', () => {
    expect(ROUTE_TYPE_PRIORITY.indexOf(2)).toBeLessThan(ROUTE_TYPE_PRIORITY.indexOf(1));
  });

  it('places Subway (1) ahead of Ferry (4)', () => {
    expect(ROUTE_TYPE_PRIORITY.indexOf(1)).toBeLessThan(ROUTE_TYPE_PRIORITY.indexOf(4));
  });

  it('lists every GTFS route_type value the app supports except the "-1" unknown sentinel', () => {
    // -1 is the AppRouteTypeValue sentinel for "unknown" and is placed in
    // the dedicated `other` bucket, not in the priority list.
    expect([...ROUTE_TYPE_PRIORITY].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 11, 12,
    ]);
  });

  it('does not contain duplicate entries', () => {
    expect(new Set(ROUTE_TYPE_PRIORITY).size).toBe(ROUTE_TYPE_PRIORITY.length);
  });

  it('exposes ROUTE_TYPE_OTHER as the string "other"', () => {
    expect(ROUTE_TYPE_OTHER).toBe('other');
  });
});
