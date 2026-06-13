import type { TimetableEntry } from '../../types/app/transit-composed';
import type { StopServiceState } from '../../types/app/transit';
import type { TimetableOmitted } from '../../types/app/repository';
import type { TimetableEntryStats } from '../../domain/transit/timetable-stats';
import { formatDateKey } from '../../domain/transit/calendar-utils';

/**
 * Debug dump of timetable-level metadata and entry statistics.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 *
 * Goal is an exhaustive, debug-useful dump of the data. The canonical
 * scalar counts come from {@link TimetableEntryStats} (passed in, not
 * recomputed, so this dump always agrees with the dialog metadata and
 * the boardable-only filter), grouped by the same axes. Breakdowns that
 * the stats object does not carry (per-direction / per-pattern tallies,
 * dwell) are computed inline from `timetableEntries`.
 */
export function VerboseTimetableSummary({
  type,
  headsign,
  serviceDate,
  timetableEntries,
  stats,
  omitted,
  stopServiceState,
}: {
  type: 'route-headsign' | 'stop';
  headsign?: string;
  serviceDate: Date;
  timetableEntries: TimetableEntry[];
  /** Canonical aggregated counts for `timetableEntries` (computed by the parent). */
  stats: TimetableEntryStats;
  omitted: TimetableOmitted;
  stopServiceState: StopServiceState;
}) {
  // Breakdowns not carried by TimetableEntryStats (per-value tallies),
  // computed inline because the verbose dump wants the full distribution,
  // not just the unique-value count the stats object exposes.

  // Direction breakdown
  const dirCounts = new Map<string, number>();
  for (const e of timetableEntries) {
    const dir =
      e.routeDirection.direction !== undefined ? `dir=${e.routeDirection.direction}` : 'dir=N/A';
    dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
  }

  // Pattern breakdown (stopIndex/totalStops combinations)
  const patternCounts = new Map<string, number>();
  for (const e of timetableEntries) {
    const key = `[${e.patternPosition.stopIndex + 1}/${e.patternPosition.totalStops}]`;
    patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1);
  }

  // Dwell time stats
  const dwellCount = timetableEntries.filter(
    (e) => e.schedule.arrivalMinutes !== e.schedule.departureMinutes,
  ).length;

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary
        tabIndex={-1}
        className="cursor-pointer select-none"
        onClick={(e) => e.stopPropagation()}
      >
        [TimetableSummary]
      </summary>
      <div className="mt-0.5">
        <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 whitespace-nowrap">
          <span className="block">
            [timetable] serviceDate={formatDateKey(serviceDate)} type={type}
          </span>
          {headsign != null && <span className="block">[headsign] &quot;{headsign}&quot;</span>}
          <span className="block">
            [entries] total={stats.totalCount} uniqueTrips={stats.tripLocator.uniqueTripCount}
          </span>
          <span className="block">
            [position] origin={stats.position.originCount} terminal={stats.position.terminalCount}{' '}
            passing={stats.position.passingCount}
          </span>
          <span className="block">
            [passenger] boardable={stats.passenger.boardableCount} nonBoardable=
            {stats.passenger.nonBoardableCount}
          </span>
          <span className="block">
            [signal] noPickup={stats.signal.noPickupCount} noDropOff={stats.signal.noDropOffCount}
          </span>
          <span className="block">
            [routeDirection] routes={stats.routeDirection.routeCount} directions=
            {stats.routeDirection.directionCount} tripHeadsigns=
            {stats.routeDirection.tripHeadsignCount} stopHeadsigns=
            {stats.routeDirection.stopHeadsignCount}
          </span>
          <span className="block">
            [tripLocator] patterns={stats.tripLocator.patternCount} services=
            {stats.tripLocator.serviceCount}
          </span>
          <span className="block">
            [direction]{' '}
            {Array.from(dirCounts.entries())
              .map(([dir, n]) => `${dir}:${n}`)
              .join(' ')}
          </span>
          <span className="block">
            [pattern]{' '}
            {Array.from(patternCounts.entries())
              .map(([pat, n]) => `${pat}:${n}`)
              .join(' ')}
          </span>
          {dwellCount > 0 && <span className="block">[dwell] count={dwellCount}</span>}
          <span className="block">
            [state] stopServiceState={stopServiceState} omitted.nonBoardable=
            {omitted.nonBoardable}
          </span>
        </span>
      </div>
    </details>
  );
}
