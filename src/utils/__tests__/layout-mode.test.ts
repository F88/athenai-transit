import { describe, expect, it } from 'vitest';
import { resolveLayoutMode, WIDE_VIEWPORT_MIN_WIDTH } from '../layout-mode';

describe('resolveLayoutMode', () => {
  it('returns simple for narrow (smartphone) viewports', () => {
    expect(resolveLayoutMode({ width: 390, height: 844 })).toBe('simple');
  });

  it('returns simple just below the multi-pane threshold', () => {
    expect(resolveLayoutMode({ width: WIDE_VIEWPORT_MIN_WIDTH - 1, height: 800 })).toBe('simple');
  });

  it('returns multi-pane exactly at the multi-pane threshold', () => {
    expect(resolveLayoutMode({ width: WIDE_VIEWPORT_MIN_WIDTH, height: 800 })).toBe('multi-pane');
  });

  it('returns multi-pane for wide (PC / landscape tablet) viewports', () => {
    expect(resolveLayoutMode({ width: 1440, height: 900 })).toBe('multi-pane');
  });

  it('returns simple when the viewport width is unavailable', () => {
    expect(resolveLayoutMode({ width: 0, height: 0 })).toBe('simple');
  });
});
