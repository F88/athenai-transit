/**
 * Threshold (ms) for suppressing click events after a zoomend.
 * Set to 0 to disable suppression entirely.
 *
 * This value accounts for the double-tap click deferral
 * window: a pinch-zoom artifact click may arrive up to ~600ms
 * after zoomend (300ms browser delay + 300ms deferral), so the
 * window must cover both.
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
