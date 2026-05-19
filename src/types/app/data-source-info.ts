import type { AppRouteTypeValue } from './transit';

/**
 * Per-prefix data facts composed from the pipeline-derived
 * `DataSourceCatalogBundle` and the repo-derived `SourceMeta`.
 *
 * This is an intermediate translation layer that normalizes wire-format
 * catalog data and runtime SourceMeta into a single app-internal
 * per-prefix shape, so downstream code does not touch raw catalog or
 * SourceMeta directly. The composing logic lives in
 * `src/domain/datasource/data-source-info.ts` (`composeDataSourceInfo`).
 *
 * Display names are intentionally **not** part of this type — the
 * Data Source Settings dialog uses `SourceGroup` (config) for display
 * labels rather than any per-prefix name field.
 */
export interface DataSourceInfo {
  /** Source prefix (e.g. `"minkuru"`, `"kobus"`). */
  prefix: string;

  /**
   * Feed version string from `feed_info.feed_version` (loaded data
   * via `SourceMeta`), or `null` when SourceMeta is unavailable or
   * the source publishes no version.
   */
  feedVersion: string | null;

  /**
   * Feed validity window from catalog `summary.periods.feedValidity`,
   * or `null` when catalog is unavailable. When catalog is present the
   * inner `start` / `end` may still be `null` (the source's
   * `feed_info.feed_start_date` / `feed_end_date` are optional in GTFS).
   */
  feedValidity: { start: string | null; end: string | null } | null;

  /**
   * Actual service period observed from calendar data (catalog-only).
   * `null` when catalog is unavailable. Often a better freshness
   * signal than feed validity since some feeds advertise extended
   * validity but only carry a few months of calendar data.
   */
  servicePeriod: { start: string | null; end: string | null } | null;

  /**
   * Total disk size in bytes of every emitted bundle for this source
   * (`data.json` + `insights.json` + `shapes.json` when present).
   * `null` when catalog is unavailable.
   */
  totalSizeBytes: number | null;

  /**
   * Languages for which translations are published in this source
   * (catalog-only, from `summary.i18n.languages`). BCP 47 codes as
   * they appear in the upstream data (`ja`, `en`, `ja-Hrkt`,
   * `zh-Hans`, etc.).
   *
   * `null` when catalog data is unavailable for this prefix; an empty
   * array when the catalog *is* present and explicitly declares zero
   * translations. The two states are deliberately distinguished so
   * downstream consumers can tell "no information" from "information
   * says zero".
   *
   * Distinct from the primary feed language declaration
   * (`feed_info.feed_lang`); this set reflects translation
   * availability rather than the feed's default language.
   */
  translationLanguages: readonly string[] | null;

  /**
   * Highest one-day trip total observed for this source (catalog-only).
   * `null` when catalog is unavailable.
   */
  maxTripsPerDay: number | null;

  /**
   * Trip-evidence-based operating service-date summary from catalog
   * `summary.service.operatingDates`.
   *
   * `null` when catalog is unavailable or when the source does not
   * carry this summary in the catalog.
   */
  operatingDates: {
    first: string | null;
    last: string | null;
    count: number;
  } | null;

  /**
   * Count of physical boarding stops (`location_type == 0`) from
   * catalog. `null` when catalog is unavailable.
   */
  boardingStopsCount: number | null;

  /**
   * Route facts from catalog `summary.routes`.
   *
   * `null` when catalog is unavailable.
   */
  routes: {
    /** Counts keyed by normalized app route type value. */
    typeCounts: Partial<Record<AppRouteTypeValue, number>>;
  } | null;

  /**
   * Route shape coverage summary from catalog `summary.shapes`.
   *
   * `null` when catalog is unavailable or when the catalog explicitly
   * says shape geometry is unavailable for this source.
   */
  routeShapes: { count: number } | null;
}
