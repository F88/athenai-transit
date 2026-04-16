import { describe, it, expect } from 'vitest';
import { contrastRatio, passesAA, suggestTextColor } from '../color-contrast';

describe('contrastRatio', () => {
  it('returns the maximum WCAG ratio (21) for black vs white', () => {
    const r = contrastRatio('#000000', '#ffffff');
    expect(r?.ratio).toBe(21);
    expect(r?.levelAA).toBe(true);
    expect(r?.levelAAA).toBe(true);
    expect(r?.levelAAALarge).toBe(true);
  });

  it('returns 1 for identical colors', () => {
    const r = contrastRatio('#abcdef', '#abcdef');
    expect(r?.ratio).toBe(1);
    expect(r?.levelAA).toBe(false);
    expect(r?.levelAAA).toBe(false);
    expect(r?.levelAAALarge).toBe(false);
  });

  it('is symmetric (order of fg and bg does not matter)', () => {
    const a = contrastRatio('#123456', '#fedcba');
    const b = contrastRatio('#fedcba', '#123456');
    expect(a?.ratio).toBe(b?.ratio);
  });

  it('supports shorthand hex (#rgb)', () => {
    const full = contrastRatio('#000000', '#ffffff');
    const short = contrastRatio('#000', '#fff');
    expect(short?.ratio).toBe(full?.ratio);
  });

  it('supports rgb() strings', () => {
    const r = contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    expect(r?.ratio).toBe(21);
  });

  it('supports rgb() with percentage values', () => {
    // rgb(100%, 100%, 100%) must scale to (255, 255, 255), not (100, 100, 100).
    const r = contrastRatio('rgb(100%, 100%, 100%)', 'rgb(0%, 0%, 0%)');
    expect(r?.ratio).toBe(21);
  });

  it('treats rgb() percentage and integer forms as equivalent', () => {
    // 50% ≈ 127.5, very close to integer 128.
    const pct = contrastRatio('rgb(50%, 50%, 50%)', '#ffffff');
    const int = contrastRatio('rgb(128, 128, 128)', '#ffffff');
    expect(pct).not.toBeNull();
    expect(int).not.toBeNull();
    expect(Math.abs((pct?.ratio ?? 0) - (int?.ratio ?? 0))).toBeLessThan(0.1);
  });

  it('supports rgba() by ignoring the alpha channel', () => {
    const withAlpha = contrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff');
    const withoutAlpha = contrastRatio('rgb(0, 0, 0)', '#ffffff');
    expect(withAlpha?.ratio).toBe(withoutAlpha?.ratio);
  });

  it('supports hsl() strings', () => {
    // hsl(0, 0%, 0%) = black, hsl(0, 0%, 100%) = white
    const r = contrastRatio('hsl(0, 0%, 0%)', 'hsl(0, 0%, 100%)');
    expect(r?.ratio).toBe(21);
  });

  it('supports hsla() by ignoring the alpha channel', () => {
    const withAlpha = contrastRatio('hsla(0, 0%, 0%, 0.5)', 'hsl(0, 0%, 100%)');
    const withoutAlpha = contrastRatio('hsl(0, 0%, 0%)', 'hsl(0, 0%, 100%)');
    expect(withAlpha?.ratio).toBe(withoutAlpha?.ratio);
  });

  it('supports hsla() with slash-separated alpha', () => {
    // Per CSS Color Module Level 4: hsla(h s% l% / a)
    const withAlpha = contrastRatio('hsla(0 0% 0% / 0.5)', 'hsl(0, 0%, 100%)');
    const withoutAlpha = contrastRatio('hsl(0, 0%, 0%)', 'hsl(0, 0%, 100%)');
    expect(withAlpha?.ratio).toBe(withoutAlpha?.ratio);
  });

  it('computes #777 on white as ~4.48 (mid-gray WCAG reference)', () => {
    // Known WCAG value for mid-gray on white — used as a regression
    // guard against luminance formula drift. The raw ratio is not
    // rounded by the implementation, so match against two decimal
    // places rather than an exact 4.48.
    const r = contrastRatio('#777777', '#ffffff');
    expect(r?.ratio).toBeCloseTo(4.48, 2);
    // The raw ratio is just below the WCAG AA normal-text threshold
    // (4.5). Guards against an implementation that rounds before
    // comparing, which would incorrectly flip levelAA to true.
    expect(r?.levelAA).toBe(false);
    expect(r?.levelAAA).toBe(false);
  });

  it('exposes the unrounded ratio so threshold checks stay consistent', () => {
    // A value just under 4.5 must not round up to 4.5 in `ratio` —
    // otherwise callers comparing `ratio >= 4.5` would disagree with
    // `levelAA`. This locks in the "raw ratio" contract.
    const r = contrastRatio('#777777', '#ffffff');
    expect(r?.ratio).toBeLessThan(4.5);
    expect(r?.levelAA).toBe(false);
  });

  it('passes AAA (>= 7) just above the normal-text threshold', () => {
    // #585858 on white ≈ 7.11 — meets AAA normal text.
    const r = contrastRatio('#585858', '#ffffff');
    expect(r?.ratio).toBeGreaterThanOrEqual(7);
    expect(r?.levelAAA).toBe(true);
  });

  it('fails AAA (< 7) just below the normal-text threshold', () => {
    // #5a5a5a on white ≈ 6.90 — fails AAA but still passes AA.
    const r = contrastRatio('#5a5a5a', '#ffffff');
    expect(r?.ratio).toBeGreaterThan(6);
    expect(r?.ratio).toBeLessThan(7);
    expect(r?.levelAAA).toBe(false);
    expect(r?.levelAA).toBe(true);
  });

  it('returns null for invalid foreground', () => {
    expect(contrastRatio('not-a-color', '#ffffff')).toBeNull();
    expect(contrastRatio('#12', '#ffffff')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(contrastRatio('', '#ffffff')).toBeNull();
    expect(contrastRatio('#ffffff', '')).toBeNull();
  });

  it('returns null for hex with non-hex characters', () => {
    // #ggg used to silently parse as black (NaN >> 16 === 0).
    expect(contrastRatio('#ggg', '#ffffff')).toBeNull();
    expect(contrastRatio('#gggggg', '#ffffff')).toBeNull();
  });

  it('returns null for hex with a trailing non-hex character', () => {
    // #fffffg used to parse only the valid `fffff` prefix and
    // silently return a wrong color.
    expect(contrastRatio('#fffffg', '#000000')).toBeNull();
  });

  it('clamps out-of-range rgb() channels to [0, 255]', () => {
    // Browsers treat rgb(999, 999, 999) as rgb(255, 255, 255); the
    // implementation must match so the ratio stays within [1, 21].
    const clamped = contrastRatio('rgb(999, 999, 999)', '#000000');
    const white = contrastRatio('rgb(255, 255, 255)', '#000000');
    expect(clamped?.ratio).toBe(white?.ratio);
  });

  it('clamps negative rgb() channels to 0', () => {
    const clamped = contrastRatio('rgb(-10, -10, -10)', '#ffffff');
    const black = contrastRatio('rgb(0, 0, 0)', '#ffffff');
    expect(clamped?.ratio).toBe(black?.ratio);
  });

  it('clamps out-of-range hsl() lightness to [0, 1]', () => {
    // hsl(0, 0%, 150%) should behave like white (l clamps to 1).
    const clamped = contrastRatio('hsl(0, 0%, 150%)', '#000000');
    const white = contrastRatio('hsl(0, 0%, 100%)', '#000000');
    expect(clamped?.ratio).toBe(white?.ratio);
  });
});

describe('suggestTextColor', () => {
  it('returns black for a white background', () => {
    expect(suggestTextColor('#ffffff')).toBe('black');
  });

  it('returns white for a black background', () => {
    expect(suggestTextColor('#000000')).toBe('white');
  });

  it('returns white for a dark blue background', () => {
    expect(suggestTextColor('#1a237e')).toBe('white');
  });

  it('returns black for a light yellow background', () => {
    expect(suggestTextColor('#fffde7')).toBe('black');
  });

  it('falls back to black for invalid input', () => {
    expect(suggestTextColor('not-a-color')).toBe('black');
    expect(suggestTextColor('')).toBe('black');
  });
});

describe('passesAA', () => {
  it('returns true for black on white', () => {
    expect(passesAA('#000000', '#ffffff')).toBe(true);
  });

  it('returns false for identical colors', () => {
    expect(passesAA('#777777', '#777777')).toBe(false);
  });

  it('returns false when either color is invalid', () => {
    expect(passesAA('not-a-color', '#ffffff')).toBe(false);
    expect(passesAA('#ffffff', '')).toBe(false);
  });
});
