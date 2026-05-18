import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../domain/datasource/aggregate-source-size';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';

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
  const hasAnyMetric =
    groupInfo.size !== null ||
    (groupInfo.translationLanguages !== null && groupInfo.translationLanguages.size > 0) ||
    groupInfo.boardingStopsCount !== null ||
    groupInfo.maxTripsPerDay !== null;
  if (!hasAnyMetric) {
    return null;
  }
  return (
    <div className="text-muted-foreground mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      {groupInfo.size !== null && (
        <span
          aria-label={t('dataSourceSettings.size.aria', {
            size: formatBytes(groupInfo.size.totalBytes),
          })}
        >
          <span aria-hidden>💾 </span>
          {formatBytes(groupInfo.size.totalBytes)}
        </span>
      )}
      {groupInfo.translationLanguages !== null && groupInfo.translationLanguages.size > 0 && (
        <span
          aria-label={t('dataSourceSettings.translations.aria', {
            count: groupInfo.translationLanguages.size,
          })}
        >
          <span aria-hidden>🌐 </span>
          {groupInfo.translationLanguages.size}
        </span>
      )}
      {groupInfo.boardingStopsCount !== null && (
        <span
          aria-label={t('dataSourceSettings.boardingStops.aria', {
            count: groupInfo.boardingStopsCount,
          })}
        >
          <span aria-hidden>🚏 </span>
          {groupInfo.boardingStopsCount.toLocaleString()}
        </span>
      )}
      {groupInfo.maxTripsPerDay !== null && (
        <span
          aria-label={t('dataSourceSettings.maxTripsPerDay.aria', {
            count: groupInfo.maxTripsPerDay,
          })}
        >
          <span aria-hidden>🚍 </span>
          {groupInfo.maxTripsPerDay.toLocaleString()}/d
        </span>
      )}
    </div>
  );
}
