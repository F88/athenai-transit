import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDisplayMinutes } from '@/domain/transit/timetable-utils';
import type { TimetableEntryStats } from '@/domain/transit/timetable-stats';
import type { Agency, Route } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';
import { LabelCountBadge } from '../badge/label-count-badge';
import { RouteCountBadge } from '../badge/route-count-badge';

interface TimetableMetadataProps {
  timetableEntries: TimetableEntry[];
  dataLang: readonly string[];
  agencies: Agency[];
  /**
   * Aggregated stats for the displayed entries.
   * Owned by the caller so the same aggregation is not repeated for the
   * filter pills and the metadata block.
   */
  stats: TimetableEntryStats;
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function computeAverageInterval(minutes: number[]): number | null {
  if (minutes.length < 2) {
    return null;
  }

  const totalSpan = minutes[minutes.length - 1] - minutes[0];
  return Math.round(totalSpan / (minutes.length - 1));
}

/**
 * Render the A-axis (pattern position) stats span:
 * `[origin / terminal / passing]`.
 */
function PatternPositionAxisStats({ stats }: { stats: TimetableEntryStats }) {
  const { t, i18n } = useTranslation();
  return (
    <span>
      {'['}
      {t('timetable.metadata.originCount', {
        count: stats.originCount.toLocaleString(i18n.language),
      })}
      {' / '}
      {t('timetable.metadata.terminalCount', {
        count: stats.terminalCount.toLocaleString(i18n.language),
      })}
      {' / '}
      {t('timetable.metadata.passingCount', {
        count: stats.passingCount.toLocaleString(i18n.language),
      })}
      {']'}
    </span>
  );
}

function PatternPositionAxisBadges({ stats }: { stats: TimetableEntryStats }) {
  const { t } = useTranslation();
  const originLabelBadgeClassName = 'bg-blue-500 text-white';
  const originCountBadgeClassName = 'border-l border-blue-500 bg-background text-foreground';
  const terminalLabelBadgeClassName = 'bg-gray-500 text-white';
  const terminalCountBadgeClassName = 'border-l border-gray-500 bg-background text-foreground';

  return (
    <div className="flex flex-wrap gap-1">
      <LabelCountBadge
        label={t('timetable.entry.origin')}
        count={stats.originCount}
        frameClassName="border-blue-500"
        labelClassName={originLabelBadgeClassName}
        countClassName={originCountBadgeClassName}
      />
      <LabelCountBadge
        label={t('timetable.entry.terminal')}
        count={stats.terminalCount}
        frameClassName="border-gray-500"
        labelClassName={terminalLabelBadgeClassName}
        countClassName={terminalCountBadgeClassName}
      />
    </div>
  );
}

/**
 * Render the B-axis (boarding availability) stats span:
 * `[boardable / non-boardable / drop-off-only / no-drop-off]`.
 *
 * Reads only the boarding-related fields of {@link TimetableEntryStats},
 * so callers can pass either the all-entries or filtered-entries stats
 * depending on the metadata block scope.
 */
function BoardingAxisStats({ stats }: { stats: TimetableEntryStats }) {
  const { t, i18n } = useTranslation();
  return (
    <span>
      {'['}
      {t('timetable.metadata.boardableCount', {
        count: stats.boardableCount.toLocaleString(i18n.language),
      })}
      {' / '}
      {t('timetable.metadata.nonBoardableCount', {
        count: stats.nonBoardableCount.toLocaleString(i18n.language),
      })}
      {' / '}
      {t('timetable.metadata.dropOffOnlyCount', {
        count: stats.dropOffOnlyCount.toLocaleString(i18n.language),
      })}
      {' / '}
      {t('timetable.metadata.noDropOffCount', {
        count: stats.noDropOffCount.toLocaleString(i18n.language),
      })}
      {']'}
    </span>
  );
}

function BoardingAxisBadges({ stats }: { stats: TimetableEntryStats }) {
  const { t } = useTranslation();
  const noPickupLabelBadgeClassName =
    'border-yellow-600 bg-yellow-100 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200';
  const noPickupCountBadgeClassName = 'border-l border-yellow-600 bg-background text-foreground';
  const noDropOffLabelBadgeClassName =
    'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200';
  const noDropOffCountBadgeClassName =
    'border-l border-dashed border-yellow-600 bg-background text-foreground';

  return (
    <div className="flex flex-wrap gap-1">
      <LabelCountBadge label={t('stop.serviceState.boardable')} count={stats.boardableCount} />
      {/* <LabelCountBadge label={t('timetable.entry.noPickup')} count={stats.nonBoardableCount} /> */}
      <LabelCountBadge
        label={t('timetable.entry.noPickup')}
        count={stats.nonBoardableCount}
        frameClassName="border-yellow-600"
        labelClassName={noPickupLabelBadgeClassName}
        countClassName={noPickupCountBadgeClassName}
      />
      {/* <LabelCountBadge label={t('timetable.entry.noDropOff')} count={stats.noDropOffCount} /> */}
      <LabelCountBadge
        label={t('timetable.entry.noDropOff')}
        count={stats.noDropOffCount}
        frameClassName="border-dashed border-yellow-600"
        labelClassName={noDropOffLabelBadgeClassName}
        countClassName={noDropOffCountBadgeClassName}
      />
      <LabelCountBadge label={t('stop.serviceState.dropOffOnly')} count={stats.dropOffOnlyCount} />
    </div>
  );
}

/**
 * Render the C-axis (route direction) stats span. Split into two
 * bracket groups: `[route / headsign]` for unique-name signals and
 * `[routeHeadsign / stopHeadsignOverride / direction]` for combined /
 * override / direction signals.
 *
 * `headsignCount` is currently aggregated from `tripHeadsign.name`;
 * sources that publish trip_headsign as empty (= rely on stop_headsign,
 * e.g. kobus) will report `headsignCount === 1`.
 */
function RouteDirectionAxisStats({ stats }: { stats: TimetableEntryStats }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <span>
        {'['}
        {t('timetable.metadata.routeCount', {
          count: stats.routeCount.toLocaleString(i18n.language),
        })}
        {' / '}
        {t('timetable.metadata.headsignCount', {
          count: stats.stopHeadsignCount.toLocaleString(i18n.language),
        })}
        {'] / ['}
        {t('timetable.metadata.routeHeadsignCount', {
          count: stats.tripHeadsignCount.toLocaleString(i18n.language),
        })}
        {' / '}
        {t('timetable.metadata.directionCount', {
          count: stats.directionCount.toLocaleString(i18n.language),
        })}
        {']'}
      </span>
    </>
  );
}

/**
 * Render timetable statistics and per-route counts above the timetable grid.
 *
 * @param props - Metadata rendering inputs.
 * @returns The rendered timetable metadata block.
 */
export function TimetableMetadata({
  timetableEntries,
  dataLang,
  agencies,
  stats,
}: TimetableMetadataProps) {
  const { t, i18n } = useTranslation();
  const allMinutes = timetableEntries.map((entry) => getDisplayMinutes(entry));
  const count = allMinutes.length;
  const firstTime = count > 0 ? formatMinutes(allMinutes[0]) : null;
  const lastTime = count > 0 ? formatMinutes(allMinutes[count - 1]) : null;
  const avgInterval = computeAverageInterval(allMinutes);

  const routeBreakdown = useMemo(() => {
    const counts = new Map<string, { route: Route; count: number }>();

    for (const entry of timetableEntries) {
      const routeId = entry.routeDirection.route.route_id;
      const current = counts.get(routeId);
      if (current) {
        current.count++;
      } else {
        counts.set(routeId, { route: entry.routeDirection.route, count: 1 });
      }
    }

    return Array.from(counts.values());
  }, [timetableEntries]);

  return (
    <div className="border-border text-muted-foreground mb-3 space-y-0.5 rounded border p-2 text-[11px]">
      <p>
        {firstTime && lastTime && (
          <span>
            {firstTime} - {lastTime}
          </span>
        )}
        <span>
          {' '}
          / {t('timetable.metadata.count', { count: count.toLocaleString(i18n.language) })}
        </span>
        {avgInterval !== null && (
          <span>
            {' '}
            /{' '}
            {t('timetable.metadata.avgInterval', {
              interval: avgInterval.toLocaleString(i18n.language),
            })}
          </span>
        )}
        {false && (
          <>
            {' / '}
            <PatternPositionAxisStats stats={stats} />
          </>
        )}
        {false && (
          <>
            {' / '}
            <BoardingAxisStats stats={stats} />
          </>
        )}
        {false && (
          <>
            {' / '}
            <RouteDirectionAxisStats stats={stats} />
          </>
        )}
      </p>

      <div className="flex flex-wrap items-start gap-1">
        <PatternPositionAxisBadges stats={stats} />
        <BoardingAxisBadges stats={stats} />
      </div>

      {/* Routes with their counts.
       *
       * Intentionally rendered for every stop, including single-route
       * stops, even though the previous PillButton row was gated on
       * `routeBreakdown.length > 1`. RouteCountBadge is read-only and
       * visually distinct from a filter pill, so the duplication with
       * the trip count line is acceptable, and consistently surfacing
       * the route-color chip helps users associate route × count even
       * when there is only one route at this stop.
       */}
      <div className="flex flex-wrap gap-1">
        {routeBreakdown.map((item) => (
          <RouteCountBadge
            key={item.route.route_id}
            route={item.route}
            count={item.count}
            dataLang={dataLang}
            agencies={agencies}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
}
