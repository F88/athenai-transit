import { describe, expect, it } from 'vitest';
import { getAdjustedRouteColors } from '../route-colors';

describe('getAdjustedRouteColors', () => {
  it('keeps the original route colors when contrast is sufficient', () => {
    expect(
      getAdjustedRouteColors(
        {
          route_color: '1976D2',
          route_text_color: 'FFFFFF',
        },
        false,
      ),
    ).toEqual({
      color: '1976D2',
      textColor: 'FFFFFF',
    });
  });

  it('returns CSS-ready colors when format is css-hex', () => {
    expect(
      getAdjustedRouteColors(
        {
          route_color: '1976D2',
          route_text_color: 'FFFFFF',
        },
        false,
        'css-hex',
      ),
    ).toEqual({
      color: '#1976D2',
      textColor: '#FFFFFF',
    });
  });

  it('swaps route and text colors when the route color is low contrast', () => {
    expect(
      getAdjustedRouteColors(
        {
          route_color: 'FFFFFF',
          route_text_color: '111827',
        },
        true,
      ),
    ).toEqual({
      color: '111827',
      textColor: 'FFFFFF',
    });
  });

  it('falls back to GTFS defaults when colors are omitted', () => {
    expect(
      getAdjustedRouteColors(
        {
          route_color: '',
          route_text_color: '',
        },
        true,
      ),
    ).toEqual({
      color: '000000',
      textColor: 'FFFFFF',
    });
  });

  it('applies GTFS defaults before CSS formatting', () => {
    expect(
      getAdjustedRouteColors(
        {
          route_color: '',
          route_text_color: '',
        },
        false,
        'css-hex',
      ),
    ).toEqual({
      color: '#FFFFFF',
      textColor: '#000000',
    });
  });
});
