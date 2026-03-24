import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Bounds, LatLng, RouteShape } from './types/app/map';
import type { RouteType, Stop } from './types/app/transit';
import type { StopWithContext, StopWithMeta } from './types/app/transit-composed';
import { useTransitRepository } from './hooks/use-transit-repository';
import { useUserSettings } from './hooks/use-user-settings';
import { useDateTime } from './hooks/use-date-time';
import { useNearbyDepartures } from './hooks/use-nearby-departures';
import { useSelection } from './hooks/use-selection';
import { useStopHistory } from './hooks/use-stop-history';
import { PERF_PROFILES } from './config/perf-profiles';
import { TILE_SOURCES } from './config/tile-sources';
import {
  toggleInList,
  toggleGroupInList,
  nextRenderMode,
  nextPerfMode,
  nextTileIndex,
} from './utils/settings-helpers';
import { nextInfoLevel } from './utils/next-info-level';
import { createLogger } from './utils/logger';
import { getServiceDay } from './domain/transit/service-day';

const logger = createLogger('App');
import { MapView } from './components/map/map-view';
import { BottomSheet } from './components/bottom-sheet';
import { TimeControls } from './components/time-controls';
import { TimetableModal, type TimetableData } from './components/dialog/timetable-modal';
import { StopSearchModal } from './components/dialog/stop-search-modal';
import { InfoDialog } from './components/dialog/info-dialog';

const DEBOUNCE_MS = 300;

export default function App() {
  const repo = useTransitRepository();
  const { settings, updateSetting, updateSettings } = useUserSettings();

  const [inBoundStops, setInBoundStops] = useState<StopWithMeta[]>([]);
  const [radiusStops, setNearbyStops] = useState<StopWithMeta[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);
  const [timetableModal, setTimetableModal] = useState<TimetableData | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  // --- Custom Hooks ---

  const { dateTime, isCustomTime, resetToNow, setCustomTime } = useDateTime();

  const { nearbyDepartures, isNearbyLoading } = useNearbyDepartures(radiusStops, dateTime, repo);

  // Build routeTypes lookup covering all visible stops (in-bound + nearby)
  const [routeTypeMap, setRouteTypeMap] = useState<Map<string, RouteType[]>>(() => new Map());

  useEffect(() => {
    const allStops = [
      ...inBoundStops.map((s) => s.stop.stop_id),
      ...radiusStops.map((s) => s.stop.stop_id),
    ];
    const uniqueIds = [...new Set(allStops)];

    void Promise.all(
      uniqueIds.map(async (stopId) => {
        const result = await repo.getRouteTypesForStop(stopId);
        const routeTypes = result.success ? result.data : [3 as const];
        return [stopId, routeTypes] as const;
      }),
    ).then((entries) => {
      setRouteTypeMap(new Map(entries));
    });
  }, [inBoundStops, radiusStops, repo]);

  const {
    selectedStopId,
    selectionInfo,
    focusPosition,
    selectStop,
    selectStopById,
    deselectStop,
    selectRouteShape,
    focusStop,
    clearFocus,
  } = useSelection({
    routeTypeMap,
    nearbyDepartures,
    routeShapes,
    radiusStops,
    inBoundStops,
  });

  const { history, pushStop } = useStopHistory();

  // Find StopWithMeta by stop_id from nearby or inBound stops
  const findStopWithMeta = useCallback(
    (stopId: string) =>
      radiusStops.find((s) => s.stop.stop_id === stopId) ??
      inBoundStops.find((s) => s.stop.stop_id === stopId) ??
      null,
    [radiusStops, inBoundStops],
  );

  // Wrap selectStop to also record in history
  const handleSelectStop = useCallback(
    (stop: Stop) => {
      logger.debug(`handleSelectStop [Marker]: stopId=${stop.stop_id}, name=${stop.stop_name}`);
      selectStop(stop);
      const meta = findStopWithMeta(stop.stop_id);
      if (meta) {
        pushStop(meta, routeTypeMap.get(stop.stop_id) ?? [3]);
      }
    },
    [selectStop, pushStop, findStopWithMeta, routeTypeMap],
  );

  // Wrap selectStopById to also record in history
  const handleSelectStopById = useCallback(
    (stopId: string) => {
      logger.debug(`handleSelectStopById [BottomSheet]: stopId=${stopId}`);
      selectStopById(stopId);
      const meta = findStopWithMeta(stopId);
      if (meta) {
        pushStop(meta, routeTypeMap.get(stopId) ?? [3]);
      }
    },
    [selectStopById, pushStop, findStopWithMeta, routeTypeMap],
  );

  // Load route shapes once on mount
  useEffect(() => {
    void repo.getRouteShapes().then((result) => {
      if (result.success) {
        setRouteShapes(result.data);
      }
    });
  }, [repo]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const perfProfile = PERF_PROFILES[settings.perfMode];

  // Fetch stops when map bounds change (debounced)
  const handleBoundsChanged = useCallback(
    (bounds: Bounds, center: LatLng) => {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const { nearbyRadius, maxResults } = perfProfile.data.stops;
        void Promise.all([
          repo.getStopsInBounds(bounds, maxResults),
          repo.getStopsNearby(center, nearbyRadius, maxResults),
        ]).then(([inBoundsResult, nearbyResult]) => {
          const inBounds = inBoundsResult.success ? inBoundsResult.data : [];
          const nearby = nearbyResult.success ? nearbyResult.data : [];
          logger.info(
            'bounds changed:',
            `radius=${nearbyRadius}`,
            `nearby=${nearby.length}`,
            `inBound=${inBounds.length}`,
            `center=(${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`,
          );
          setInBoundStops(inBounds);
          setNearbyStops(nearby);
          setMapCenter(center);
          clearFocus();
        });
      }, DEBOUNCE_MS);
    },
    [repo, perfProfile, clearFocus],
  );

  const handleFetchDepartures = useCallback(
    async (stopId: string): Promise<StopWithContext | null> => {
      const meta =
        inBoundStops.find((s) => s.stop.stop_id === stopId) ??
        radiusStops.find((s) => s.stop.stop_id === stopId);
      if (!meta) {
        return null;
      }
      const [depsResult, rtResult] = await Promise.all([
        repo.getUpcomingTimetableEntries(stopId, dateTime),
        repo.getRouteTypesForStop(stopId),
      ]);
      const departures = depsResult.success ? depsResult.data : [];
      const routeTypes = rtResult.success ? rtResult.data : [3 as const];
      return {
        stop: meta.stop,
        routeTypes,
        departures,
        agencies: meta.agencies,
        routes: meta.routes,
      };
    },
    [repo, dateTime, inBoundStops, radiusStops],
  );

  const handleShowTimetable = useCallback(
    async (stopId: string, routeId: string, headsign: string) => {
      const meta = radiusStops.find((s) => s.stop.stop_id === stopId);
      if (!meta) {
        return;
      }
      const result = await repo.getFullDayDepartures(stopId, routeId, headsign, dateTime);
      const departures = result.success ? result.data : [];
      const route = meta.routes.find((r) => r.route_id === routeId);
      if (!route) {
        return;
      }
      setTimetableModal({
        type: 'route-headsign',
        stop: meta.stop,
        route,
        headsign,
        serviceDate: getServiceDay(dateTime),
        departures,
        agencies: meta.agencies,
      });
    },
    [repo, dateTime, radiusStops],
  );

  const handleShowStopTimetable = useCallback(
    async (stopId: string) => {
      const meta = radiusStops.find((s) => s.stop.stop_id === stopId);
      if (!meta) {
        return;
      }

      const result = await repo.getFullDayTimetableEntries(stopId, dateTime);
      const entries = result.success ? result.data : [];

      // Convert TimetableEntry[] to StopTimetableDeparture[] for the timetable modal.
      // The modal will be migrated to TimetableEntry in a future PR.
      const departures = entries.map((e) => ({
        minutes: e.schedule.departureMinutes,
        route: e.routeDirection.route,
        headsign: e.routeDirection.headsign,
      }));

      setTimetableModal({
        type: 'stop',
        stop: meta.stop,
        routeTypes: routeTypeMap.get(stopId) ?? [3],
        serviceDate: getServiceDay(dateTime),
        departures,
        agencies: meta.agencies,
      });
    },
    [repo, dateTime, radiusStops, routeTypeMap],
  );

  // Select + pan to a stop from history. Uses focusStop to set
  // focus position directly from stop coordinates, ensuring the map pans
  // even when the stop is outside the current viewport.
  const handleHistorySelect = useCallback(
    (stop: Stop) => {
      logger.debug(`handleHistorySelect [History]: stopId=${stop.stop_id}, name=${stop.stop_name}`);
      focusStop(stop);
      const meta = findStopWithMeta(stop.stop_id) ?? { stop, agencies: [], routes: [] };
      pushStop(meta, routeTypeMap.get(stop.stop_id) ?? [3]);
    },
    [focusStop, pushStop, findStopWithMeta, routeTypeMap],
  );

  const handleSearchSelect = useCallback(
    (stop: Stop) => {
      logger.debug(`handleSearchSelect [Search]: stopId=${stop.stop_id}, name=${stop.stop_name}`);
      focusStop(stop);
      // Search results may not be in radiusStops/inBoundStops yet;
      // wrap as StopWithMeta without distance
      const meta = findStopWithMeta(stop.stop_id) ?? { stop, agencies: [], routes: [] };
      pushStop(meta, routeTypeMap.get(stop.stop_id) ?? [3]);
      setSearchModalOpen(false);
    },
    [focusStop, pushStop, findStopWithMeta, routeTypeMap],
  );

  // --- Settings handlers ---

  const visibleStopTypes = useMemo(
    () => new Set(settings.visibleStopTypes),
    [settings.visibleStopTypes],
  );

  const filteredNearbyDepartures = useMemo(
    () => nearbyDepartures.filter((d) => d.routeTypes.some((rt) => visibleStopTypes.has(rt))),
    [nearbyDepartures, visibleStopTypes],
  );

  const handleToggleStopType = useCallback(
    (rt: number) => {
      updateSetting('visibleStopTypes', toggleInList(settings.visibleStopTypes, rt));
    },
    [settings.visibleStopTypes, updateSetting],
  );

  const handleToggleRenderMode = useCallback(() => {
    const next = nextRenderMode(settings.renderMode);
    logger.info(`renderMode: ${settings.renderMode} -> ${next}`);
    updateSetting('renderMode', next);
  }, [settings.renderMode, updateSetting]);

  const handleTogglePerfMode = useCallback(() => {
    const next = nextPerfMode(settings.perfMode);
    const profile = PERF_PROFILES[next];
    logger.info(
      `perfMode: ${settings.perfMode} -> ${next} (maxResults=${profile.data.stops.maxResults}, radius=${profile.data.stops.nearbyRadius}m)`,
    );
    updateSettings({ perfMode: next, renderMode: profile.render.defaultMode });
  }, [settings.perfMode, updateSettings]);

  const visibleRouteShapes = useMemo(
    () => new Set(settings.visibleRouteShapes),
    [settings.visibleRouteShapes],
  );

  const handleToggleBusShapes = useCallback(() => {
    updateSetting('visibleRouteShapes', toggleInList(settings.visibleRouteShapes, 3));
  }, [settings.visibleRouteShapes, updateSetting]);

  const handleToggleNonBusShapes = useCallback(() => {
    updateSetting(
      'visibleRouteShapes',
      toggleGroupInList(settings.visibleRouteShapes, [0, 1, 2, 4, 5, 6, 7]),
    );
  }, [settings.visibleRouteShapes, updateSetting]);

  const handleCycleInfoLevel = useCallback(() => {
    const next = nextInfoLevel(settings.infoLevel);
    logger.info(`infoLevel: ${settings.infoLevel} -> ${next}`);
    updateSetting('infoLevel', next);
  }, [settings.infoLevel, updateSetting]);

  const handleCycleTile = useCallback(() => {
    updateSetting('tileIndex', nextTileIndex(settings.tileIndex, TILE_SOURCES.length));
  }, [settings.tileIndex, updateSetting]);

  const handleToggleDarkMode = useCallback(() => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    logger.info(`theme: ${settings.theme} -> ${next}`);
    updateSetting('theme', next);
  }, [settings.theme, updateSetting]);

  // Sync dark class on <html> element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  return (
    <>
      <div className="relative">
        <MapView
          inBoundStops={inBoundStops}
          radiusStops={radiusStops}
          selectedStopId={selectedStopId}
          focusPosition={focusPosition}
          nearbyDepartures={nearbyDepartures}
          routeTypeMap={routeTypeMap}
          routeShapes={routeShapes}
          selectionInfo={selectionInfo}
          visibleStopTypes={visibleStopTypes}
          visibleRouteShapes={visibleRouteShapes}
          tileIndex={settings.tileIndex}
          renderMode={settings.renderMode}
          perfMode={settings.perfMode}
          infoLevel={settings.infoLevel}
          time={dateTime}
          onBoundsChanged={handleBoundsChanged}
          onStopSelected={handleSelectStop}
          onFetchDepartures={handleFetchDepartures}
          onToggleStopType={handleToggleStopType}
          onToggleBusShapes={handleToggleBusShapes}
          onToggleNonBusShapes={handleToggleNonBusShapes}
          onCycleTile={handleCycleTile}
          onToggleRenderMode={handleToggleRenderMode}
          onTogglePerfMode={handleTogglePerfMode}
          onCycleInfoLevel={handleCycleInfoLevel}
          onDeselectStop={deselectStop}
          onRouteShapeSelected={selectRouteShape}
          theme={settings.theme}
          doubleTapDrag={settings.doubleTapDrag}
          onToggleDarkMode={handleToggleDarkMode}
          onSearchClick={() => setSearchModalOpen(true)}
          onInfoClick={() => setInfoDialogOpen(true)}
          stopHistory={history}
          onHistorySelect={handleHistorySelect}
        />
        <TimeControls
          time={dateTime}
          isCustomTime={isCustomTime}
          onResetToNow={resetToNow}
          onCustomTimeSet={setCustomTime}
        />
      </div>
      <BottomSheet
        nearbyDepartures={filteredNearbyDepartures}
        selectedStopId={selectedStopId}
        isNearbyLoading={isNearbyLoading}
        time={dateTime}
        mapCenter={mapCenter}
        infoLevel={settings.infoLevel}
        onStopSelected={handleSelectStopById}
        onShowTimetable={(...args) => void handleShowTimetable(...args)}
        onShowStopTimetable={(...args) => void handleShowStopTimetable(...args)}
      />
      <StopSearchModal
        repo={repo}
        infoLevel={settings.infoLevel}
        onSelectStop={handleSearchSelect}
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
      />
      <InfoDialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen} />
      <TimetableModal
        data={timetableModal}
        time={dateTime}
        infoLevel={settings.infoLevel}
        onClose={() => setTimetableModal(null)}
      />
    </>
  );
}
