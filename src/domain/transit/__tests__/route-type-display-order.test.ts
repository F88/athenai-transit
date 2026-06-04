import { describe, expect, it } from 'vitest';

import { ROUTE_TYPE_DISPLAY_ORDER } from '../route-type-display-order';

describe('ROUTE_TYPE_DISPLAY_ORDER', () => {
  it('matches the defined display order exactly', () => {
    expect(ROUTE_TYPE_DISPLAY_ORDER).toEqual([3, 11, 0, 2, 1, 12, 4, 5, 6, 7, -1]);
  });
});
