import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../domain/datasource/aggregate-source-size';
import type { DataSourceGroupInfo } from '../../types/app/data-source-group-info';

/**
 * 5-level threshold buckets calibrated against actual catalog data
 * (36 sources, snapshot 2026-05-17 from
 * `dist/next-dev/global/data-source-catalog.json`).
 *
 * Each array element is the lower-inclusive bound for the star level
 * at that index + 1. `toStarLevel` walks the array and counts how many
 * thresholds the value meets or exceeds.
 *
 * | metric          | scale | 1★       | 2★          | 3★         | 4★          | 5★      |
 * | --------------- | ----- | -------- | ----------- | ---------- | ----------- | ------- |
 * | size            | 5     | < 100 KB | 100 KB-1 MB | 1 MB-5 MB  | 5 MB-15 MB  | ≥ 15 MB |
 * | languages       | 3     | 1        | 2-3         | ≥ 4        |             |         |
 * | boardingStops   | 5     | < 20     | 20-99       | 100-499    | 500-1999    | ≥ 2000  |
 * | maxTripsPerDay  | 5     | < 100    | 100-499     | 500-1999   | 2000-7999   | ≥ 8000  |
 *
 * `languages` uses a 3-level scale (translations cluster heavily around
 * 2-3 languages — a 5-level scale would over-resolve the middle). It is
 * shown whenever any catalog data is present for the group, even when
 * the count is 0 — a 0★ rating (☆☆☆) explicitly communicates "catalog
 * present but no translations declared" and is distinct from the
 * row-level "no catalog data" hidden state. The other three metrics use
 * a 5-level scale and show 1★ for any non-null value — even 0 — so a
 * feed declaring "0 boarding stops" still surfaces a lowest-level
 * rating rather than disappearing.
 */
const SIZE_THRESHOLDS: ReadonlyArray<number> = [
  0,
  100 * 1024,
  1024 * 1024,
  5 * 1024 * 1024,
  15 * 1024 * 1024,
];

const LANGUAGES_THRESHOLDS: ReadonlyArray<number> = [1, 2, 4];

const BOARDING_STOPS_THRESHOLDS: ReadonlyArray<number> = [0, 20, 100, 500, 2000];

const MAX_TRIPS_THRESHOLDS: ReadonlyArray<number> = [0, 100, 500, 2000, 8000];

function toStarLevel(value: number, thresholds: ReadonlyArray<number>): number {
  let level = 0;
  for (const t of thresholds) {
    if (value >= t) {
      level++;
    } else {
      break;
    }
  }
  // Returns 0..thresholds.length. The lower bound of 0 is intentional:
  // callers that want a "show whenever present" 1★ floor must set
  // thresholds[0] = 0 so any non-negative value reaches level 1. For
  // languages, thresholds[0] = 1, so value = 0 returns 0 — rendered as
  // all-empty stars to signal "catalog present, no translations".
  if (level > thresholds.length) {
    return thresholds.length;
  }
  return level;
}

function Stars({ level, total }: { level: number; total: number }) {
  return (
    <span aria-hidden>
      <span className="text-foreground">{'★'.repeat(level)}</span>
      <span className="text-foreground/25">{'☆'.repeat(total - level)}</span>
    </span>
  );
}

/**
 * Star-rating variant of {@link DataSourceGroupSummary}. Same props,
 * same metric set, but each numeric value is replaced by a five-level
 * star rating so the user can compare data sources by "heaviness" and
 * "abundance" without parsing raw figures. Threshold table and per-
 * metric buckets are documented near the threshold constants.
 *
 * Aria labels keep the raw numbers (or formatted size) so screen
 * readers still receive precise values even though sighted users see
 * stars only.
 */
export function DataSourceGroupSummary2({ groupInfo }: { groupInfo: DataSourceGroupInfo | null }) {
  const { t } = useTranslation();
  if (groupInfo === null) {
    return null;
  }
  const hasAnyMetric =
    groupInfo.size !== null ||
    groupInfo.translationLanguages !== null ||
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
          <Stars
            level={toStarLevel(groupInfo.size.totalBytes, SIZE_THRESHOLDS)}
            total={SIZE_THRESHOLDS.length}
          />
        </span>
      )}
      {groupInfo.translationLanguages !== null && (
        <span
          aria-label={t('dataSourceSettings.translations.aria', {
            count: groupInfo.translationLanguages.size.toLocaleString(),
          })}
        >
          <span aria-hidden>🌐 </span>
          <Stars
            level={toStarLevel(groupInfo.translationLanguages.size, LANGUAGES_THRESHOLDS)}
            total={LANGUAGES_THRESHOLDS.length}
          />
        </span>
      )}
      {groupInfo.boardingStopsCount !== null && (
        <span
          aria-label={t('dataSourceSettings.boardingStops.aria', {
            count: groupInfo.boardingStopsCount.toLocaleString(),
          })}
        >
          <span aria-hidden>🚏 </span>
          <Stars
            level={toStarLevel(groupInfo.boardingStopsCount, BOARDING_STOPS_THRESHOLDS)}
            total={BOARDING_STOPS_THRESHOLDS.length}
          />
        </span>
      )}
      {groupInfo.maxTripsPerDay !== null && (
        <span
          aria-label={t('dataSourceSettings.maxTripsPerDay.aria', {
            count: groupInfo.maxTripsPerDay.toLocaleString(),
          })}
        >
          <span aria-hidden>🚍 </span>
          <Stars
            level={toStarLevel(groupInfo.maxTripsPerDay, MAX_TRIPS_THRESHOLDS)}
            total={MAX_TRIPS_THRESHOLDS.length}
          />
        </span>
      )}
    </div>
  );
}
