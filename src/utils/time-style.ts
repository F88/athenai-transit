/** Style definition for a relative time band. */
export interface TimeBandStyle {
  /** Lower bound in seconds (inclusive). */
  min: number;
  /** Upper bound in seconds (inclusive). */
  max: number;
  /** Background or text color for this band. */
  color: string;
  /** Contrasting text color for use on this band's background. */
  textColor: string;
  /** Opacity (0–1) for visual weight scaling. */
  opacity: number;
}

/**
 * Relative time thresholds with associated color and opacity.
 *
 * Closer stop times use warmer colors (attention), farther stop times
 * fade to gray (no rush). Designed to avoid urgency — Athenai is a
 * leisurely transit explorer, not a "run for the bus" app.
 *
 * Thresholds are defined in seconds for precision. Callers working
 * with minutes should convert: `relativeTimeStyle(minutes * 60)`.
 */
export const RELATIVE_TIME_BANDS: TimeBandStyle[] = [
  {
    min: Number.NEGATIVE_INFINITY,
    max: -601,
    color: '#757575',
    textColor: '#ffffff',
    opacity: 0.4,
  }, // 10分より前の過去
  { min: -600, max: -1, color: '#757575', textColor: '#ffffff', opacity: 0.8 }, // 10分前〜現在
  { min: 0, max: 180, color: '#fb8c00', textColor: '#ffffff', opacity: 1.0 }, // ~3分 — もうすぐ来る
  { min: 181, max: 600, color: '#43a047', textColor: '#ffffff', opacity: 1.0 }, // ~10分 — まだ余裕
  { min: 601, max: 900, color: '#1e88e5', textColor: '#ffffff', opacity: 1.0 }, // ~15分 — ゆっくり
  { min: 901, max: 1800, color: '#757575', textColor: '#ffffff', opacity: 0.8 }, // ~30分 — のんびり
  { min: 1801, max: 3600, color: '#757575', textColor: '#ffffff', opacity: 0.5 }, // ~60分 — 珈琲でも
  {
    min: 3601,
    max: Number.POSITIVE_INFINITY,
    color: '#757575',
    textColor: '#ffffff',
    opacity: 0.3,
  }, // 60分超 — かなり先
];

const FALLBACK_COLOR = '#757575';
const FALLBACK_TEXT_COLOR = '#ffffff';
const FALLBACK_OPACITY = 0.3;

/**
 * Returns the time band style (color, textColor, opacity) for the
 * given relative time.
 *
 * @param seconds - Relative time in seconds (negative = past/imminent).
 * @returns Style for the matching time band.
 */
export function relativeTimeStyle(seconds: number): {
  color: string;
  textColor: string;
  opacity: number;
} {
  for (const band of RELATIVE_TIME_BANDS) {
    if (band.min <= seconds && seconds <= band.max) {
      return { color: band.color, textColor: band.textColor, opacity: band.opacity };
    }
  }
  return { color: FALLBACK_COLOR, textColor: FALLBACK_TEXT_COLOR, opacity: FALLBACK_OPACITY };
}

/**
 * Returns a color for the given relative time in seconds.
 *
 * @param seconds - Relative time in seconds (negative = past/imminent).
 * @returns CSS color string.
 */
export function relativeTimeColor(seconds: number): string {
  return relativeTimeStyle(seconds).color;
}
