import type { ResolvedDisplayNames } from '../../domain/transit/get-display-names';
import type {
  Agency,
  Route,
  AppRouteTypeValue,
  Stop,
  StopServiceState,
} from '../../types/app/transit';
import type { StopWithContext, StopWithMeta } from '../../types/app/transit-composed';
import { VerboseStop } from './verbose-stop';
import { VerboseStopDisplayNames } from './verbose-stop-display-names';

/**
 * Debug dump of all StopInfo props.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseStopData({
  stop,
  stopNames,
  serviceState,
  distance,
  bearing,
  routeTypes,
  agencies,
  routes,
  stats,
  geo,
}: {
  stop: Stop;
  stopNames: ResolvedDisplayNames;
  serviceState?: StopServiceState;
  distance?: number;
  bearing: number | null;
  routeTypes: AppRouteTypeValue[];
  agencies: Agency[];
  routes?: Route[];
  stats?: StopWithMeta['stats'];
  geo?: StopWithContext['geo'];
}) {
  return (
    <details className="mt-1 text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [StopData]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <div className="overflow-x-auto rounded border border-dashed border-gray-300 p-1.5 whitespace-nowrap dark:border-gray-600">
          <VerboseStop stop={stop} serviceState={serviceState} />
          <p className="m-0">
            [position] distance={distance ?? '?'}m bearing=
            {bearing != null ? `${Math.round(bearing)}°` : '?'}
            {` routeTypes=[${routeTypes.join(',')}]`}
          </p>
          <VerboseAgencies agencies={agencies} />
          <VerboseRoutes routes={routes} />
          <VerboseStats stats={stats} />
          <VerboseGeo geo={geo} />
        </div>
        <VerboseStopDisplayNames names={stopNames} />
      </div>
    </details>
  );
}

function VerboseAgencies({ agencies }: { agencies: Agency[] }) {
  return (
    <p className="m-0">
      [agencies]{' '}
      {agencies.length > 0
        ? `[${agencies.map((a) => a.agency_short_name || a.agency_id).join(', ')}]`
        : '(none)'}
    </p>
  );
}

function VerboseStats({ stats }: { stats?: StopWithMeta['stats'] }) {
  return (
    <p className="m-0">
      [stats]{' '}
      {stats ? (
        <>
          freq={stats.freq} routes={stats.routeCount} types={stats.routeTypeCount}
          {` earliest=${stats.earliestDeparture} latest=${stats.latestDeparture}`}
        </>
      ) : (
        '(none)'
      )}
    </p>
  );
}

function VerboseGeo({ geo }: { geo?: StopWithContext['geo'] }) {
  return (
    <p className="m-0">
      [geo]{' '}
      {geo ? (
        <>
          nearestRoute={geo.nearestRoute}km
          {` portal=${geo.walkablePortal ?? '(none)'}`}
          {geo.connectivity
            ? Object.entries(geo.connectivity).map(
                ([group, c]) =>
                  ` ${group}:routes=${c.routeCount},freq=${c.freq},stops=${c.stopCount}`,
              )
            : ' connectivity=(none)'}
        </>
      ) : (
        '(none)'
      )}
    </p>
  );
}

function VerboseRoutes({ routes }: { routes?: Route[] }) {
  return (
    <p className="m-0">
      [routes]{' '}
      {routes
        ? routes.length > 0
          ? `[${routes.map((r) => r.route_short_name || r.route_id).join(', ')}]`
          : '[]'
        : '(none)'}
    </p>
  );
}
