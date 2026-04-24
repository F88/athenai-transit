import type { InfoLevel } from '../../types/app/settings';
import type { TimetableEntry, TripInspectionTarget } from '../../types/app/transit-composed';
import { useTranslation } from 'react-i18next';
import { getDisplayMinutes } from '../../domain/transit/timetable-utils';
import { getTimetableEntryAttributes } from '../../domain/transit/timetable-entry-attributes';
import { HeadsignBadge } from '../badge/headsign-badge';
import { VerboseTimetableGridEntry as VerboseGridEntry } from '../verbose/verbose-timetable-grid-entry';
import { TimetableEntryAttributesLabels } from '../label/timetable-entry-attributes-labels';

interface TimetableGridEntryProps {
  entry: TimetableEntry;
  serviceDate: Date;
  /** Whether to show the headsign badge. */
  showHeadsign: boolean;
  /** Maximum characters for headsign truncation. */
  headsignMaxLength?: number;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** Agency languages for subNames sort priority. */
  agencyLang?: readonly string[];
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
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * A single time entry in the timetable grid — minutes display,
 * optional headsign badge, and boarding/position labels.
 */
export function TimetableGridEntry({
  entry,
  serviceDate,
  showHeadsign,
  headsignMaxLength,
  infoLevel,
  dataLangs,
  agencyLang,
  isDisplayTerminal,
  isDisplayOrigin,
  isDisplayPickupUnavailable,
  isDisplayDropOffUnavailable,
  disableVerbose = false,
  defaultOpen = false,
  onInspectTrip,
}: TimetableGridEntryProps) {
  const { t } = useTranslation();
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;
  const displayMinutes = getDisplayMinutes(entry);
  const inspectTarget: TripInspectionTarget = {
    serviceDate,
    tripLocator: entry.tripLocator,
    stopIndex: entry.patternPosition.stopIndex,
  };
  const content = (
    <>
      <span className="text-muted-foreground text-sm tabular-nums">
        {String(displayMinutes % 60).padStart(2, '0')}
        {entry.patternPosition.isTerminal && (
          <span className="text-[9px] opacity-70">{t('timetable.entry.arriving')}</span>
        )}
      </span>
      {showHeadsign && (
        <HeadsignBadge
          routeDirection={entry.routeDirection}
          infoLevel={infoLevel}
          dataLang={dataLangs}
          agencyLang={agencyLang}
          maxLength={headsignMaxLength}
          size="xs"
          enableVerboseExtras={!disableVerbose}
          showBorder={true}
        />
      )}
      <TimetableEntryAttributesLabels
        attributes={getTimetableEntryAttributes(entry)}
        size={'xs'}
        isDisplayTerminal={isDisplayTerminal}
        isDisplayOrigin={isDisplayOrigin}
        isDisplayPickupUnavailable={isDisplayPickupUnavailable}
        isDisplayDropOffUnavailable={isDisplayDropOffUnavailable}
      />
    </>
  );

  return (
    <span className="inline-flex items-baseline gap-0.5">
      {onInspectTrip ? (
        <button
          type="button"
          className="inline-flex cursor-pointer items-baseline gap-0.5 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={() => onInspectTrip(inspectTarget)}
        >
          {content}
        </button>
      ) : (
        content
      )}
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
