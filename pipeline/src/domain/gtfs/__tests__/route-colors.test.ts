import { describe, expect, it } from 'vitest';

import { resolvePipelineRouteColors } from '../route-colors';

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

  it('applies wildcard fallback without synthesizing textColor', () => {
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

  it('preserves identical non-empty color pairs without fallback', () => {
    expect(
      resolvePipelineRouteColors({
        routeId: 'R001',
        rawColor: '000000',
        rawTextColor: '000000',
        routeColorFallbacks: { '*': '1565C0' },
      }),
    ).toEqual({
      color: '000000',
      textColor: '000000',
      colorUnset: false,
      usedFallback: false,
    });
  });
});
