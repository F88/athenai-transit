import { StopSummary } from '@/components/stop-summary';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency, Route, Stop, StopServiceState } from '@/types/app/transit';

interface TimetableHeaderProps {
  type: 'route-headsign' | 'stop';
  stop: Stop;
  routes: Route[];
  agencies: Agency[];
  stopServiceState: StopServiceState;
  infoLevel: InfoLevel;
  dataLang: readonly string[];
}

/**
 * Render the stop and operator summary shown at the top of the timetable modal.
 *
 * @param props - Header rendering inputs.
 * @returns The rendered timetable header summary.
 */
export function TimetableHeader({
  type,
  stop,
  routes,
  agencies,
  stopServiceState,
  infoLevel,
  dataLang,
}: TimetableHeaderProps) {
  const routeTypes = [...new Set(routes.map((route) => route.route_type))];
  const route = routes[0];

  const displayAgencies =
    type === 'route-headsign' && route
      ? agencies.filter((agency) => agency.agency_id === route.agency_id)
      : agencies;

  return (
    <StopSummary
      stop={stop}
      routeTypes={routeTypes}
      agencies={displayAgencies}
      infoLevel={infoLevel}
      dataLang={dataLang}
      stopServiceState={stopServiceState}
      routes={routes}
      agencyBadgeSize="default"
      routeBadgeSize="md"
    />
  );
}
