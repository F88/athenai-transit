import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { DepartureGroup, StopWithContext } from '../types/app/transit-composed';
import { collectPresentAgencies, filterStopsByAgency } from '../domain/transit/agency-filter';
import { DEPARTURE_VIEWS, DEFAULT_VIEW_ID } from '../domain/transit/departure-views';
import { routeTypeColor } from '../domain/transit/route-type-color';
import { routeTypeEmoji } from '../domain/transit/route-type-emoji';
import { getServiceDayMinutes } from '../domain/transit/service-day';
import { useInfoLevel } from '../hooks/use-info-level';
import { PillButton } from './button/pill-button';
import { NearbyStop } from './nearby-stop';

const DRAG_THRESHOLD = 50;

/** Auto-enable "active only" filter at 22:00 in service day minutes. */
const LATE_NIGHT_THRESHOLD_MINUTES = 22 * 60;

/** Route type display order matching StopTypeFilterPanel. */
const ROUTE_TYPE_ORDER = [3, 1, 0, 2, 4, 5, 6, 7] as const;

interface BottomSheetProps {
  nearbyDepartures: StopWithContext[];
  selectedStopId: string | null;
  isNearbyLoading: boolean;
  time: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, group: DepartureGroup) => void;
  onShowStopTimetable?: (stopId: string) => void;
}

export function BottomSheet({
  nearbyDepartures,
  selectedStopId,
  isNearbyLoading,
  time: now,
  mapCenter,
  infoLevel,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
}: BottomSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewId, setViewId] = useState(DEFAULT_VIEW_ID);
  const isLateNight = getServiceDayMinutes(now) >= LATE_NIGHT_THRESHOLD_MINUTES;
  // User can toggle manually; null means "use auto (isLateNight)".
  const [activeOnlyOverride, setActiveOnlyOverride] = useState<boolean | null>(null);
  const activeOnly = activeOnlyOverride ?? isLateNight;
  const [hiddenRouteTypes, setHiddenRouteTypes] = useState<Set<number>>(() => new Set());
  const [hiddenAgencyIds, setHiddenAgencyIds] = useState<Set<string>>(() => new Set());
  const info = useInfoLevel(infoLevel);
  const selectedView = DEPARTURE_VIEWS.find((v) => v.id === viewId);
  const touchStartY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Route types present in the current nearby stops.
  const presentRouteTypes = useMemo(() => {
    const types = new Set<number>();
    for (const swc of nearbyDepartures) {
      for (const rt of swc.routeTypes) {
        types.add(rt);
      }
    }
    return ROUTE_TYPE_ORDER.filter((rt) => types.has(rt));
  }, [nearbyDepartures]);

  const toggleRouteType = useCallback((rt: number) => {
    setHiddenRouteTypes((prev) => {
      const next = new Set(prev);
      if (next.has(rt)) {
        next.delete(rt);
      } else {
        next.add(rt);
      }
      return next;
    });
  }, []);

  const presentAgencies = useMemo(
    () => collectPresentAgencies(nearbyDepartures),
    [nearbyDepartures],
  );

  const toggleAgency = useCallback((agency: Agency) => {
    setHiddenAgencyIds((prev) => {
      const next = new Set(prev);
      if (next.has(agency.agency_id)) {
        next.delete(agency.agency_id);
      } else {
        next.add(agency.agency_id);
      }
      return next;
    });
  }, []);

  const filteredDepartures = useMemo(() => {
    let result = nearbyDepartures;
    if (activeOnly) {
      result = result.filter((swc) => swc.groups.length > 0);
    }
    if (hiddenRouteTypes.size > 0) {
      result = result.filter((swc) => !swc.routeTypes.every((rt) => hiddenRouteTypes.has(rt)));
    }
    if (hiddenAgencyIds.size > 0 && presentAgencies.length > 1) {
      result = filterStopsByAgency(result, hiddenAgencyIds);
    }
    return result;
  }, [nearbyDepartures, activeOnly, hiddenRouteTypes, hiddenAgencyIds, presentAgencies]);

  const activeCount = useMemo(
    () => nearbyDepartures.filter((swc) => swc.groups.length > 0).length,
    [nearbyDepartures],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(deltaY) < DRAG_THRESHOLD) {
      return;
    }

    if (deltaY < 0) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, []);

  // Scroll to selected stop
  useEffect(() => {
    if (!selectedStopId || !contentRef.current) {
      return;
    }

    const el = contentRef.current.querySelector(`[data-stop-id="${selectedStopId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedStopId, nearbyDepartures]);

  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-1000 flex touch-none flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.15)] transition-[height] duration-300 ease-in-out dark:bg-gray-900 ${expanded ? 'h-[70dvh]' : 'h-[40dvh]'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex shrink-0 cursor-grab justify-center py-2 pb-1"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="h-1 w-9 rounded-sm bg-[#bdbdbd] dark:bg-gray-600" />
      </div>

      <div className="shrink-0 px-4 pb-2">
        <p className="m-0 text-base font-bold text-[#212121] dark:text-gray-100">
          {isNearbyLoading
            ? '読み込み中...'
            : filteredDepartures.length > 0
              ? `近くの乗り場 (${filteredDepartures.length}カ所)`
              : activeOnly && nearbyDepartures.length > 0
                ? '運行中の乗り場はありません'
                : '近くに乗り場がありません'}
        </p>
        <div className="mt-1.5 flex gap-1 overflow-x-auto">
          {DEPARTURE_VIEWS.filter((v) => v.visible).map((view) => (
            <PillButton
              key={view.id}
              active={viewId === view.id}
              disabled={!view.enabled}
              onClick={() => setViewId(view.id)}
              title={view.title}
            >
              {view.icon}
              {info.isDetailedEnabled ? ` ${view.label}` : ''}
            </PillButton>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          <PillButton
            active={activeOnly}
            onClick={() => setActiveOnlyOverride((v) => !(v ?? isLateNight))}
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
                onClick={() => toggleRouteType(rt)}
              >
                {routeTypeEmoji(rt)}
              </PillButton>
            ))}
          {/* Agency filter — shown only when 2+ agencies are present */}
          {presentAgencies.length > 1 &&
            presentAgencies.map((agency) => {
              const primary = agency.agency_colors[0];
              const color = primary ? `#${primary.bg}` : undefined;
              return (
                <PillButton
                  key={agency.agency_id}
                  active={!hiddenAgencyIds.has(agency.agency_id)}
                  activeBg={color ? `${color}20` : undefined}
                  activeBorder={color}
                  onClick={() => toggleAgency(agency)}
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
              <p className="text-[10px] text-[#aaa] dark:text-gray-500">
                {selectedView.description}
              </p>
            )}
          </div>
        )}
      </div>
      <div
        className="grid flex-1 grid-cols-1 content-start gap-0 overflow-y-auto px-4 pb-0 sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-3"
        ref={contentRef}
      >
        {filteredDepartures.map((swc) => (
          <NearbyStop
            key={swc.stop.stop_id}
            data={swc}
            isSelected={selectedStopId === swc.stop.stop_id}
            now={now}
            mapCenter={mapCenter}
            infoLevel={infoLevel}
            viewId={viewId}
            onStopSelected={(stopId) => {
              setExpanded(false);
              onStopSelected(stopId);
            }}
            onShowTimetable={onShowTimetable}
            onShowStopTimetable={onShowStopTimetable}
          />
        ))}
      </div>
    </div>
  );
}
