/** Maximum interval (ms) between first tap end and second tap start. */
export const DOUBLE_TAP_WINDOW_MS = 300;

/** Maximum drift (px) allowed between the two taps. */
export const MAX_TAP_DRIFT_PX = 30;

/** Pixels of vertical slide per one zoom-level change. */
export const PIXELS_PER_ZOOM_LEVEL = 100;

/**
 * Determines whether a second tap qualifies as the start of a
 * double-tap-zoom gesture.
 *
 * @param elapsed - Time (ms) since the first tap ended.
 * @param drift - Distance (px) between the two tap positions.
 * @returns `true` if the tap pair qualifies as a double-tap.
 */
export function isDoubleTap(elapsed: number, drift: number): boolean {
  return elapsed < DOUBLE_TAP_WINDOW_MS && drift < MAX_TAP_DRIFT_PX;
}

/**
 * Computes the new zoom level from a vertical slide distance.
 *
 * @param startZoom - Zoom level when the slide began.
 * @param deltaY - Vertical slide distance in pixels (positive = finger moved up, negative = finger moved down).
 * @param minZoom - Map's minimum zoom level.
 * @param maxZoom - Map's maximum zoom level.
 * @param invert - When true, inverts how slide direction maps to zoom (e.g. up = zoom out instead of zoom in).
 * @returns Clamped zoom level.
 */
export function slideToZoom(
  startZoom: number,
  deltaY: number,
  minZoom: number,
  maxZoom: number,
  invert?: boolean,
): number {
  const direction = invert ? -1 : 1;
  const zoomDelta = (deltaY * direction) / PIXELS_PER_ZOOM_LEVEL;
  return Math.max(minZoom, Math.min(maxZoom, startZoom + zoomDelta));
}
