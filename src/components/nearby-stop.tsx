import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { StopWithContext } from '../types/app/transit-composed';
import { getEffectiveHeadsign } from '../domain/transit/get-effective-headsign';
import { groupByRouteHeadsign } from '../domain/transit/group-timetable-entries';
import { useInfoLevel } from '../hooks/use-info-level';
import { Clock, Signpost } from 'lucide-react';
import { DepartureItem } from './departure-item';
import { FlatDepartureItem } from './flat-departure-item';
import { StopInfo } from './stop-info';
import { VerboseNearbyStopSummary } from './verbose/verbose-nearby-stop-summary';

export interface NearbyStopProps {
  data: StopWithContext;
  isSelected: boolean;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Active departure view pattern ID. */
  viewId: string;
  /** Whether this stop is in the anchor (bookmark) list. */
  isAnchor: boolean;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for this stop. */
  onToggleAnchor: (stopId: string) => void;
}

export function NearbyStop({
  data: {
    stop,
    routeTypes,
    departures,
    isBoardableOnServiceDay,
    agencies,
    routes,
    distance,
    stats,
    geo,
  },
  isSelected,
  now,
  mapCenter,
  infoLevel,
  dataLang,
  viewId,
  isAnchor,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
}: NearbyStopProps) {
  const { t } = useTranslation();
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';
  // Show route_type emoji on each departure row when the stop serves
  // multiple route_types (so the user can distinguish bus vs tram etc.).
  // verbose: always show. detailed and below: only when multiple types.
  const hasMultipleRouteTypes = routeTypes.length > 1;
  const showRouteTypeIconForAllDepartures = info.isVerboseEnabled || hasMultipleRouteTypes;

  // detailed: show all entries (including terminal/drop-off-only with labels)
  // non-detailed: show only boardable departures
  // const displayDepartures = useMemo(
  //   () => (info.isDetailedEnabled ? departures : filterBoardable(departures)),
  //   [info.isDetailedEnabled, departures],
  // );
  const displayDepartures = departures;

  const grouped = useMemo(
    () => (viewId !== 'stop' ? groupByRouteHeadsign(displayDepartures) : []),
    [viewId, displayDepartures],
  );

  const hasUnknownHeadsign = useMemo(
    () => departures.some((e) => getEffectiveHeadsign(e.routeDirection) === ''),
    [departures],
  );

  const isStopDropOffOnly = !isBoardableOnServiceDay;

  return (
    <div
      data-stop-id={stop.stop_id}
      className={`mb-2 cursor-pointer rounded-lg px-3 pt-2.5 pb-3 last:mb-0 ${isSelected ? 'border border-[#90caf9] bg-[#e3f2fd] dark:border-blue-700 dark:bg-blue-950' : 'bg-[#f5f7fa] dark:bg-gray-800'}`}
      onClick={() => onStopSelected(stop.stop_id)}
    >
      {showVerbose && (
        <VerboseNearbyStopSummary
          departures={departures}
          isBoardableOnServiceDay={isBoardableOnServiceDay}
          isSelected={isSelected}
          isAnchor={isAnchor}
          viewId={viewId}
        />
      )}
      <div className="m-0 mb-1.5 flex items-start gap-1">
        <StopInfo
          stop={stop}
          routeTypes={routeTypes}
          agencies={agencies}
          distance={distance}
          mapCenter={mapCenter}
          infoLevel={infoLevel}
          dataLang={dataLang}
          isDropOffOnly={isStopDropOffOnly}
          routes={routes}
          stats={stats}
          geo={geo}
        />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded border border-amber-400 bg-transparent px-1.5 py-0.5 active:bg-amber-50 dark:border-amber-500 dark:active:bg-amber-950"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAnchor(stop.stop_id);
            }}
            title={isAnchor ? t('anchor.remove') : t('anchor.add')}
            aria-label={isAnchor ? t('anchor.remove') : t('anchor.add')}
            aria-pressed={isAnchor}
          >
            <Signpost
              size={16}
              strokeWidth={2}
              className={isAnchor ? 'text-amber-500' : 'text-gray-400'}
            />
          </button>
          {onShowStopTimetable && (
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded border border-[#1976d2] bg-transparent px-1.5 py-0.5 text-[#1976d2] active:bg-[rgba(25,118,210,0.1)] dark:border-blue-400 dark:text-blue-400"
              onClick={(e) => {
                e.stopPropagation();
                onShowStopTimetable(stop.stop_id);
              }}
              title={t('showTimetable')}
              aria-label={t('showTimetable')}
            >
              <Clock size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {hasUnknownHeadsign && (
        <p className="m-0 mb-1 text-[11px] text-amber-600 dark:text-amber-400">
          {t('stop.noDestination')}
        </p>
      )}
      {displayDepartures.length > 0 ? (
        viewId === 'stop' ? (
          displayDepartures
            .slice(0, 5)
            .map((entry, i) => (
              <FlatDepartureItem
                key={`${entry.routeDirection.route.route_id}__${getEffectiveHeadsign(entry.routeDirection)}__${entry.schedule.departureMinutes}__${i}`}
                entry={entry}
                now={now}
                isFirst={i === 0}
                showRouteTypeIcon={showRouteTypeIconForAllDepartures}
                infoLevel={infoLevel}
                dataLang={dataLang}
                agency={agencies.find((a) => a.agency_id === entry.routeDirection.route.agency_id)}
              />
            ))
        ) : (
          grouped.map(([key, entries]) => (
            <DepartureItem
              key={`${stop.stop_id}__${key}`}
              entries={entries}
              now={now}
              infoLevel={infoLevel}
              dataLang={dataLang}
              showRouteTypeIcon={showRouteTypeIconForAllDepartures}
              agency={agencies.find(
                (a) => a.agency_id === entries[0].routeDirection.route.agency_id,
              )}
              onShowTimetable={
                onShowTimetable
                  ? (routeId, headsign) => onShowTimetable(stop.stop_id, routeId, headsign)
                  : undefined
              }
            />
          ))
        )
      ) : (
        <p className="m-0 text-xs text-[#9e9e9e] dark:text-gray-500">{t('stop.serviceEnded')}</p>
      )}
    </div>
  );
}
