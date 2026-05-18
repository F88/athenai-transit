import type { AppRouteTypeValue } from './transit';
import type { DataSourceInfo } from './data-source-info';

/**
 * Aggregated disk size for a set of {@link DataSourceInfo} entries
 * (e.g. all prefixes belonging to a {@link SourceGroup}).
 *
 * Sums the `totalSizeBytes` of each input that has a non-null catalog
 * total. Intended as a coarse decision-making signal for "how heavy is
 * enabling this group" — not for accurate budgeting.
 */
export interface AggregatedSourceSize {
  /** Total bytes summed across all inputs with a known catalog total. */
  totalBytes: number;
}

/**
 * Per-group aggregated data-source info composed from app config, the
 * pipeline catalog, and the loaded SourceMeta. The Data Source
 * Settings dialog consumes this directly — each {@link SourceGroup}
 * row gets one entry.
 *
 * Produced by the `useDataSourceGroupInfo` hook in
 * `src/hooks/use-data-source-group-info.ts`.
 */
export interface DataSourceGroupInfo {
  /** {@link SourceGroup.id} the entry belongs to. */
  groupId: string;
  /**
   * Per-prefix raw facts for this group, in `group.prefixes` order.
   * Useful for drill-down displays (e.g. per-prefix detail panels);
   * the dialog row itself only uses the aggregated fields below.
   */
  infos: readonly DataSourceInfo[];
  /**
   * Sum of {@link DataSourceInfo.totalSizeBytes} across the group's
   * prefixes. `null` when no prefix in the group has catalog data.
   */
  size: AggregatedSourceSize | null;
  /**
   * Union of {@link DataSourceInfo.translationLanguages} across the
   * group's prefixes. Describes translation data availability
   * (`translations.txt` language keys), **not** the feed's base
   * language — a feed always has a base `feed_lang`, but may publish
   * zero translations.
   *
   * `null` when no prefix in the group has catalog data (translation
   * status unknown). An empty Set when at least one prefix has catalog
   * data but no prefix declares any translations — data-semantically
   * distinct from `null` (catalog explicitly says zero, vs. unknown).
   * Whether to surface the distinction in the UI is a per-consumer
   * decision.
   */
  translationLanguages: ReadonlySet<string> | null;
  /**
   * Sum of {@link DataSourceInfo.boardingStopsCount} across the
   * group's prefixes. `null` when no prefix has catalog data.
   */
  boardingStopsCount: number | null;
  /**
   * Sum of {@link DataSourceInfo.maxTripsPerDay} across the group's
   * prefixes — an upper-bound estimate of the group's daily trip
   * volume, formed by treating the union of per-source peak service
   * days as one day. `null` when no prefix has catalog data.
   */
  maxTripsPerDay: number | null;
  /**
   * Sum of per-prefix route counts keyed by normalized app route type.
   * `null` when no prefix has catalog-backed route metadata.
   */
  routeTypeCounts: Partial<Record<AppRouteTypeValue, number>> | null;
  /**
   * Sum of per-prefix route-shape counts across the group's prefixes.
   * `null` when no prefix has catalog-backed route-shape metadata.
   */
  routeShapesCount: number | null;
}
