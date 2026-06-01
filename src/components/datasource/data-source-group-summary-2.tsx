import {
  CalendarDays,
  CalendarRange,
  CalendarX,
  Globe,
  HardDrive,
  Route,
  Signpost,
  Spline,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getDataPeriodStatus,
  type DataPeriodStatus,
} from '../../domain/datasource/data-period-status';
import { toTranslationCoverageLevel } from '../../domain/datasource/translation-coverage-level';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';
import { formatBytesForDisplay } from '../../utils/format-bytes';
import { toMetricLevel } from '../../utils/to-metric-level';
import {
  ENABLEMENT_TONE_INDEX,
  ENABLEMENT_BADGE_TONE_SCALE,
} from '../badge/metric-badge-tone-scale';
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
 * | size            | 5     | < 100 KB | 100 KB-1 MB | 1 MB-5 MB  | 5 MB-10 MB  | ≥ 10 MB |
 * | translations    | 5     | 0-1 raw tags | 2+ raw tags, 1 primary lang | 2 primary langs | 3-9 primary langs | 10+ primary langs |
 * | routes          | 5     | < 2      | 2-9         | 10-49      | 50-199      | ≥ 200   |
 * | boardingStops   | 5     | < 10     | 10-74       | 75-499     | 500-1999    | ≥ 2000  |
 * | maxTripsPerDay  | 5     | < 100    | 100-499     | 500-2999   | 3000-7999   | ≥ 8000  |
 * | routeShapes     | 5     | < 2      | 2-9         | 10-24      | 25-99       | ≥ 100   |
 *
 * `translations` shows the raw language-count text, but its color level
 * reflects distinct primary-language diversity rather than raw tag count.
 * Tags are normalized case-insensitively and collapsed to their primary
 * subtag, so variants like `ja`, `ja-Hrkt`, and `ja_JP` all count as one
 * language. When two or more raw tags are present, the badge is lifted to
 * at least level 2 even if they collapse to one primary language; after
 * that, additional primary languages map to levels 3-5, with level 5
 * reserved for unusually broad 10+ language coverage. The other numeric metrics
 * use a 5-level threshold scale and show level 1 for any non-null value
 * — even 0 — so a feed declaring "0 boarding stops" still surfaces a
 * lowest-level rating rather than disappearing.
 */
const SIZE_THRESHOLDS: ReadonlyArray<number> = [
  0,
  100 * 1024,
  1024 * 1024,
  5 * 1024 * 1024,
  10 * 1024 * 1024,
];

const ROUTES_THRESHOLDS: ReadonlyArray<number> = [0, 2, 10, 50, 200];

const BOARDING_STOPS_THRESHOLDS: ReadonlyArray<number> = [0, 10, 75, 500, 2000];

const MAX_TRIPS_THRESHOLDS: ReadonlyArray<number> = [0, 100, 500, 3000, 8000];

const ROUTE_SHAPES_THRESHOLDS: ReadonlyArray<number> = [0, 2, 10, 25, 100];

/**
 * Map an operating-period status to its {@link ENABLEMENT_TONE_INDEX}. A
 * missing reference date (`null`) or `indeterminate` maps to `unknown`, so the
 * badge is not shown as `enabled` when the period cannot be evaluated.
 */
function enablementToneIndexForPeriodStatus(periodStatus: DataPeriodStatus | null): number {
  switch (periodStatus) {
    case 'expired':
    case 'beforePeriod':
      return ENABLEMENT_TONE_INDEX.disabled;
    case 'inPeriod':
      return ENABLEMENT_TONE_INDEX.enabled;
    default:
      return ENABLEMENT_TONE_INDEX.unknown;
  }
}

/**
 * Operating-period badge for {@link DataSourceGroupSummary2}.
 *
 * Render-only: the parent owns the "has operating dates" gate and only renders
 * this when both bounds are present, so this component always renders the
 * badge. It shows the operating-date range (`first-last`) and, via
 * {@link getDataPeriodStatus}, tints the badge (frame + icon) when the range
 * is out of the operating period (expired or not-yet-started) relative to the
 * effective "today" (`referenceDateKey`).
 */
function OperatingPeriodBadge({
  first,
  last,
  referenceDateKey,
}: {
  first: string;
  last: string;
  referenceDateKey: string | undefined;
}) {
  const { t } = useTranslation();

  const operatingDatesText = `${first}-${last}`;
  const periodStatus =
    referenceDateKey !== undefined ? getDataPeriodStatus({ first, last }, referenceDateKey) : null;
  // Out of the operating range (expired or not-yet-started) gets the CalendarX
  // icon; in-period / unknown keeps CalendarRange. The tone is chosen by
  // {@link enablementToneIndexForPeriodStatus}.
  const isOutOfPeriod = periodStatus === 'expired' || periodStatus === 'beforePeriod';

  return (
    <MetricLevelBadge
      size="xs"
      icon={isOutOfPeriod ? <CalendarX /> : <CalendarRange />}
      text={operatingDatesText}
      level={enablementToneIndexForPeriodStatus(periodStatus)}
      badgeToneScale={ENABLEMENT_BADGE_TONE_SCALE}
      aria-label={t('dataSourceSettings.operatingDates.aria', {
        range: operatingDatesText,
      })}
    />
  );
}

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
export function DataSourceGroupSummary2({
  groupInfo,
  referenceDateKey,
}: {
  groupInfo: DataSourceGroupInfo | null;
  referenceDateKey?: string;
}) {
  const { i18n, t } = useTranslation();

  if (groupInfo === null) {
    return null;
  }
  // The catalog emits operating dates as a first/last pair (or the whole
  // object absent), so a one-sided range cannot occur. Narrow to a non-null
  // pair so the render-only OperatingPeriodBadge receives non-null bounds.
  const { operatingDates } = groupInfo;
  const operatingPeriod =
    operatingDates !== null && operatingDates.first !== null && operatingDates.last !== null
      ? { first: operatingDates.first, last: operatingDates.last }
      : null;
  const routesCount =
    groupInfo.routeTypeCounts === null || Object.keys(groupInfo.routeTypeCounts).length === 0
      ? null
      : Object.values(groupInfo.routeTypeCounts).reduce((sum, count) => sum + count, 0);
  const hasAnyMetric =
    operatingPeriod !== null ||
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
      {/* Translation coverage */}
      {groupInfo.translationLanguages !== null && (
        <MetricLevelBadge
          size="xs"
          icon={<Globe />}
          text={groupInfo.translationLanguages.size.toLocaleString(i18n.language)}
          level={toTranslationCoverageLevel(groupInfo.translationLanguages)}
          aria-label={t('dataSourceSettings.translations.aria', {
            count: groupInfo.translationLanguages.size.toLocaleString(),
          })}
        />
      )}

      {/* Size of the data source */}
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
          text={`${groupInfo.maxTripsPerDay.toLocaleString(i18n.language)}`}
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
          aria-label={t('dataSourceSettings.routeShapes.aria', {
            count: groupInfo.routeShapesCount.toLocaleString(i18n.language),
          })}
        />
      )}

      {/* Operating period */}
      {operatingPeriod !== null && (
        <OperatingPeriodBadge
          first={operatingPeriod.first}
          last={operatingPeriod.last}
          referenceDateKey={referenceDateKey}
        />
      )}
    </div>
  );
}
