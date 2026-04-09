/**
 * Minimal tile source shape needed to resolve the effective map max zoom.
 */
export interface MapZoomSource {
  /** Optional per-tile-source map zoom cap. */
  maxZoom?: number;
}

/**
 * Resolve the effective map max zoom for the active tile source.
 *
 * Falls back to the app-wide default when tiles are disabled, when the
 * selected index is out of range, or when the active tile source does not
 * define its own `maxZoom`.
 *
 * @param tileIndex - Active tile source index, or `null` when tiles are disabled.
 * @param tileSources - Available tile sources.
 * @param defaultMaxZoom - App-wide fallback max zoom.
 * @returns The max zoom that should be applied to the map.
 */
export function resolveMapMaxZoom(
  tileIndex: number | null,
  tileSources: readonly MapZoomSource[],
  defaultMaxZoom: number,
): number {
  if (tileIndex == null) {
    return defaultMaxZoom;
  }

  return tileSources[tileIndex]?.maxZoom ?? defaultMaxZoom;
}
