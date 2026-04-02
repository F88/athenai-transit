import type { DataConfig } from '../config/perf-profiles';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { DepartureViewMeta } from '../types/app/transit-composed';
import type { NearbyStopsCounts } from './bottom-sheet';
import { DEPARTURE_VIEWS } from '../domain/transit/departure-views';
import { createLogger } from '../utils/logger';
import { routeTypeColor } from '../utils/route-type-color';
import { routeTypeEmoji } from '../utils/route-type-emoji';
import { useInfoLevel } from '../hooks/use-info-level';
import { PillButton } from './button/pill-button';

interface BottomSheetHeaderProps {
  hasNearbyLoaded: boolean;
  counts: NearbyStopsCounts;
  dataConfig: DataConfig;
  activeOnly: boolean;
  viewId: string;
  selectedView: DepartureViewMeta | undefined;
  infoLevel: InfoLevel;
  presentRouteTypes: readonly number[];
  hiddenRouteTypes: Set<number>;
  presentAgencies: Agency[];
  hiddenAgencyIds: Set<string>;
  onToggleActiveOnly: () => void;
  onViewChange: (viewId: string) => void;
  onToggleRouteType: (rt: number) => void;
  onToggleAgency: (agency: Agency) => void;
}

export function BottomSheetHeader({
  hasNearbyLoaded,
  counts,
  dataConfig,
  activeOnly,
  viewId,
  selectedView,
  infoLevel,
  presentRouteTypes,
  hiddenRouteTypes,
  presentAgencies,
  hiddenAgencyIds,
  onToggleActiveOnly,
  onViewChange,
  onToggleRouteType,
  onToggleAgency,
}: BottomSheetHeaderProps) {
  const info = useInfoLevel(infoLevel);

  return (
    <div className="shrink-0 px-4 pb-2">
      <NearbyStopsSummary
        hasLoaded={hasNearbyLoaded}
        counts={counts}
        nearbyRadius={dataConfig.stops.nearbyRadius}
        activeOnly={activeOnly}
      />
      <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto">
        {DEPARTURE_VIEWS.filter((v) => v.visible).map((view) => (
          <PillButton
            key={view.id}
            size={'sm'}
            active={viewId === view.id}
            disabled={!view.enabled}
            onClick={() => onViewChange(view.id)}
            title={view.title}
          >
            {view.icon}
            {info.isDetailedEnabled ? ` ${view.label}` : ''}
          </PillButton>
        ))}
      </div>
      <div className="no-scrollbar mt-1 flex gap-1 overflow-x-auto">
        <PillButton
          size={'sm'}
          active={activeOnly}
          activeBg={'#1565c0'}
          activeBorder={'#1565c0'}
          inactiveBorder={'#1565c0'}
          onClick={onToggleActiveOnly}
          title="次便がある乗り場のみ表示"
          count={counts.active}
        >
          運行中
        </PillButton>

        {/* Route types filter */}
        {presentRouteTypes.length > 1 &&
          presentRouteTypes.map((rt) => (
            <PillButton
              key={rt}
              size={'sm'}
              active={!hiddenRouteTypes.has(rt)}
              activeBg={`${routeTypeColor(rt)}20`}
              activeBorder={routeTypeColor(rt)}
              onClick={() => onToggleRouteType(rt)}
            >
              {routeTypeEmoji(rt)}
            </PillButton>
          ))}
        {/* Agency filter — shown only when 2+ agencies are present */}
        {presentAgencies.length > 1 &&
          presentAgencies.map((agency) => {
            const primary = agency.agency_colors[0];
            const bgColor = primary ? `#${primary.bg}` : undefined;
            const fgColor = primary ? `#${primary.text}` : undefined;
            return (
              <PillButton
                key={agency.agency_id}
                size={'sm'}
                active={!hiddenAgencyIds.has(agency.agency_id)}
                activeBg={bgColor}
                activeFg={fgColor}
                activeBorder={bgColor}
                inactiveBorder={bgColor}
                onClick={() => onToggleAgency(agency)}
                title={agency.agency_name}
              >
                {agency.agency_short_name || agency.agency_name}
              </PillButton>
            );
          })}
      </div>
      {selectedView && info.isVerboseEnabled && (
        <div className="mt-1">
          <p className="text-[11px] text-[#888] dark:text-gray-400">{selectedView.title}</p>
          {info.isDetailedEnabled && (
            <p className="text-[10px] text-[#aaa] dark:text-gray-500">{selectedView.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${meters / 1000}km`;
  }
  return `${meters}m`;
}

function getNearbyStopsSummaryText(
  hasLoaded: boolean,
  counts: NearbyStopsCounts,
  activeOnly: boolean,
): string {
  if (!hasLoaded) {
    return 'Loading...';
  }
  if (counts.filtered > 0) {
    return `近くの乗り場 ${counts.filtered}カ所`;
    // return `${counts.filtered}`;
  }
  if (activeOnly && counts.total > 0) {
    return '運行中の乗り場はありません';
  }
  return '近くに乗り場がありません';
}

const summaryLogger = createLogger('NearbyStopsSummary');

interface NearbyStopsSummaryProps {
  counts: NearbyStopsCounts;
  nearbyRadius: number;
  activeOnly: boolean;
  hasLoaded: boolean;
}

function NearbyStopsSummary({
  counts,
  nearbyRadius,
  activeOnly,
  hasLoaded,
}: NearbyStopsSummaryProps) {
  summaryLogger.verbose(
    hasLoaded
      ? `found ${counts.total} nearby stops (${counts.active} active, ${counts.filtered} after filter)`
      : 'not loaded yet',
  );
  const radiusLabel = `${formatRadius(nearbyRadius)}圏内`;
  const text = getNearbyStopsSummaryText(hasLoaded, counts, activeOnly);

  return (
    <p className="m-0 flex items-center gap-1 text-base font-bold text-[#212121] dark:text-gray-100">
      {text} / {radiusLabel}
    </p>
  );
}
