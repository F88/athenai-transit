import type { TimetableEntry } from '../../types/app/transit-composed';
import type { TimetableOmitted } from '../../types/app/repository';
import { isDropOffOnly } from '../../domain/transit/timetable-utils';

/**
 * Debug dump of timetable-level summary statistics.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseTimetableSummary({
  timetableEntries,
  omitted,
  isBoardableOnServiceDay,
}: {
  timetableEntries: TimetableEntry[];
  omitted: TimetableOmitted;
  isBoardableOnServiceDay: boolean;
}) {
  // Domain-consistent counts using isDropOffOnly (pickupType === 1 OR isTerminal).
  // pickupType 2/3 (phone/coordination required) are considered boardable.
  const dropOff = timetableEntries.filter((e) => isDropOffOnly(e)).length;
  const boardable = timetableEntries.length - dropOff;
  const originCount = timetableEntries.filter((e) => e.patternPosition.isOrigin).length;
  const terminalCount = timetableEntries.filter((e) => e.patternPosition.isTerminal).length;

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
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [TimetableSummary]
      </summary>
      <div className="mt-0.5">
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
          <span className="block">
            [entries] total={timetableEntries.length} boardable={boardable} dropOffOnly={dropOff}{' '}
            origin={originCount} terminal={terminalCount}
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
            [state] isBoardableOnServiceDay={String(isBoardableOnServiceDay)} omitted.terminal=
            {omitted.terminal}
          </span>
        </span>
      </div>
    </details>
  );
}
