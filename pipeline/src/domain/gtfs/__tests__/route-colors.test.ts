import { describe, expect, it } from 'vitest';

import { isRouteColorUnset, resolvePipelineRouteColors } from '../route-colors';

describe('isRouteColorUnset', () => {
  it('treats empty route_color as unset', () => {
    expect(isRouteColorUnset('', '')).toBe(true);
    expect(isRouteColorUnset('', 'FFFFFF')).toBe(true);
  });

  it('treats identical non-white color pairs as unset', () => {
    expect(isRouteColorUnset('000000', '000000')).toBe(true);
    expect(isRouteColorUnset('CF3366', 'CF3366')).toBe(true);
  });

  it('preserves explicit white-on-white values', () => {
    expect(isRouteColorUnset('FFFFFF', 'FFFFFF')).toBe(false);
  });

  it('preserves mixed non-empty pairs', () => {
    expect(isRouteColorUnset('CF3366', '')).toBe(false);
    expect(isRouteColorUnset('00377E', 'FFFFFF')).toBe(false);
  });
});

describe('resolvePipelineRouteColors', () => {
  it('returns raw values when no fallback is needed', () => {
    expect(
      resolvePipelineRouteColors({
        routeId: 'R001',
        rawColor: '00377E',
        rawTextColor: 'FFFFFF',
        routeColorFallbacks: { '*': '2E7D32' },
      }),
    ).toEqual({
      color: '00377E',
      textColor: 'FFFFFF',
      colorUnset: false,
      usedFallback: false,
    });
  });

  it('applies wildcard fallback with white text', () => {
    expect(
      resolvePipelineRouteColors({
        routeId: 'R001',
        rawColor: '',
        rawTextColor: '',
        routeColorFallbacks: { '*': '2E7D32' },
      }),
    ).toEqual({
      color: '2E7D32',
      textColor: '',
      colorUnset: true,
      usedFallback: true,
    });
  });

  it('prefers route-specific fallback over wildcard', () => {
    expect(
      resolvePipelineRouteColors({
        routeId: 'R001',
        rawColor: '',
        rawTextColor: '',
        routeColorFallbacks: { R001: 'FF0000', '*': '2E7D32' },
      }),
    ).toEqual({
      color: 'FF0000',
      textColor: '',
      colorUnset: true,
      usedFallback: true,
    });
  });

  it('keeps text-only values when no fallback color exists', () => {
    expect(
      resolvePipelineRouteColors({
        routeId: 'R001',
        rawColor: '',
        rawTextColor: '123456',
        routeColorFallbacks: {},
      }),
    ).toEqual({
      color: '',
      textColor: '123456',
      colorUnset: true,
      usedFallback: false,
    });
  });

  it('treats identical non-white color pairs as unset and uses fallback when available', () => {
    expect(
      resolvePipelineRouteColors({
        routeId: 'R001',
        rawColor: '000000',
        rawTextColor: '000000',
        routeColorFallbacks: { '*': '1565C0' },
      }),
    ).toEqual({
      color: '1565C0',
      textColor: '000000',
      colorUnset: true,
      usedFallback: true,
    });
  });

  it('drops identical non-white color pairs to empty color without fallback', () => {
    expect(
      resolvePipelineRouteColors({
        routeId: 'R001',
        rawColor: '000000',
        rawTextColor: '000000',
        routeColorFallbacks: {},
      }),
    ).toEqual({
      color: '',
      textColor: '000000',
      colorUnset: true,
      usedFallback: true,
    });
  });
});
