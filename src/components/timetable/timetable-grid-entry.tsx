import type { InfoLevel } from '../../types/app/settings';
import type { TimetableEntry } from '../../types/app/transit-composed';
import { useTranslation } from 'react-i18next';
import { getDisplayMinutes } from '../../domain/transit/timetable-utils';
import { getTimetableEntryAttributes } from '../../domain/transit/timetable-entry-attributes';
import { HeadsignBadge } from '../badge/headsign-badge';
import { VerboseTimetableGridEntry as VerboseGridEntry } from '../verbose/verbose-timetable-grid-entry';
import { TimetableEntryAttributesLabels } from '../label/timetable-entry-attributes-labels';

interface TimetableGridEntryProps {
  entry: TimetableEntry;
  /** Whether to show the headsign badge. */
  showHeadsign: boolean;
  /** Maximum characters for headsign truncation. */
  headsignMaxLength?: number;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
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
  dataLang,
  agencyLang,
  isDisplayTerminal,
  isDisplayOrigin,
  isDisplayPickupUnavailable,
  isDisplayDropOffUnavailable,
  disableVerbose = false,
  defaultOpen = false,
}: TimetableGridEntryProps) {
  const { t } = useTranslation();
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;
  const displayMinutes = getDisplayMinutes(entry);

  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="text-muted-foreground text-sm tabular-nums">
        {String(displayMinutes % 60).padStart(2, '0')}
        {/*
         * Compact inline arriving marker (e.g. "着" / "Arr") attached to the
         * minute number for trips that terminate at this stop. This shares the
         * `timetable.entry.*` namespace with the pill-style labels rendered by
         * TimetableEntryAttributesLabels below, but serves a different purpose:
         * the pill is a full-word label, whereas this is a short inline marker.
         */}
        {entry.patternPosition.isTerminal && (
          <span className="text-[9px] opacity-70">{t('timetable.entry.arriving')}</span>
        )}
      </span>
      {showHeadsign && (
        <HeadsignBadge
          routeDirection={entry.routeDirection}
          infoLevel={infoLevel}
          dataLang={dataLang}
          agencyLang={agencyLang}
          maxLength={headsignMaxLength}
          size="xs"
          disableVerbose={disableVerbose}
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
