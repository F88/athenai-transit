import type { InfoLevel } from '../types/app/settings';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import { CalendarDays, Milestone, Waypoints } from 'lucide-react';
import { formatDistance } from '../domain/transit/distance';
import { useInfoLevel } from '../hooks/use-info-level';
import { VerboseStopMetrics } from './verbose/verbose-stop-metrics';

interface StopMetricsProps {
  /** Per-stop operational statistics from InsightsBundle. */
  stats?: StopWithMeta['stats'];
  /** Geographic metrics from GlobalInsightsBundle. */
  geo?: StopWithContext['geo'];
  /** Current info verbosity level. */
  infoLevel: InfoLevel;
}

/**
 * Displays stop-level metrics: operational statistics and geographic indicators.
 *
 * Info level controls which metrics are shown:
 * - normal: freq, connectivity
 * - detailed: + nearestRoute
 * - verbose: + walkablePortal, full dump
 *
 * Data sources:
 * - stats (InsightsBundle): freq, routeCount, etc.
 * - geo (GlobalInsightsBundle): nearestRoute, walkablePortal, connectivity
 */
export function StopMetrics({ stats, geo, infoLevel }: StopMetricsProps) {
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';

  return (
    <>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        {info.isNormalEnabled && stats?.freq != null && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
            <CalendarDays size={12} strokeWidth={2} />
            {stats.freq}
          </span>
        )}
        {info.isNormalEnabled &&
          geo?.connectivity &&
          Object.entries(geo.connectivity).map(([group, c]) => (
            <span
              key={group}
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300"
            >
              <Waypoints size={12} strokeWidth={2} />
              {c.routeCount}路線 {c.freq}便 {c.stopCount}のりば (300m)
            </span>
          ))}
        {info.isDetailedEnabled && geo?.nearestRoute != null && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-900 dark:text-teal-300">
            <Milestone size={12} strokeWidth={2} />
            {formatDistance(geo.nearestRoute * 1000)}
          </span>
        )}
        {info.isVerboseEnabled && geo?.walkablePortal != null && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            <Milestone size={12} strokeWidth={2} />
            {formatDistance(geo.walkablePortal * 1000)}
          </span>
        )}
      </div>
      {showVerbose && <VerboseStopMetrics stats={stats} geo={geo} />}
    </>
  );
}
