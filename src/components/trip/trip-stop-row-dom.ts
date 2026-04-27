/**
 * DOM helpers for trip stop rows.
 *
 * Encapsulates the `data-trip-stop-index` attribute used by TripStopRow
 * and TripStopPlaceholderRow in trip-stops.tsx, so consumers
 * (auto-scroll, scroll-driven focus tracking) do not depend on the
 * literal attribute name. The attribute's name lives only in this
 * module — every set/find/read operation goes through the helpers
 * exported here.
 */

const TRIP_STOP_INDEX_ATTR = 'data-trip-stop-index' as const;

/**
 * Build the data attribute object spread onto a trip stop row's outer
 * element so the row can later be discovered by {@link findTripStopRow}
 * and {@link getTripStopRows}.
 */
export function tripStopRowDataAttrs(index: number): Record<typeof TRIP_STOP_INDEX_ATTR, number> {
  return { [TRIP_STOP_INDEX_ATTR]: index };
}

/**
 * Find the trip stop row representing the given pattern stop index
 * inside the given scroll container. Returns `null` when no row
 * matches (the index is out of range, or the row has not been
 * rendered yet).
 */
export function findTripStopRow(container: HTMLElement, index: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[${TRIP_STOP_INDEX_ATTR}="${index}"]`);
}

/**
 * Return all trip stop rows (both real and placeholder) inside the
 * given scroll container, in document order.
 */
export function getTripStopRows(container: HTMLElement): NodeListOf<HTMLElement> {
  return container.querySelectorAll<HTMLElement>(`[${TRIP_STOP_INDEX_ATTR}]`);
}

/**
 * Read the pattern stop index off a trip stop row element. Returns
 * `null` when the attribute is missing or its value is not a finite
 * number, so callers can `continue` past unrecognised elements.
 */
export function getTripStopIndexFromRow(row: HTMLElement): number | null {
  const value = row.getAttribute(TRIP_STOP_INDEX_ATTR);
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
