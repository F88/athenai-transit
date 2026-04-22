import { describe, expect, it } from 'vitest';
import { resolveContextBorderColor } from '../context-border-color';

const LIGHT_BG = '#ffffff';
const DARK_BG = '#111827';

describe('resolveContextBorderColor', () => {
  it('returns routeColor when it already has sufficient contrast against the theme', () => {
    const result = resolveContextBorderColor('#FF0000', '#FFFFFF', LIGHT_BG);
    expect(result).toBe('#FF0000');
  });

  it('falls through to routeTextColor when routeColor is low-contrast against the theme', () => {
    // #F5F5F5 (near white) vs #FFFFFF is clearly below the 1.2 threshold;
    // #000000 (black) has strong contrast against white.
    const result = resolveContextBorderColor('#F5F5F5', '#000000', LIGHT_BG);
    expect(result).toBe('#000000');
  });

  it('returns routeTextColor even when it is also low-contrast', () => {
    // Both near-white shades fail against the light theme bg; the
    // function trusts the color resolver upstream and still hands back
    // routeTextColor as the caller-owned final value.
    const result = resolveContextBorderColor('#F5F5F5', '#FAFAFA', LIGHT_BG);
    expect(result).toBe('#FAFAFA');
  });

  it('handles the dark theme by cascading against #111827', () => {
    // #111 is near-black: indistinguishable from the dark theme bg.
    // #FFFFFF (white) has strong contrast.
    const result = resolveContextBorderColor('#111111', '#FFFFFF', DARK_BG);
    expect(result).toBe('#FFFFFF');
  });

  it('treats an un-parseable routeColor as cascade failure and uses routeTextColor', () => {
    const result = resolveContextBorderColor('', '#000000', LIGHT_BG);
    expect(result).toBe('#000000');
  });

  it('returns routeTextColor as-is even when both inputs are empty strings', () => {
    // The resolver upstream guarantees usable colors; the function is
    // content to hand back whatever routeTextColor was passed.
    const result = resolveContextBorderColor('', '', LIGHT_BG);
    expect(result).toBe('');
  });

  it('respects a custom minRatio threshold', () => {
    // #888888 vs #FFFFFF has ratio ~3.5: passes at threshold 1.2,
    // fails at threshold 5.0.
    const permissive = resolveContextBorderColor('#888888', '#000000', LIGHT_BG, 1.2);
    expect(permissive).toBe('#888888');

    const strict = resolveContextBorderColor('#888888', '#000000', LIGHT_BG, 5.0);
    expect(strict).toBe('#000000');
  });
});
