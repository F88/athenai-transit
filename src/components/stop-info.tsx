import { bearingDeg } from '../domain/transit/distance';
import type { LatLng } from '../types/app/map';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import { DistanceBadge } from './badge/distance-badge';
import { StopMetrics } from './stop-metrics';
import { StopSummary, type StopSummaryCoreProps } from './stop-summary';

interface StopInfoProps extends StopSummaryCoreProps {
  /** Pre-computed distance in meters from map center. */
  distance?: number;
  mapCenter: LatLng | null;
  /** Per-stop operational statistics from InsightsBundle. */
  stats?: StopWithMeta['stats'];
  /** Geographic metrics from GlobalInsightsBundle. */
  geo?: StopWithContext['geo'];
}

/**
 * Displays stop identification: name, route type emoji, distance/direction,
 * drop-off-only label, and agency badges.
 *
 * Does not include action buttons (anchor, timetable) — those belong
 * to the parent component's interaction layer.
 */
export function StopInfo({
  stop,
  agencies,
  showAgencies,
  routeTypes,
  showRouteTypes,
  routes,
  showRoutes,
  distance,
  mapCenter,
  infoLevel,
  dataLangs,
  stopServiceState,
  agencyBadgeSize,
  routeBadgeSize,
  stats,
  geo,
}: StopInfoProps) {
  const distanceRounded = distance != null ? Math.round(distance) : null;
  const bearing = mapCenter ? bearingDeg(mapCenter, stop) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center self-stretch">
      <div className="min-w-0">
        <StopSummary
          stop={stop}
          agencies={agencies}
          showAgencies={showAgencies}
          routeTypes={routeTypes}
          showRouteTypes={showRouteTypes}
          routes={routes}
          showRoutes={showRoutes}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          stopServiceState={stopServiceState}
          agencyBadgeSize={agencyBadgeSize}
          routeBadgeSize={routeBadgeSize}
          distanceBadge={
            distanceRounded != null && distanceRounded >= 10 ? (
              <DistanceBadge meters={distanceRounded} bearingDeg={bearing} showDirection />
            ) : undefined
          }
        />
      </div>
      <StopMetrics stats={stats} geo={geo} infoLevel={infoLevel} />
    </div>
  );
}
