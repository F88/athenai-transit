import type { StopWithContext, StopWithMeta } from '../../types/app/transit-composed';

/**
 * Debug dump of StopMetrics data (stats + geo).
 * Includes its own details/summary for collapsed display.
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
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Metrics]
      </summary>
      <div className="mt-0.5">
        <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 whitespace-nowrap">
          <span className="block">
            [stats]{' '}
            {stats
              ? `freq=${stats.freq} routeCount=${stats.routeCount} routeTypeCount=${stats.routeTypeCount} earliest=${stats.earliestDeparture} latest=${stats.latestDeparture}`
              : '(none)'}
          </span>
          <span className="block">
            [geo] nearestRoute={geo?.nearestRoute ?? '(none)'}km portal=
            {geo?.walkablePortal != null ? `${geo.walkablePortal}km` : '(none)'}
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
      </div>
    </details>
  );
}
