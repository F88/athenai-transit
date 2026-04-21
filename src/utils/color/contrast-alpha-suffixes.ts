export interface ContrastAwareAlphaSuffixes {
  subtleAlphaSuffix: string;
  emphasisAlphaSuffix: string;
}

/**
 * Return 2 alpha suffixes for UI accents based on a measured contrast ratio.
 *
 * The returned values are intended to be appended to a CSS hex base color
 * (for example `#1976D2` -> `#1976D255`).
 *
 * @param ratio - Measured contrast ratio for the base color against the
 *   current background, or `null` when the ratio could not be computed.
 * @returns Alpha suffixes for a subtler fill and a stronger emphasis fill.
 */
export function getContrastAwareAlphaSuffixes(ratio: number | null): ContrastAwareAlphaSuffixes {
  const safeRatio = ratio ?? Number.POSITIVE_INFINITY;

  switch (true) {
    case safeRatio >= 3.0:
      return {
        emphasisAlphaSuffix: '50',
        subtleAlphaSuffix: '20',
      };
    case safeRatio >= 2.0:
      return {
        emphasisAlphaSuffix: '60',
        subtleAlphaSuffix: '30',
      };
    case safeRatio >= 1.5:
      return {
        emphasisAlphaSuffix: '70',
        subtleAlphaSuffix: '40',
      };
    default:
      return {
        emphasisAlphaSuffix: 'A0',
        subtleAlphaSuffix: '60',
      };
  }
}
