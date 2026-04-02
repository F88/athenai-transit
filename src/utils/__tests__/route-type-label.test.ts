import { describe, it, expect } from 'vitest';
import { routeTypeLabel } from '../route-type-label';

describe('routeTypeLabel', () => {
  it('returns "T" for tram (0)', () => {
    expect(routeTypeLabel(0)).toBe('T');
  });

  it('returns "M" for subway (1)', () => {
    expect(routeTypeLabel(1)).toBe('M');
  });

  it('returns "駅" for rail (2)', () => {
    expect(routeTypeLabel(2)).toBe('駅');
  });

  it('returns "B" for bus (3)', () => {
    expect(routeTypeLabel(3)).toBe('B');
  });

  it('returns "駅" for unknown route types', () => {
    expect(routeTypeLabel(4)).toBe('駅');
    expect(routeTypeLabel(7)).toBe('駅');
    expect(routeTypeLabel(99)).toBe('駅');
    expect(routeTypeLabel(-1)).toBe('駅');
  });
});
