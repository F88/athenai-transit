import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDisplayMinutes } from '@/domain/transit/timetable-entry-schedule';
import type { TimetableEntryStats } from '@/domain/transit/timetable-stats';
import type { Agency, Route } from '@/types/app/transit';
import type { TimetableEntry } from '@/types/app/transit-composed';
import { LabelCountBadge } from '../badge/label-count-badge';
import { RouteCountBadge } from '../badge/route-count-badge';
import type { InfoLevel } from '@/types/app/settings';
import { useInfoLevel } from '@/hooks/use-info-level';

interface TimetableMetadataProps {
  timetableEntries: TimetableEntry[];
  infoLevel: InfoLevel;
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
        count={stats.position.originCount}
        size="sm"
        frameClassName="border-blue-500"
        labelClassName={originLabelBadgeClassName}
        countClassName={originCountBadgeClassName}
      />
      <LabelCountBadge
        label={t('timetable.entry.terminal')}
        count={stats.position.terminalCount}
        size="sm"
        frameClassName="border-gray-500"
        labelClassName={terminalLabelBadgeClassName}
        countClassName={terminalCountBadgeClassName}
      />
    </div>
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
      <LabelCountBadge
        label={t('timetable.entry.noPickup')}
        count={stats.boarding.pickupTypeCounts[1]}
        size="sm"
        frameClassName="border-yellow-600"
        labelClassName={noPickupLabelBadgeClassName}
        countClassName={noPickupCountBadgeClassName}
      />
      <LabelCountBadge
        label={t('timetable.entry.noDropOff')}
        count={stats.boarding.dropOffTypeCounts[1]}
        size="sm"
        frameClassName="border-dashed border-yellow-600"
        labelClassName={noDropOffLabelBadgeClassName}
        countClassName={noDropOffCountBadgeClassName}
      />
    </div>
  );
}

function PassengerAxisBadges({ stats }: { stats: TimetableEntryStats }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1">
      <LabelCountBadge
        label={t('stopTimeView.passenger.boardable')}
        count={stats.passenger.boardableCount}
        size="sm"
      />
      <LabelCountBadge
        label={t('stopTimeView.passenger.nonBoardable')}
        count={stats.passenger.nonBoardableCount}
        size="sm"
      />
      <LabelCountBadge
        label={t('stopTimeView.passenger.alightable')}
        count={stats.passenger.alightableCount}
        size="sm"
      />
      <LabelCountBadge
        label={t('stopTimeView.passenger.nonAlightable')}
        count={stats.passenger.nonAlightableCount}
        size="sm"
      />
    </div>
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
  infoLevel,
  dataLang,
  agencies,
  stats,
}: TimetableMetadataProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);

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
      </p>

      <div className="flex flex-wrap items-start gap-1">
        <PatternPositionAxisBadges stats={stats} />
        <BoardingAxisBadges stats={stats} />
        {infoLevelFlag.isVerboseEnabled && <PassengerAxisBadges stats={stats} />}
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
