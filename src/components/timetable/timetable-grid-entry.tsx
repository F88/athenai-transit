import type { InfoLevel } from '../../types/app/settings';
import type { TimetableEntry } from '../../types/app/transit-composed';
import { HeadsignBadge } from '../badge/headsign-badge';
import { VerboseTimetableGridEntry as VerboseGridEntry } from '../verbose/verbose-timetable-grid-entry';
import { EntryLabels } from './entry-labels';

/** Terminal entries show arrival time; all others show departure time. */
function getDisplayMinutes(entry: TimetableEntry): number {
  return entry.patternPosition.isTerminal
    ? entry.schedule.arrivalMinutes
    : entry.schedule.departureMinutes;
}

interface TimetableGridEntryProps {
  entry: TimetableEntry;
  /** Whether to show the headsign badge. */
  showHeadsign: boolean;
  /** Maximum characters for headsign truncation. */
  headsignMaxLength?: number;
  infoLevel: InfoLevel;
  /** Whether to show terminal label. */
  isDisplayTerminal: boolean;
  /** Whether to show origin label. */
  isDisplayOrigin: boolean;
  /** Whether to show pickup unavailable label. */
  isDisplayPickupUnavailable: boolean;
  /** Whether to show drop-off unavailable label. */
  isDisplayDropOffUnavailable: boolean;
  /** Suppress verbose-only rendering (IdBadge, details dump).
   *  Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
}

/**
 * A single time entry in the timetable grid — minutes display,
 * optional headsign badge, and boarding/position labels.
 */
export function TimetableGridEntry({
  entry,
  showHeadsign,
  headsignMaxLength,
  infoLevel,
  isDisplayTerminal,
  isDisplayOrigin,
  isDisplayPickupUnavailable,
  isDisplayDropOffUnavailable,
  disableVerbose = false,
  defaultOpen = false,
}: TimetableGridEntryProps) {
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;
  const displayMinutes = getDisplayMinutes(entry);

  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="text-muted-foreground text-sm tabular-nums">
        {String(displayMinutes % 60).padStart(2, '0')}
        {entry.patternPosition.isTerminal && <span className="text-[9px] opacity-70">着</span>}
      </span>
      {showHeadsign && (
        <HeadsignBadge
          headsign={entry.routeDirection.headsign}
          route={entry.routeDirection.route}
          infoLevel={infoLevel}
          maxLength={headsignMaxLength}
          size="xs"
          disableVerbose={disableVerbose}
          showVerboseId={false}
        />
      )}
      <EntryLabels
        entry={entry}
        isDisplayTerminal={isDisplayTerminal}
        isDisplayOrigin={isDisplayOrigin}
        isDisplayPickupUnavailable={isDisplayPickupUnavailable}
        isDisplayDropOffUnavailable={isDisplayDropOffUnavailable}
      />
      {showVerbose && (
        <VerboseGridEntry
          entry={entry}
          displayMinutes={displayMinutes}
          showHeadsign={showHeadsign}
          headsignMaxLength={headsignMaxLength}
          infoLevel={infoLevel}
          isDisplayTerminal={isDisplayTerminal}
          isDisplayOrigin={isDisplayOrigin}
          isDisplayPickupUnavailable={isDisplayPickupUnavailable}
          isDisplayDropOffUnavailable={isDisplayDropOffUnavailable}
          defaultOpen={defaultOpen}
        />
      )}
    </span>
  );
}
