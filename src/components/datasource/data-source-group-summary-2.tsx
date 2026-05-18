import { CalendarDays, Globe, HardDrive, Route, Signpost, Spline } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';
import { formatBytesForDisplay } from '../../utils/format-bytes';
import { toMetricLevel } from '../../utils/to-metric-level';
import { MetricLevelBadge } from '../badge/metric-level-badge';

/**
 * 5-level threshold buckets calibrated against actual catalog data
 * (36 sources, snapshot 2026-05-17 from
 * `dist/next-dev/global/data-source-catalog.json`).
 *
 * Each array element is the lower-inclusive bound for the rating level
 * at that index + 1. `toStarLevel` walks the array and counts how many
 * thresholds the value meets or exceeds.
 *
 * | metric          | scale | 1★       | 2★          | 3★         | 4★          | 5★      |
 * | --------------- | ----- | -------- | ----------- | ---------- | ----------- | ------- |
 * | size            | 5     | < 100 KB | 100 KB-1 MB | 1 MB-5 MB  | 5 MB-15 MB  | ≥ 15 MB |
 * | languages       | 3     | 1        | 2-3         | ≥ 4        |             |         |
 * | routes          | 5     | < 5      | 5-19        | 20-99      | 100-299     | ≥ 300   |
 * | boardingStops   | 5     | < 20     | 20-99       | 100-499    | 500-1999    | ≥ 2000  |
 * | maxTripsPerDay  | 5     | < 100    | 100-499     | 500-1999   | 2000-7999   | ≥ 8000  |
 * | routeShapes     | 5     | < 10     | 10-29       | 30-99      | 100-299     | ≥ 300   |
 *
 * `languages` uses a 3-level scale (translations cluster heavily around
 * 2-3 languages — a 5-level scale would over-resolve the middle). It is
 * shown whenever any catalog data is present for the group, even when
 * the count is 0 — a level-0 neutral color explicitly communicates
 * "catalog present but no translations declared" and is distinct from
 * the row-level "no catalog data" hidden state. The other three
 * metrics use a 5-level scale and show level 1 for any non-null value
 * — even 0 — so a feed declaring "0 boarding stops" still surfaces a
 * lowest-level rating rather than disappearing.
 */
const SIZE_THRESHOLDS: ReadonlyArray<number> = [
  0,
  100 * 1024,
  1024 * 1024,
  5 * 1024 * 1024,
  15 * 1024 * 1024,
];

const LANGUAGES_THRESHOLDS: ReadonlyArray<number> = [1, 2, 4];

const ROUTES_THRESHOLDS: ReadonlyArray<number> = [0, 5, 20, 100, 300];

const BOARDING_STOPS_THRESHOLDS: ReadonlyArray<number> = [0, 20, 100, 500, 2000];

const MAX_TRIPS_THRESHOLDS: ReadonlyArray<number> = [0, 100, 500, 2000, 8000];

const ROUTE_SHAPES_THRESHOLDS: ReadonlyArray<number> = [0, 10, 30, 100, 300];

/**
 * Color-scale variant of {@link DataSourceGroupSummary}. Same props,
 * same metric set, but each value is displayed in a `MetricLevelBadge`
 * whose tone is chosen from a discrete color scale based on the
 * threshold level. Threshold table and per-metric buckets are
 * documented near the threshold constants.
 *
 * Aria labels keep the raw numbers (or formatted size) so screen
 * readers still receive precise values.
 */
export function DataSourceGroupSummary2({ groupInfo }: { groupInfo: DataSourceGroupInfo | null }) {
  const { i18n, t } = useTranslation();
  if (groupInfo === null) {
    return null;
  }
  const routesCount =
    groupInfo.routeTypeCounts === null || Object.keys(groupInfo.routeTypeCounts).length === 0
      ? null
      : Object.values(groupInfo.routeTypeCounts).reduce((sum, count) => sum + count, 0);
  const hasAnyMetric =
    groupInfo.size !== null ||
    groupInfo.translationLanguages !== null ||
    routesCount !== null ||
    groupInfo.boardingStopsCount !== null ||
    groupInfo.maxTripsPerDay !== null ||
    groupInfo.routeShapesCount !== null;
  if (!hasAnyMetric) {
    return null;
  }
  return (
    <div className="text-muted-foreground mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      {groupInfo.size !== null && (
        <MetricLevelBadge
          size="xs"
          icon={<HardDrive />}
          text={formatBytesForDisplay(groupInfo.size.totalBytes, { fractionDigits: 0 })}
          level={toMetricLevel(groupInfo.size.totalBytes, SIZE_THRESHOLDS)}
          aria-label={t('dataSourceSettings.size.aria', {
            size: formatBytesForDisplay(groupInfo.size.totalBytes, { fractionDigits: 0 }),
          })}
        />
      )}
      {groupInfo.translationLanguages !== null && (
        <MetricLevelBadge
          size="xs"
          icon={<Globe />}
          text={groupInfo.translationLanguages.size.toLocaleString(i18n.language)}
          level={toMetricLevel(groupInfo.translationLanguages.size, LANGUAGES_THRESHOLDS)}
          aria-label={t('dataSourceSettings.translations.aria', {
            count: groupInfo.translationLanguages.size.toLocaleString(),
          })}
        />
      )}
      {routesCount !== null && (
        <MetricLevelBadge
          size="xs"
          icon={<Route />}
          text={routesCount.toLocaleString(i18n.language)}
          level={toMetricLevel(routesCount, ROUTES_THRESHOLDS)}
          aria-label={t('timetable.metadata.routeCount', {
            count: routesCount.toLocaleString(i18n.language),
          })}
        />
      )}
      {groupInfo.boardingStopsCount !== null && (
        <MetricLevelBadge
          size="xs"
          icon={<Signpost />}
          text={groupInfo.boardingStopsCount.toLocaleString(i18n.language)}
          level={toMetricLevel(groupInfo.boardingStopsCount, BOARDING_STOPS_THRESHOLDS)}
          aria-label={t('dataSourceSettings.boardingStops.aria', {
            count: groupInfo.boardingStopsCount.toLocaleString(),
          })}
        />
      )}
      {groupInfo.maxTripsPerDay !== null && (
        <MetricLevelBadge
          size="xs"
          icon={<CalendarDays />}
          text={`${groupInfo.maxTripsPerDay.toLocaleString(i18n.language)}/d`}
          level={toMetricLevel(groupInfo.maxTripsPerDay, MAX_TRIPS_THRESHOLDS)}
          aria-label={t('dataSourceSettings.maxTripsPerDay.aria', {
            count: groupInfo.maxTripsPerDay.toLocaleString(),
          })}
        />
      )}
      {groupInfo.routeShapesCount !== null && (
        <MetricLevelBadge
          size="xs"
          icon={<Spline />}
          text={groupInfo.routeShapesCount.toLocaleString(i18n.language)}
          level={toMetricLevel(groupInfo.routeShapesCount, ROUTE_SHAPES_THRESHOLDS)}
          aria-label={`Route shapes: ${groupInfo.routeShapesCount.toLocaleString(i18n.language)}`}
        />
      )}
    </div>
  );
}
