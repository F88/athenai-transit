/** Style definition for a distance band. */
export interface DistanceBandStyle {
  max: number;
  color: string;
  textColor: string;
  opacity: number;
}

/**
 * Distance thresholds with associated color and opacity.
 *
 * Shared by concentric rings on the map, edge marker distance badges,
 * and canvas arrow rendering.
 *
 * Beyond 3 km, the palette switches to neutral grays expressed as CSS
 * variables (`--distance-band-*` in `src/index.css`) so the long-range
 * fade reads correctly in both light and dark themes — light mode picks
 * progressively lighter grays that dissolve into the white background,
 * dark mode picks progressively darker grays that dissolve into the
 * near-black background. Consumers that pass `color` to a stylesheet
 * (`style={{ color }}`, `style={{ backgroundColor }}`) get theme-aware
 * resolution for free; consumers that need an opaque hex (Canvas
 * `fillStyle`, hex math) only deal with the visible-range bands so the
 * `var(...)` form never reaches them.
 */
export const DISTANCE_BANDS: DistanceBandStyle[] = [
  { max: 100, color: '#1e88e5', textColor: '#ffffff', opacity: 1.0 },
  { max: 300, color: '#43a047', textColor: '#ffffff', opacity: 0.9 },
  { max: 500, color: '#c0ca33', textColor: '#333333', opacity: 0.75 },
  { max: 1000, color: '#fb8c00', textColor: '#ffffff', opacity: 0.6 },
  { max: 2000, color: '#e53935', textColor: '#ffffff', opacity: 0.4 },
  { max: 3000, color: '#7b1fa2', textColor: '#ffffff', opacity: 0.95 },
  // Rainbow extension past the locally-walkable range. Continues the hue
  // progression after purple into magenta / wine before the palette drops
  // into the neutral gray fade at >50 km.
  { max: 10_000, color: '#c2185b', textColor: '#ffffff', opacity: 0.7 },
  { max: 50_000, color: '#880e4f', textColor: '#ffffff', opacity: 0.4 },
  { max: 100_000, color: 'var(--distance-band-100km)', textColor: '#ffffff', opacity: 0.2 },
  { max: 500_000, color: 'var(--distance-band-500km)', textColor: '#ffffff', opacity: 0.15 },
  { max: 1_000_000, color: 'var(--distance-band-1000km)', textColor: '#ffffff', opacity: 0.1 },
];

const FALLBACK_COLOR = 'var(--distance-band-fallback)';
const FALLBACK_TEXT_COLOR = '#ffffff';
const FALLBACK_OPACITY = 0.5;

/**
 * Returns the distance band style (color and opacity) for the given distance.
 *
 * @param meters - Distance from map center in metres.
 * @returns Color and opacity for the distance band.
 */
export function distanceStyle(meters: number): {
  color: string;
  textColor: string;
  opacity: number;
} {
  for (const band of DISTANCE_BANDS) {
    if (meters <= band.max) {
      return { color: band.color, textColor: band.textColor, opacity: band.opacity };
    }
  }
  return { color: FALLBACK_COLOR, textColor: FALLBACK_TEXT_COLOR, opacity: FALLBACK_OPACITY };
}

/**
 * Returns a color for the given distance in metres.
 *
 * @param meters - Distance from map center in metres.
 * @returns CSS color string.
 */
export function distanceColor(meters: number): string {
  return distanceStyle(meters).color;
}
