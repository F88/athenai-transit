import type { DataConfig } from '../config/perf-profiles';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { DepartureViewMeta } from '../types/app/transit-composed';
import { DEPARTURE_VIEWS } from '../domain/transit/departure-views';
import { routeTypeColor } from '../domain/transit/route-type-color';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { useInfoLevel } from '../hooks/use-info-level';
import { PillButton } from './button/pill-button';

interface BottomSheetHeaderProps {
  isNearbyLoading: boolean;
  filteredCount: number;
  hasNearbyDepartures: boolean;
  dataConfig: DataConfig;
  activeOnly: boolean;
  activeCount: number;
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
  isNearbyLoading,
  filteredCount,
  hasNearbyDepartures,
  dataConfig,
  activeOnly,
  activeCount,
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
      <p className="m-0 text-base font-bold text-[#212121] dark:text-gray-100">
        {isNearbyLoading
          ? '読み込み中...'
          : filteredCount > 0
            ? `近くの乗り場 ${filteredCount}カ所, ${dataConfig.stops.nearbyRadius >= 1000 ? `${dataConfig.stops.nearbyRadius / 1000}km` : `${dataConfig.stops.nearbyRadius}m`}圏内`
            : activeOnly && hasNearbyDepartures
              ? '運行中の乗り場はありません'
              : '近くに乗り場がありません'}
      </p>
      <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto">
        {DEPARTURE_VIEWS.filter((v) => v.visible).map((view) => (
          <PillButton
            key={view.id}
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
          active={activeOnly}
          onClick={onToggleActiveOnly}
          title="次便がある乗り場のみ表示"
        >
          運行中 ({activeCount})
        </PillButton>

        {/* Route types filter */}
        {presentRouteTypes.length > 1 &&
          presentRouteTypes.map((rt) => (
            <PillButton
              key={rt}
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
      {selectedView && info.isNormalEnabled && (
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
