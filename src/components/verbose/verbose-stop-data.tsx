import type { Agency, Route, RouteType, Stop } from '../../types/app/transit';
import type { StopWithContext, StopWithMeta } from '../../types/app/transit-composed';

/**
 * Debug dump of all StopInfo props.
 * Only rendered in verbose info level.
 */
export function VerboseStopData({
  stop,
  isDropOffOnly,
  distance,
  bearing,
  routeTypes,
  agencies,
  routes,
  stats,
  geo,
}: {
  stop: Stop;
  isDropOffOnly: boolean;
  distance?: number;
  bearing: number | null;
  routeTypes: RouteType[];
  agencies: Agency[];
  routes?: Route[];
  stats?: StopWithMeta['stats'];
  geo?: StopWithContext['geo'];
}) {
  return (
    <div className="mt-0.5 space-y-0.5 overflow-x-auto rounded border border-dashed border-gray-300 p-1.5 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
      <VerboseStop stop={stop} isDropOffOnly={isDropOffOnly} />
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
  );
}

function VerboseStop({ stop, isDropOffOnly }: { stop: Stop; isDropOffOnly: boolean }) {
  return (
    <>
      <p className="m-0">
        [stop] agency={stop.agency_id} lat={stop.stop_lat} lon={stop.stop_lon} loc=
        {stop.location_type}
        {stop.wheelchair_boarding != null && ` wb=${stop.wheelchair_boarding}`}
        {stop.parent_station && ` parent=${stop.parent_station}`}
        {stop.platform_code && ` platform=${stop.platform_code}`}
        {isDropOffOnly && ' DROP-OFF-ONLY'}
      </p>
      <p className="m-0">
        [names]{' '}
        {Object.keys(stop.stop_names).length > 0
          ? Object.entries(stop.stop_names)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')
          : '(none)'}
      </p>
    </>
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
