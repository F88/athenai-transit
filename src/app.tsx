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
import { useAnchors } from './hooks/use-anchors';
import { buildAnchorRefreshUpdates, type AnchorEntry } from './domain/portal/anchor';
import { LocalStorageUserDataRepository } from './repositories/local-storage-user-data-repository';
import { useRouteStops } from './hooks/use-route-stops';
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
import { createInfoLevel } from './utils/create-info-level';
import { createLogger } from './utils/logger';
import { getServiceDay } from './domain/transit/service-day';
import {
  prepareStopTimetable,
  prepareRouteHeadsignTimetable,
} from './domain/transit/timetable-filter';
import { getStopParam } from './utils/query-params';
import { MapView } from './components/map/map-view';
import { BottomSheet } from './components/bottom-sheet';
import { TimeControls } from './components/time-controls';
import { TimetableModal, type TimetableData } from './components/dialog/timetable-modal';
import { StopSearchModal } from './components/dialog/stop-search-modal';
import { InfoDialog } from './components/dialog/info-dialog';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

const logger = createLogger('App');
const DEBOUNCE_MS = 300;

export default function App() {
  const repo = useTransitRepository();
  const [userDataRepo] = useState(() => new LocalStorageUserDataRepository());
  const { settings, updateSetting, updateSettings } = useUserSettings();

  const [inBoundStops, setInBoundStops] = useState<StopWithMeta[]>([]);
  const [radiusStops, setNearbyStops] = useState<StopWithMeta[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);
  const [timetableModal, setTimetableModal] = useState<TimetableData | null>(null);
  const [hasNearbyLoaded, setHasNearbyLoaded] = useState(false);
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

  const routeStops = useRouteStops(selectionInfo?.routeIds ?? null, repo);
  // console.debug('routeStops', routeStops.length);

  const { history, pushStop } = useStopHistory();
  const {
    anchors,
    lastError: anchorError,
    clearError: clearAnchorError,
    addStop: addAnchor,
    removeStop: removeAnchor,
    batchUpdateStops: batchUpdateAnchors,
    isStopAnchor,
  } = useAnchors(userDataRepo);

  useEffect(() => {
    if (!anchorError) {
      return;
    }
    logger.warn(`anchor operation failed: ${anchorError}`);
    toast.error('アンカー更新に失敗しました', {
      description: anchorError,
      duration: 4500,
    });
    clearAnchorError();
  }, [anchorError, clearAnchorError]);

  // Refresh anchor entries with latest GTFS data on app load.
  // Runs once after repo is ready. Updates stopName, stopLat, stopLon,
  // and routeTypes if they have changed since the anchor was saved.
  const anchorRefreshDone = useRef(false);
  useEffect(() => {
    if (anchorRefreshDone.current || anchors.length === 0) {
      return;
    }
    const stopIds = new Set(anchors.map((a) => a.stopId));
    const metas = repo.getStopMetaByIds(stopIds);
    // Mark as done regardless of result. repo is fully loaded before
    // injection (all GTFS data is in memory), so metas is only empty
    // when all anchor stopIds have been removed from the dataset.
    // We must not retry on every dependency change.
    anchorRefreshDone.current = true;
    const updates = buildAnchorRefreshUpdates(anchors, metas);
    if (updates.length > 0) {
      void batchUpdateAnchors(updates);
    }
  }, [anchors, repo, batchUpdateAnchors]);

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

  // Apply ?stop= query param: select and pan to the stop after data loads.
  // Uses a ref to ensure the effect runs only once (the first time
  // the repo resolves the stop). Same pattern as handleHistorySelect —
  // focusStop sets directFocusPosition so the map pans even when the
  // stop is outside the initial viewport.
  const stopParamApplied = useRef(false);
  useEffect(() => {
    if (stopParamApplied.current) {
      return;
    }
    const stopId = getStopParam();
    if (!stopId) {
      stopParamApplied.current = true;
      return;
    }
    void repo.getStopMetaById(stopId).then((result) => {
      if (stopParamApplied.current) {
        return;
      }
      if (result.success) {
        const stop = result.data;
        logger.info(`Applying ?stop=${stopId}: ${stop.stop.stop_name}`);
        focusStop(stop.stop);
        pushStop(stop, routeTypeMap.get(stopId) ?? [3]);
        stopParamApplied.current = true;
      } else {
        logger.warn(`?stop=${stopId}: not found`);
        stopParamApplied.current = true;
      }
    });
  }, [repo, focusStop, pushStop, routeTypeMap]);

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
          setHasNearbyLoaded(true);
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
        // No limit: departure stats and verbose display need all entries.
        repo.getUpcomingTimetableEntries(stopId, dateTime),
        repo.getRouteTypesForStop(stopId),
      ]);
      const departures = depsResult.success ? depsResult.data : [];
      const isBoardableOnServiceDay = depsResult.success
        ? depsResult.meta.isBoardableOnServiceDay
        : false;
      const routeTypes = rtResult.success ? rtResult.data : [3 as const];
      return {
        stop: meta.stop,
        routeTypes,
        departures,
        isBoardableOnServiceDay,
        agencies: meta.agencies,
        routes: meta.routes,
      };
    },
    [repo, dateTime, inBoundStops, radiusStops],
  );

  const infoLevelFlags = useMemo(() => createInfoLevel(settings.infoLevel), [settings.infoLevel]);

  /** Fetch full-day timetable entries for a stop (no filtering). */
  const fetchTimetableEntries = useCallback(
    async (stopId: string) => {
      const result = await repo.getFullDayTimetableEntries(stopId, dateTime);
      const allEntries = result.success ? result.data : [];
      const isBoardableOnServiceDay = result.success ? result.meta.isBoardableOnServiceDay : false;
      return { allEntries, isBoardableOnServiceDay };
    },
    [repo, dateTime],
  );

  const handleShowTimetable = useCallback(
    async (stopId: string, routeId: string, headsign: string) => {
      const meta = radiusStops.find((s) => s.stop.stop_id === stopId);
      if (!meta) {
        return;
      }
      const route = meta.routes.find((r) => r.route_id === routeId);
      if (!route) {
        return;
      }
      const { allEntries, isBoardableOnServiceDay } = await fetchTimetableEntries(stopId);
      const { entries, omitted } = prepareRouteHeadsignTimetable(
        allEntries,
        routeId,
        headsign,
        infoLevelFlags.isDetailedEnabled,
      );
      logger.debug(
        `timetable(route-headsign) [${settings.infoLevel}]: ${stopId} ${routeId} "${headsign}" → entries=${entries.length} omitted.terminal=${omitted.terminal} total=${allEntries.length} isBoardableOnServiceDay=${isBoardableOnServiceDay}`,
      );
      setTimetableModal({
        type: 'route-headsign',
        stop: meta.stop,
        route,
        headsign,
        serviceDate: getServiceDay(dateTime),
        timetableEntries: entries,
        omitted,
        isBoardableOnServiceDay,
        agencies: meta.agencies,
      });
    },
    [dateTime, radiusStops, infoLevelFlags, fetchTimetableEntries, settings.infoLevel],
  );

  const handleShowStopTimetable = useCallback(
    async (stopId: string) => {
      const meta = radiusStops.find((s) => s.stop.stop_id === stopId);
      if (!meta) {
        return;
      }
      const { allEntries, isBoardableOnServiceDay } = await fetchTimetableEntries(stopId);
      const { entries, omitted } = prepareStopTimetable(
        allEntries,
        infoLevelFlags.isDetailedEnabled,
      );
      logger.debug(
        `timetable(stop) [${settings.infoLevel}]: ${stopId} → entries=${entries.length} omitted.terminal=${omitted.terminal} total=${allEntries.length} isBoardableOnServiceDay=${isBoardableOnServiceDay}`,
      );
      setTimetableModal({
        type: 'stop',
        stop: meta.stop,
        routeTypes: routeTypeMap.get(stopId) ?? [3],
        serviceDate: getServiceDay(dateTime),
        timetableEntries: entries,
        omitted,
        isBoardableOnServiceDay,
        agencies: meta.agencies,
      });
    },
    [
      dateTime,
      radiusStops,
      routeTypeMap,
      infoLevelFlags,
      fetchTimetableEntries,
      settings.infoLevel,
    ],
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

  // Anchor stop_id set for efficient lookup in BottomSheet
  const anchorIds = useMemo(() => new Set(anchors.map((a) => a.stopId)), [anchors]);

  // Toggle anchor (bookmark) status for a stop
  const handleToggleAnchor = useCallback(
    (stopId: string) => {
      if (isStopAnchor(stopId)) {
        logger.debug(`handleToggleAnchor: removing stopId=${stopId}`);
        void removeAnchor(stopId);
      } else {
        const meta = findStopWithMeta(stopId);
        if (meta) {
          logger.debug(`handleToggleAnchor: adding stopId=${stopId}, name=${meta.stop.stop_name}`);
          void addAnchor({
            stopId: meta.stop.stop_id,
            stopName: meta.stop.stop_name,
            stopLat: meta.stop.stop_lat,
            stopLon: meta.stop.stop_lon,
            routeTypes: routeTypeMap.get(stopId) ?? [3],
          });
        }
      }
    },
    [isStopAnchor, removeAnchor, addAnchor, findStopWithMeta, routeTypeMap],
  );

  // Select + pan to a stop from Portal dropdown
  const handlePortalSelect = useCallback(
    (entry: AnchorEntry) => {
      logger.debug(`handlePortalSelect [Portal]: stopId=${entry.stopId}, name=${entry.stopName}`);
      // Build a minimal Stop from AnchorEntry for map pan
      const stop: Stop = {
        stop_id: entry.stopId,
        stop_name: entry.stopName,
        stop_names: {},
        stop_lat: entry.stopLat,
        stop_lon: entry.stopLon,
        location_type: 0,
        agency_id: '',
      };
      focusStop(stop);
      // Also record in history
      const meta = findStopWithMeta(entry.stopId) ?? { stop, agencies: [], routes: [] };
      pushStop(meta, entry.routeTypes);
    },
    [focusStop, findStopWithMeta, pushStop],
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
          routeStops={routeStops}
          // routeStops={[]}
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
          anchors={anchors}
          onPortalSelect={handlePortalSelect}
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
        hasNearbyLoaded={hasNearbyLoaded}
        dataConfig={perfProfile.data}
        time={dateTime}
        mapCenter={mapCenter}
        infoLevel={settings.infoLevel}
        anchorIds={anchorIds}
        onStopSelected={handleSelectStopById}
        onShowTimetable={(...args) => void handleShowTimetable(...args)}
        onShowStopTimetable={(...args) => void handleShowStopTimetable(...args)}
        onToggleAnchor={handleToggleAnchor}
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
      <Toaster theme={settings.theme} position="top-center" closeButton richColors expand={false} />
    </>
  );
}
