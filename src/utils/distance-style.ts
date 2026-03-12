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
 */
export const DISTANCE_BANDS: DistanceBandStyle[] = [
  { max: 100, color: '#1e88e5', textColor: '#ffffff', opacity: 1.0 },
  { max: 300, color: '#43a047', textColor: '#ffffff', opacity: 0.9 },
  { max: 500, color: '#c0ca33', textColor: '#333333', opacity: 0.75 },
  { max: 1000, color: '#fb8c00', textColor: '#ffffff', opacity: 0.6 },
  { max: 2000, color: '#e53935', textColor: '#ffffff', opacity: 0.4 },
  { max: 3000, color: '#7b1fa2', textColor: '#ffffff', opacity: 0.25 },
];

const FALLBACK_COLOR = '#616161';
const FALLBACK_TEXT_COLOR = '#ffffff';
const FALLBACK_OPACITY = 0.15;

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
