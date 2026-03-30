import type { StopWithContext, StopWithMeta } from '../../types/app/transit-composed';

/**
 * Debug dump of StopMetrics data (stats + geo).
 * Only rendered in verbose info level.
 */
export function VerboseStopMetrics({
  stats,
  geo,
}: {
  stats?: StopWithMeta['stats'];
  geo?: StopWithContext['geo'];
}) {
  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
      <span className="block">
        [stats]{' '}
        {stats
          ? `freq=${stats.freq} routeCount=${stats.routeCount} routeTypeCount=${stats.routeTypeCount} earliest=${stats.earliestDeparture} latest=${stats.latestDeparture}`
          : '(none)'}
      </span>
      <span className="block">
        [geo] nearestRoute={geo?.nearestRoute ?? '(none)'}km portal=
        {geo?.walkablePortal ?? '(none)'}
      </span>
      <span className="block">
        [connectivity]{' '}
        {geo?.connectivity
          ? Object.entries(geo.connectivity)
              .map(
                ([group, c]) =>
                  `${group}:routes=${c.routeCount},freq=${c.freq},stops=${c.stopCount}`,
              )
              .join(' ')
          : '(none)'}
      </span>
    </span>
  );
}
