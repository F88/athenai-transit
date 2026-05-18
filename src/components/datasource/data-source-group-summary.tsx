import { useTranslation } from 'react-i18next';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';
import { formatBytesForDisplay } from '../../utils/format-bytes';

/**
 * Renders the user-facing summary line for one data source group —
 * the decision-making material a user weighs when choosing whether to
 * enable the group in DataSourceSettingsDialog.
 *
 * Up to four metrics are shown as a muted subtitle:
 *   - total bundle disk size
 *   - translation language count
 *   - physical boarding-stop count
 *   - estimated upper-bound daily trip count
 *
 * Each metric is independently null-checked so partial catalog coverage
 * still surfaces what it has. When every metric is absent (or
 * `groupInfo` itself is `null`) the component renders nothing — the
 * caller does not need to gate the render manually.
 */
export function DataSourceGroupSummary({ groupInfo }: { groupInfo: DataSourceGroupInfo | null }) {
  const { t } = useTranslation();
  if (groupInfo === null) {
    return null;
  }
  const routesCount =
    groupInfo.routeTypeCounts === null || Object.keys(groupInfo.routeTypeCounts).length === 0
      ? null
      : Object.values(groupInfo.routeTypeCounts).reduce((sum, count) => sum + count, 0);
  const hasAnyMetric =
    groupInfo.size !== null ||
    (groupInfo.translationLanguages !== null && groupInfo.translationLanguages.size > 0) ||
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
        <span
          aria-label={t('dataSourceSettings.size.aria', {
            size: formatBytesForDisplay(groupInfo.size.totalBytes, { fractionDigits: 0 }),
          })}
        >
          <span aria-hidden>💾 </span>
          {formatBytesForDisplay(groupInfo.size.totalBytes, { fractionDigits: 0 })}
        </span>
      )}
      {groupInfo.translationLanguages !== null && groupInfo.translationLanguages.size > 0 && (
        <span
          aria-label={t('dataSourceSettings.translations.aria', {
            count: groupInfo.translationLanguages.size.toLocaleString(),
          })}
        >
          <span aria-hidden>🌐 </span>
          {groupInfo.translationLanguages.size}
        </span>
      )}
      {routesCount !== null && (
        <span
          aria-label={t('timetable.metadata.routeCount', {
            count: routesCount.toLocaleString(),
          })}
        >
          <span aria-hidden>🛣️ </span>
          {routesCount.toLocaleString()}
        </span>
      )}
      {groupInfo.boardingStopsCount !== null && (
        <span
          aria-label={t('dataSourceSettings.boardingStops.aria', {
            count: groupInfo.boardingStopsCount.toLocaleString(),
          })}
        >
          <span aria-hidden>🚏 </span>
          {groupInfo.boardingStopsCount.toLocaleString()}
        </span>
      )}
      {groupInfo.maxTripsPerDay !== null && (
        <span
          aria-label={t('dataSourceSettings.maxTripsPerDay.aria', {
            count: groupInfo.maxTripsPerDay.toLocaleString(),
          })}
        >
          <span aria-hidden>🚍 </span>
          {groupInfo.maxTripsPerDay.toLocaleString()}/d
        </span>
      )}
      {groupInfo.routeShapesCount !== null && (
        <span aria-label={`Route shapes: ${groupInfo.routeShapesCount.toLocaleString()}`}>
          <span aria-hidden>🗺️ </span>
          {groupInfo.routeShapesCount.toLocaleString()}
        </span>
      )}
    </div>
  );
}
