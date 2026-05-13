/**
 * One curated initial-display location, used by `pickRandomHome` in
 * `src/config/map-defaults.ts` to seed the map at app start and when
 * the user hits the random-jump button.
 *
 * `requiredDataSource` lists the GTFS prefixes whose stops/routes give
 * this location something to show. When set, the location is only
 * included in the random pool if at least ONE listed prefix is in the
 * caller's "loaded" set (some-match); if none is, the location is
 * filtered out so the user never lands on an empty map. Locations
 * with no `requiredDataSource` are always available (no constraint).
 *
 * The shape is intentionally minimal — it carries only what the random
 * picker needs. No display metadata (icons, captions, etc.) lives
 * here; those would go on a separate UI-facing type if needed.
 */
export interface HomeLocation {
  /**
   * Short human-readable identifier, used only for logging
   * ("Initial position from random: {{name}} ..."). Not displayed to
   * end users.
   */
  name: string;

  /** Latitude (WGS84) of the map center to seed. */
  lat: number;

  /** Longitude (WGS84) of the map center to seed. */
  lng: number;

  /**
   * Initial zoom level for this location. Picked per-location because
   * a dense urban station works at zoom 17-18 while a sparse port or
   * region overview reads better at 12-15.
   */
  zoom: number;

  /**
   * GTFS prefixes whose data is needed for this location to be
   * meaningful. Filtering is `some` (any loaded prefix is enough), so
   * listing multiple prefixes acts as an OR — for example,
   * `['kcbus', 'kytbus']` means "this Kyoto location is useful if
   * Kyoto City Bus OR Kyoto Bus data is loaded".
   *
   * `undefined` and `[]` are equivalent: both express "no
   * requirement" — the location is unconditionally available, like a
   * `['*']` wildcard. Omitting the field is the more idiomatic way
   * to mark a location as unconstrained.
   */
  requiredDataSource?: readonly string[];
}
