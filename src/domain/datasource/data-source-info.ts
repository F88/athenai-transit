import type {
  DataSourceCatalogFileBackedSummary,
  DataSourceCatalogSource,
} from '@contracts/data/transit-v2-catalog-json';
import type { SourceMeta } from '../../types/app/transit-composed';

/**
 * Per-prefix data facts composed from the pipeline-derived
 * `DataSourceCatalogBundle` and the repo-derived {@link SourceMeta}.
 *
 * This is the return type of {@link composeDataSourceInfo}. It is an
 * intermediate translation layer that normalizes wire-format catalog
 * data and runtime SourceMeta into a single app-internal per-prefix
 * shape, so downstream code does not touch raw catalog or
 * SourceMeta directly.
 *
 * Display names are intentionally **not** part of this type — the
 * Data Source Settings dialog uses {@link SourceGroup} (config) for
 * display labels rather than any per-prefix name field.
 */
export interface DataSourceInfo {
  /** Source prefix (e.g. `"minkuru"`, `"kobus"`). */
  prefix: string;

  /**
   * Feed version string from `feed_info.feed_version` (loaded data
   * via {@link SourceMeta}), or `null` when SourceMeta is unavailable
   * or the source publishes no version.
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
   * Highest one-day trip total observed for this source (catalog-only).
   * `null` when catalog is unavailable.
   */
  maxTripsPerDay: number | null;

  /**
   * Count of physical boarding stops (`location_type == 0`) from
   * catalog. `null` when catalog is unavailable.
   */
  boardingStopsCount: number | null;

  /**
   * Whether shape geometry is built for this source (catalog-only).
   * Defaults to `false` when catalog is unavailable.
   */
  shapesAvailable: boolean;

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
}

/**
 * GTFS `stops.location_type` value for a physical boarding stop
 * (a place passengers actually board). The catalog's
 * `summary.stops.locationTypes` is keyed by the stringified value of
 * this field; only `'0'` represents boarding stops. Other values
 * (`'1'` station, `'2'` entrance, `'3'` node, `'4'` boarding area)
 * are intentionally excluded from {@link DataSourceInfo}'s
 * boarding-stop count.
 *
 * Snapshot taken 2026-05-17, source:
 * https://gtfs.org/documentation/schedule/reference/#stopstxt
 */
const GTFS_LOCATION_TYPE_BOARDING_STOP = '0' as const;

/**
 * Count of physical boarding stops for one catalog source entry.
 *
 * Reads `summary.stops.locationTypes['0'].count` from the catalog.
 * See {@link GTFS_LOCATION_TYPE_BOARDING_STOP} for what `'0'` means.
 *
 * Returns `null` when:
 *   - the catalog source is unavailable, or
 *   - the catalog has no `locationTypes['0']` entry (rare; would
 *     mean the source declares no physical boarding stops, e.g. a
 *     feed of only station / entrance / node records).
 *
 * Both cases are intentionally collapsed to `null` so the field
 * semantics stay consistent with {@link DataSourceInfo}'s
 * `number | null` contract: `null` always means "no displayable
 * value", regardless of why.
 */
function countBoardingStops(catalogSource: DataSourceCatalogSource | undefined): number | null {
  if (!catalogSource) {
    return null;
  }
  return catalogSource.summary.stops.locationTypes[GTFS_LOCATION_TYPE_BOARDING_STOP]?.count ?? null;
}

/**
 * Sum every file-backed bundle's `file.sizeBytes` for one catalog
 * source entry. Iterates `Object.values(bundles)` so that any future
 * bundle that extends {@link DataSourceCatalogFileBackedSummary} (and
 * therefore exposes `file.sizeBytes`) is accounted for without a
 * code change. Optional bundles (e.g. `shapesBundle`) are skipped
 * via optional chaining when absent.
 *
 * Returns `null` when the catalog source is unavailable.
 */
function sumBundleSizes(catalogSource: DataSourceCatalogSource | undefined): number | null {
  if (!catalogSource) {
    return null;
  }
  // `Object.values` widens the result to `any[]` for a typed object
  // with named fields. Reassert via the shared file-backed base type
  // so the reducer body retains structural type safety.
  const bundles: ReadonlyArray<DataSourceCatalogFileBackedSummary | undefined> = Object.values(
    catalogSource.bundles,
  );
  return bundles.reduce((sum, bundle) => sum + (bundle?.file.sizeBytes ?? 0), 0);
}

/**
 * Compose a {@link DataSourceInfo} for a single prefix from the
 * available raw inputs. Either or both inputs may be `undefined` —
 * each field documents its fallback behavior.
 */
export function composeDataSourceInfo(
  prefix: string,
  sourceMeta: SourceMeta | undefined,
  catalogSource: DataSourceCatalogSource | undefined,
): DataSourceInfo {
  return {
    prefix,
    feedVersion: sourceMeta?.feedInfo.version ?? null,
    feedValidity: catalogSource?.summary.periods.feedValidity ?? null,
    servicePeriod: catalogSource?.summary.periods.servicePeriod ?? null,
    totalSizeBytes: sumBundleSizes(catalogSource),
    maxTripsPerDay: catalogSource?.summary.service.maxTripsPerDay ?? null,
    boardingStopsCount: countBoardingStops(catalogSource),
    shapesAvailable: catalogSource?.summary.shapes.available ?? false,
    translationLanguages: catalogSource?.summary.i18n.languages ?? null,
  };
}
