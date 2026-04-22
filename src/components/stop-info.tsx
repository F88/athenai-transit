import type { LatLng } from '../types/app/map';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import { bearingDeg } from '../domain/transit/distance';
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
  routeTypes,
  agencies,
  distance,
  mapCenter,
  infoLevel,
  dataLang,
  stopServiceState,
  routes,
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
          routeTypes={routeTypes}
          agencies={agencies}
          infoLevel={infoLevel}
          dataLang={dataLang}
          stopServiceState={stopServiceState}
          routes={routes}
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
