import { describe, expect, it } from 'vitest';
import {
  getAdjustedRouteColors,
  normalizeResolvedRouteColors,
  normalizeRouteGtfsColors,
  resolveRouteColors,
} from '../route-colors';

describe('normalizeRouteGtfsColors', () => {
  it('keeps explicit route colors unchanged', () => {
    expect(normalizeRouteGtfsColors('1976D2', 'FFFFFF')).toEqual({
      routeColor: '1976D2',
      routeTextColor: 'FFFFFF',
    });
  });

  it('uppercases valid lowercase GTFS Color values', () => {
    expect(normalizeRouteGtfsColors('abcdef', 'fedcba')).toEqual({
      routeColor: 'ABCDEF',
      routeTextColor: 'FEDCBA',
    });
  });

  it('applies defaults when both colors are omitted', () => {
    expect(normalizeRouteGtfsColors('', '')).toEqual({
      routeColor: '333333',
      routeTextColor: 'F1F1F1',
    });
  });

  it('keeps the normalized default text color when the pair ratio is at least 1.2', () => {
    expect(normalizeRouteGtfsColors('FBD074', '')).toEqual({
      routeColor: 'FBD074',
      routeTextColor: 'F1F1F1',
    });
  });

  it('replaces an identical text color with a readable fallback', () => {
    expect(normalizeRouteGtfsColors('000000', '000000')).toEqual({
      routeColor: '000000',
      routeTextColor: 'FFFFFF',
    });
  });

  it('replaces a severely low-contrast explicit text color with a readable fallback', () => {
    expect(normalizeRouteGtfsColors('000000', '000001')).toEqual({
      routeColor: '000000',
      routeTextColor: 'FFFFFF',
    });
  });
});

describe('normalizeResolvedRouteColors', () => {
  it('returns CSS-ready normalized values', () => {
    expect(
      normalizeResolvedRouteColors(
        {
          route_color: '',
          route_text_color: '',
        },
        'css-hex',
      ),
    ).toEqual({
      routeColor: '#333333',
      routeTextColor: '#F1F1F1',
    });
  });
});

describe('resolveRouteColors', () => {
  it('keeps explicit route colors unchanged', () => {
    expect(
      resolveRouteColors({
        route_color: '1976D2',
        route_text_color: 'FFFFFF',
      }),
    ).toEqual({
      routeColor: '1976D2',
      routeTextColor: 'FFFFFF',
    });
  });

  it('derives a readable text color when only route_color exists', () => {
    expect(
      resolveRouteColors({
        route_color: 'FBD074',
        route_text_color: '',
      }),
    ).toEqual({
      routeColor: 'FBD074',
      routeTextColor: '000000',
    });
  });

  it('returns route_text_color when route_color is missing', () => {
    expect(
      resolveRouteColors({
        route_color: '',
        route_text_color: 'FFFFFF',
      }),
    ).toEqual({
      routeTextColor: 'FFFFFF',
    });
  });

  it('returns no colors when both route fields are missing', () => {
    expect(
      resolveRouteColors({
        route_color: '',
        route_text_color: '',
      }),
    ).toEqual({});
  });

  it('preserves an explicit route_text_color even when contrast is low', () => {
    expect(
      resolveRouteColors({
        route_color: '000000',
        route_text_color: '000101',
      }),
    ).toEqual({
      routeColor: '000000',
      routeTextColor: '000101',
    });
  });

  it('preserves an explicit near-black text color when it is not exactly the same', () => {
    expect(
      resolveRouteColors({
        route_color: '000000',
        route_text_color: '000001',
      }),
    ).toEqual({
      routeColor: '000000',
      routeTextColor: '000001',
    });
  });

  it('replaces an identical explicit text color with a readable fallback', () => {
    expect(
      resolveRouteColors({
        route_color: '000000',
        route_text_color: '000000',
      }),
    ).toEqual({
      routeColor: '000000',
      routeTextColor: 'FFFFFF',
    });
  });

  it('replaces an identical white text color with a readable fallback', () => {
    expect(
      resolveRouteColors({
        route_color: 'FFFFFF',
        route_text_color: 'FFFFFF',
      }),
    ).toEqual({
      routeColor: 'FFFFFF',
      routeTextColor: '000000',
    });
  });

  it('preserves an explicit near-white text color when it is not exactly the same', () => {
    expect(
      resolveRouteColors({
        route_color: 'FFFFFF',
        route_text_color: 'FFFFFE',
      }),
    ).toEqual({
      routeColor: 'FFFFFF',
      routeTextColor: 'FFFFFE',
    });
  });

  it('preserves an explicit GTFS white text color on an orange route', () => {
    expect(
      resolveRouteColors({
        route_color: 'E26B0A',
        route_text_color: 'FFFFFF',
      }),
    ).toEqual({
      routeColor: 'E26B0A',
      routeTextColor: 'FFFFFF',
    });
  });

  it('treats invalid GTFS colors as omitted', () => {
    expect(
      resolveRouteColors({
        route_color: 'zzzzzz',
        route_text_color: 'FFFFFF',
      }),
    ).toEqual({
      routeTextColor: 'FFFFFF',
    });
  });

  it('returns CSS-ready values when format is css-hex', () => {
    expect(
      resolveRouteColors(
        {
          route_color: '1976D2',
          route_text_color: '',
        },
        'css-hex',
      ),
    ).toEqual({
      routeColor: '#1976D2',
      routeTextColor: '#FFFFFF',
    });
  });
});

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
      color: 'F1F1F1',
      textColor: '333333',
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
      color: '#333333',
      textColor: '#F1F1F1',
    });
  });
});
