import { describe, expect, it } from 'vitest';
import { isWideViewport, WIDE_VIEWPORT_MIN_WIDTH } from '../layout-mode';

describe('isWideViewport', () => {
  it('returns false for narrow (smartphone) viewports', () => {
    expect(isWideViewport(390)).toBe(false);
  });

  it('returns false just below the wide threshold', () => {
    expect(isWideViewport(WIDE_VIEWPORT_MIN_WIDTH - 1)).toBe(false);
  });

  it('returns true exactly at the wide threshold', () => {
    expect(isWideViewport(WIDE_VIEWPORT_MIN_WIDTH)).toBe(true);
  });

  it('returns true for wide (PC / landscape tablet) viewports', () => {
    expect(isWideViewport(1440)).toBe(true);
  });

  it('returns false when viewport width is unavailable', () => {
    expect(isWideViewport(0)).toBe(false);
  });
});
