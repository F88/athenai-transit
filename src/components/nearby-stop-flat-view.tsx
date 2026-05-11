import { useMemo } from 'react';
import { getEffectiveHeadsign } from '../domain/transit/get-effective-headsign';
import { sortTimetableEntriesByDisplayTimeChronologically } from '../domain/transit/sort-timetable-for-ui';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry, TripInspectionTarget } from '../types/app/transit-composed';
import { StopTimeItem } from './stop-time-item';

const FLAT_VIEW_MAX_ENTRIES = 5;

export interface NearbyStopFlatViewProps {
  stopTimes: ContextualTimetableEntry[];
  now: Date;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  agencies: Agency[];
  /** Whether each row should render a route_type emoji. */
  showRouteTypeIcon: boolean;
  /** Whether each row should render the operating agency badge. */
  showAgency: boolean;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Flat (chronological) listing of upcoming stop times for a single stop.
 *
 * Sorts the input by displayed minute via
 * {@link sortTimetableEntriesByDisplayTimeChronologically} and renders the
 * first {@link FLAT_VIEW_MAX_ENTRIES} rows. Encapsulating the sort and
 * truncation here lets the parent `<NearbyStop>` mount only the active
 * view component, so the preprocessing for inactive views never runs.
 */
export function NearbyStopFlatView({
  stopTimes,
  now,
  infoLevel,
  dataLangs,
  agencies,
  showRouteTypeIcon,
  showAgency,
  onInspectTrip,
}: NearbyStopFlatViewProps) {
  const entries = useMemo(
    () =>
      sortTimetableEntriesByDisplayTimeChronologically([...stopTimes]).slice(
        0,
        FLAT_VIEW_MAX_ENTRIES,
      ),
    [stopTimes],
  );

  return (
    <>
      {entries.map((entry, i) => (
        <StopTimeItem
          key={`${entry.routeDirection.route.route_id}__${getEffectiveHeadsign(entry.routeDirection)}__${entry.schedule.departureMinutes}__${i}`}
          entry={entry}
          now={now}
          forceShowRelativeTime={i === 0}
          showRouteTypeIcon={showRouteTypeIcon}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          agency={agencies.find((a) => a.agency_id === entry.routeDirection.route.agency_id)}
          showAgency={showAgency}
          onInspectTrip={onInspectTrip}
        />
      ))}
    </>
  );
}
