import { describe, expect, it } from 'vitest';

import { resolveMapMaxZoom } from '../map-max-zoom';

describe('resolveMapMaxZoom', () => {
  const tileSources = [{}, { maxZoom: 16 }, { maxZoom: 18 }] as const;

  it('returns the default when tiles are disabled', () => {
    expect(resolveMapMaxZoom(null, tileSources, 20)).toBe(20);
  });

  it('returns the default when the active tile source has no maxZoom override', () => {
    expect(resolveMapMaxZoom(0, tileSources, 20)).toBe(20);
  });

  it('returns the tile-specific maxZoom when defined', () => {
    expect(resolveMapMaxZoom(1, tileSources, 20)).toBe(16);
    expect(resolveMapMaxZoom(2, tileSources, 20)).toBe(18);
  });

  it('returns the default for an out-of-range tile index', () => {
    expect(resolveMapMaxZoom(99, tileSources, 20)).toBe(20);
  });
});
