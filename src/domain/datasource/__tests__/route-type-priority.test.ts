/**
 * Tests for route-type-priority.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { ROUTE_TYPE_DISPLAY_ORDER } from '../../transit/route-type-display-order';
import { ROUTE_TYPE_OTHER, ROUTE_TYPE_PRIORITY } from '../route-type-priority';

describe('ROUTE_TYPE_PRIORITY', () => {
  it('is the shared display order minus the Unknown (-1) sentinel', () => {
    expect(ROUTE_TYPE_PRIORITY).toEqual(ROUTE_TYPE_DISPLAY_ORDER.filter((value) => value !== -1));
  });

  it('excludes the -1 unknown sentinel (handled by the "other" bucket)', () => {
    expect(ROUTE_TYPE_PRIORITY).not.toContain(-1);
  });

  it('exposes ROUTE_TYPE_OTHER as the string "other"', () => {
    expect(ROUTE_TYPE_OTHER).toBe('other');
  });
});
