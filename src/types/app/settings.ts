/** Performance profile mode. */
export type PerfMode = 'lite' | 'normal' | 'full';

/** Stop marker rendering mode. */
export type RenderMode = 'auto' | 'standard' | 'lightweight';

/** Information verbosity level for stop/route labels and metadata. */
export type InfoLevel = 'simple' | 'normal' | 'detailed' | 'verbose';

/** UI color theme. */
export type Theme = 'light' | 'dark';

/**
 * User-configurable application settings.
 *
 * Persisted to localStorage via {@link useUserSettings}.
 */
export interface UserSettings {
  /** Active performance profile. */
  perfMode: PerfMode;
  /** Stop marker rendering strategy. */
  renderMode: RenderMode;
  /** Selected tile source index, or `null` for no tile layer. */
  tileIndex: number | null;
  /**
   * GTFS route_type values whose stop markers are visible.
   *
   * 0 = tram, 1 = subway, 2 = rail, 3 = bus.
   */
  visibleStopTypes: number[];
  /**
   * GTFS route_type values whose route shape polylines are visible.
   *
   * 0 = tram, 1 = subway, 2 = rail, 3 = bus.
   */
  visibleRouteShapes: number[];
  /** Controls how much information is shown for stop/route labels. */
  infoLevel: InfoLevel;
  /** UI color theme. */
  theme: Theme;
  /**
   * Double-tap-drag zoom direction.
   * The value describes what dragging **up** does.
   *
   * - `'zoom-out'` — up = zoom out (Google Maps style, default)
   * - `'zoom-in'`  — up = zoom in (Apple Maps style)
   */
  doubleTapDrag: 'zoom-in' | 'zoom-out';
}
