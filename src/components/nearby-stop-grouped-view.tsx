import { useMemo } from 'react';
import { groupByRouteHeadsign } from '../domain/transit/group-timetable-entries';
import { sortTimetableEntriesByDisplayTimeChronologically } from '../domain/transit/sort-timetable-for-ui';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry, TripInspectionTarget } from '../types/app/transit-composed';
import { StopTimesItem } from './stop-times-item';

const PER_GROUP_MAX_ENTRIES = 3;

export interface NearbyStopGroupedViewProps {
  /** Stop ID used for child keys and to curry `onShowTimetable`. */
  stopId: string;
  stopTimes: ContextualTimetableEntry[];
  now: Date;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  agencies: Agency[];
  /** Whether each row should render a route_type emoji. */
  showRouteTypeIcon: boolean;
  /** Whether each row should render the operating agency badge. */
  showAgency: boolean;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Route+headsign grouped listing of upcoming stop times for a single stop.
 *
 * Pre-sorts entries by displayed minute via
 * {@link sortTimetableEntriesByDisplayTimeChronologically} so within-group
 * order reads chronologically, then groups by route+headsign via
 * {@link groupByRouteHeadsign}. The parent `<NearbyStop>` only mounts
 * this component when the grouped view is active, so the preprocessing
 * is paid only when this view is on screen.
 */
export function NearbyStopGroupedView({
  stopId,
  stopTimes,
  now,
  infoLevel,
  dataLangs,
  agencies,
  showRouteTypeIcon,
  showAgency,
  onShowTimetable,
  onInspectTrip,
}: NearbyStopGroupedViewProps) {
  const groups = useMemo(() => {
    const sorted = sortTimetableEntriesByDisplayTimeChronologically([...stopTimes]);
    return groupByRouteHeadsign(sorted).map(
      ([key, entries]) =>
        [key, entries.slice(0, PER_GROUP_MAX_ENTRIES)] as [string, ContextualTimetableEntry[]],
    );
  }, [stopTimes]);

  return (
    <>
      {groups.map(([key, entries]) => (
        <StopTimesItem
          key={`${stopId}__${key}`}
          entries={entries}
          now={now}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          showRouteTypeIcon={showRouteTypeIcon}
          agency={agencies.find((a) => a.agency_id === entries[0].routeDirection.route.agency_id)}
          showAgency={showAgency}
          onShowTimetable={
            onShowTimetable
              ? (routeId, headsign) => onShowTimetable(stopId, routeId, headsign)
              : undefined
          }
          onInspectTrip={onInspectTrip}
          maxDisplay={PER_GROUP_MAX_ENTRIES}
        />
      ))}
    </>
  );
}
