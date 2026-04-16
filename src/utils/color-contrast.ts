/**
 * Simple WCAG 2.1 contrast ratio utility.
 * Provides helpers to compute relative luminance and contrast ratio between two colors.
 * Supports hex (#rgb / #rrggbb), rgb(a), and hsl(a) strings.
 */

export interface ContrastResult {
  /** WCAG contrast ratio in the range [1, 21]. */
  ratio: number;
  /** Meets WCAG AA for normal text (>= 4.5). */
  levelAA: boolean;
  /**
   * Meets WCAG AAA for large text (>= 4.5).
   *
   * Note: AA for large text (>= 3.0) is not represented in this
   * interface. Add a `levelAALarge` field if that threshold becomes
   * needed.
   */
  levelAAALarge: boolean;
  /** Meets WCAG AAA for normal text (>= 7). */
  levelAAA: boolean;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color) {
    return null;
  }
  if (color.startsWith('#')) {
    const h = color.slice(1);
    // Validate both length and character set up front. Without the
    // regex check, `parseInt` would silently accept inputs like
    // `#fffffg` (partial parse, 'g' ignored) or return NaN for `#ggg`
    // and coerce it into black (NaN >> 16 === 0).
    if ((h.length !== 3 && h.length !== 6) || !/^[0-9a-fA-F]+$/.test(h)) {
      return null;
    }
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    const intVal = parseInt(full, 16);
    if (Number.isNaN(intVal)) {
      return null;
    }
    return { r: (intVal >> 16) & 255, g: (intVal >> 8) & 255, b: intVal & 255 };
  }
  if (color.startsWith('rgb')) {
    // CSS allows each channel to be an integer (0-255) or a percentage
    // (0%-100%). Tokens ending in '%' are scaled to the 0-255 range so
    // downstream luminance calculations can treat all channels uniformly.
    const parts = color
      .replace(/rgba?\(/, '')
      .replace(/\)/, '')
      .split(',')
      .slice(0, 3)
      .map((p) => {
        const t = p.trim();
        if (t.endsWith('%')) {
          const v = parseFloat(t.slice(0, -1));
          return Number.isNaN(v) ? NaN : (v * 255) / 100;
        }
        return parseFloat(t);
      });
    if (parts.length === 3 && parts.every((v) => !Number.isNaN(v))) {
      const [r, g, b] = parts;
      // Clamp each channel to the CSS-valid [0, 255] range. Browsers
      // treat rgb(999, 0, 0) as rgb(255, 0, 0); without clamping the
      // luminance computation downstream would receive values that
      // violate the [1, 21] contract documented on ContrastResult.
      return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
    }
  }
  if (color.startsWith('hsl')) {
    // hsl(a) -> convert to rgb first
    // hsl(h s% l%) or hsla(h s% l% / a)
    // Remove function name and parentheses
    const body = color
      .substring(color.indexOf('(') + 1, color.lastIndexOf(')'))
      .replace(/\//g, ' ') // treat slash as space
      .replace(/%/g, '')
      .replace(/,/g, ' ');
    const tokens = body.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) {
      return null;
    }
    const h = parseFloat(tokens[0]);
    const sRaw = parseFloat(tokens[1]) / 100;
    const lRaw = parseFloat(tokens[2]) / 100;
    if (Number.isNaN(h) || Number.isNaN(sRaw) || Number.isNaN(lRaw)) {
      return null;
    }
    // Clamp saturation and lightness to the CSS-valid [0, 1] range.
    // Hue is normalized separately via the mod-360 step below.
    const s = Math.max(0, Math.min(1, sRaw));
    const l = Math.max(0, Math.min(1, lRaw));
    // Conversion
    // Algorithm from WCAG / CSS Color Module Level 3
    const C = (1 - Math.abs(2 * l - 1)) * s;
    const Hp = (((h % 360) + 360) % 360) / 60; // sector 0..6
    const X = C * (1 - Math.abs((Hp % 2) - 1));
    let r1 = 0,
      g1 = 0,
      b1 = 0;
    if (Hp >= 0 && Hp < 1) {
      r1 = C;
      g1 = X;
      b1 = 0;
    } else if (Hp >= 1 && Hp < 2) {
      r1 = X;
      g1 = C;
      b1 = 0;
    } else if (Hp >= 2 && Hp < 3) {
      r1 = 0;
      g1 = C;
      b1 = X;
    } else if (Hp >= 3 && Hp < 4) {
      r1 = 0;
      g1 = X;
      b1 = C;
    } else if (Hp >= 4 && Hp < 5) {
      r1 = X;
      g1 = 0;
      b1 = C;
    } else if (Hp >= 5 && Hp < 6) {
      r1 = C;
      g1 = 0;
      b1 = X;
    }
    const m = l - C / 2;
    // Clamp the final channels for safety — with s/l already clamped
    // the math should stay in [0, 255], but this keeps floating-point
    // edge cases from leaking out of the [0, 255] contract.
    const r = clamp255(Math.round((r1 + m) * 255));
    const g = clamp255(Math.round((g1 + m) * 255));
    const b = clamp255(Math.round((b1 + m) * 255));
    return { r, g, b };
  }
  return null;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  // Convert sRGB to linear
  const toLinear = (v: number) => {
    const srgb = v / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Compute the WCAG 2.1 contrast ratio between two colors, along with
 * AA / AAA threshold checks.
 *
 * The ratio is returned raw (unrounded) so threshold flags and the
 * exposed `ratio` field stay numerically consistent. Rounding for
 * display is the caller's responsibility.
 *
 * @param foreground - Foreground color (CSS hex, rgb, or hsl).
 * @param background - Background color (CSS hex, rgb, or hsl).
 * @returns A {@link ContrastResult} with the raw ratio and threshold
 *   flags, or `null` if either color could not be parsed.
 */
export function contrastRatio(foreground: string, background: string): ContrastResult | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) {
    return null;
  }
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  // Return the raw ratio so threshold checks (levelAA etc.) and the
  // exposed ratio stay numerically consistent. Rounding for display
  // is a concern of the caller (e.g. `ratio.toFixed(2)` in UI code).
  return {
    ratio,
    levelAA: ratio >= 4.5,
    levelAAALarge: ratio >= 4.5,
    levelAAA: ratio >= 7,
  };
}

/**
 * Return `'white'` or `'black'` — whichever has the higher contrast
 * ratio against `background`. Useful as a default foreground fallback
 * for colored badges where no explicit text color is specified.
 *
 * @param background - Background color (CSS hex, rgb, or hsl).
 * @returns `'white'` if white contrasts better, else `'black'`. Falls
 * back to `'black'` for invalid input.
 */
export function suggestTextColor(background: string): 'black' | 'white' {
  const bg = parseColor(background);
  if (!bg) {
    return 'black';
  }
  const whiteContrast = contrastRatio('#ffffff', background);
  const blackContrast = contrastRatio('#000000', background);
  if (!whiteContrast || !blackContrast) {
    return 'black';
  }
  return whiteContrast.ratio >= blackContrast.ratio ? 'white' : 'black';
}

/**
 * Check whether the foreground / background pair meets WCAG AA for
 * normal text (contrast ratio >= 4.5).
 *
 * @param foreground - Foreground color (CSS hex, rgb, or hsl).
 * @param background - Background color (CSS hex, rgb, or hsl).
 * @returns `true` if the pair meets AA for normal text, `false`
 *   otherwise (also `false` when either color is invalid).
 */
export function passesAA(foreground: string, background: string): boolean {
  const res = contrastRatio(foreground, background);
  return !!res && res.levelAA;
}
