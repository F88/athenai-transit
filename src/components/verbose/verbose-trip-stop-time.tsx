import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '@/config/transit-defaults';
import { formatDateKey } from '@/domain/transit/calendar-utils';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import type { InfoLevel } from '@/types/app/settings';
import type { TripStopTime } from '@/types/app/transit-composed';

import { VerboseStopData } from './verbose-stop-data';
import { VerboseTimetableEntry } from './verbose-timetable-entries';

interface VerboseTripStopTimeProps {
  tripStopTime: TripStopTime;
  serviceDate: Date;
  currentStopIndex?: number;
  infoLevel?: InfoLevel;
  dataLangs: readonly string[];
  defaultOpen?: boolean;
}

/**
 * Debug dump of a reconstructed TripStopTime.
 *
 * Shows the selected stop event identity as reconstructed in trip inspection:
 * optional stop metadata enrichment, route types, pattern position, and the
 * underlying timetable entry.
 */
export function VerboseTripStopTime({
  tripStopTime,
  serviceDate,
  currentStopIndex,
  infoLevel = 'verbose',
  dataLangs,
  defaultOpen = false,
}: VerboseTripStopTimeProps) {
  const stopMeta = tripStopTime.stopMeta;
  const stop = stopMeta?.stop;
  const stopAgencyLangs = stopMeta
    ? resolveAgencyLang(stopMeta.agencies, stopMeta.stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const stopNames = stop ? getStopDisplayNames(stop, dataLangs, stopAgencyLangs) : null;
  const patternPosition = tripStopTime.timetableEntry.patternPosition;

  return (
    <details
      open={defaultOpen}
      className="mt-1 text-[9px] font-normal text-[#999] dark:text-gray-500"
    >
      <summary
        tabIndex={-1}
        className="cursor-pointer select-none"
        onClick={(e) => e.stopPropagation()}
      >
        [TripStopTime]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <div className="border-app-neutral overflow-x-auto rounded border border-dashed p-1.5 whitespace-nowrap">
          <p className="m-0">[serviceDate] {formatDateKey(serviceDate)}</p>
          <p className="m-0">
            [selected]
            {currentStopIndex != null ? ` row=${currentStopIndex + 1}` : ' row=?'}
            {` pattern=${patternPosition.stopIndex + 1}/${patternPosition.totalStops}`}
            {` hasStopMeta=${stopMeta ? 'yes' : 'no'}`}
            {` routeTypes=[${tripStopTime.routeTypes.join(',')}]`}
          </p>
          <p className="m-0">
            [stop]
            {` id=${stop?.stop_id ?? '(unknown-stop)'}`}
            {` name=${stopNames?.name ?? stop?.stop_name ?? '(unknown-stop)'}`}
          </p>
        </div>

        {stopMeta && stopNames && (
          <VerboseStopData
            stop={stopMeta.stop}
            stopNames={stopNames}
            serviceState={undefined}
            distance={undefined}
            bearing={null}
            routeTypes={tripStopTime.routeTypes}
            agencies={stopMeta.agencies}
            routes={stopMeta.routes}
            stats={stopMeta.stats}
            geo={stopMeta.geo}
          />
        )}

        <VerboseTimetableEntry
          timetableEntry={tripStopTime.timetableEntry}
          dataLangs={dataLangs}
          agencyLang={stopAgencyLangs}
          infoLevel={infoLevel}
          defaultOpen={false}
        />
      </div>
    </details>
  );
}
