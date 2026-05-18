import type {
  DataSourceCatalogFileBackedSummary,
  DataSourceCatalogSource,
} from '@contracts/data/transit-v2-catalog-json';
import type { DataSourceInfo } from '../../types/app/data-source-info';
import type { SourceMeta } from '../../types/app/transit-composed';

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
