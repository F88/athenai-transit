/**
 * Threshold (ms) for suppressing click events after a zoomend.
 * Set to 0 to disable suppression entirely.
 *
 * This value accounts for the double-tap click deferral
 * ({@link DOUBLE_TAP_WINDOW_MS}): a pinch-zoom artifact click
 * may arrive up to ~600ms after zoomend (300ms browser delay +
 * 300ms deferral), so the window must cover both.
 */
export const CLICK_SUPPRESSION_MS = 600;

/**
 * Determines whether a map click event should be suppressed
 * because it was likely triggered by a pinch-zoom gesture.
 *
 * On mobile, Leaflet can fire a spurious `click` event immediately
 * after a pinch-zoom `zoomend`. This function detects that pattern
 * by checking if the click occurred within a short window after the
 * last `zoomend`.
 *
 * @param lastZoomTime - Timestamp (ms) of the most recent `zoomend` event. 0 means no zoom has occurred.
 * @param clickTime - Timestamp (ms) of the `click` event.
 * @param suppressionMs - Maximum elapsed time (ms) to consider the click zoom-related. Defaults to {@link CLICK_SUPPRESSION_MS} (600ms).
 * @returns `true` if the click should be suppressed (likely pinch-zoom artifact).
 */
export function shouldSuppressMapClick(
  lastZoomTime: number,
  clickTime: number,
  suppressionMs: number = CLICK_SUPPRESSION_MS,
): boolean {
  if (lastZoomTime === 0) {
    return false;
  }
  return clickTime - lastZoomTime < suppressionMs;
}

// ---------------------------------------------------------------------------
// Double-tap + slide-to-zoom — pure helpers
// ---------------------------------------------------------------------------

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
