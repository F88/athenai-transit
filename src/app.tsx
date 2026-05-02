import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { InfoDialog } from './components/dialog/info-dialog';
import { ShortcutHelpDialog } from './components/dialog/shortcut-help-dialog';
import { StopSearchDialog } from './components/dialog/stop-search-dialog';
import { TimetableModal } from './components/dialog/timetable-modal';
import { TripInspectionDialog } from './components/dialog/trip-inspection-dialog';
import { MapBottomSheetLayout } from './components/map-bottom-sheet-layout';
import { TimeControls } from './components/time-controls';
import { Toaster } from './components/ui/sonner';
import { PERF_PROFILES } from './config/perf-profiles';
import { SUPPORTED_LANGS } from './config/supported-langs';
import { TILE_SOURCES } from './config/tile-sources';
import { DEFAULT_TIMEZONE, resolveAgencyLang } from './config/transit-defaults';
import { buildAnchorRefreshUpdates, type AnchorEntry } from './domain/portal/anchor';
import { formatDateKey } from './domain/transit/calendar-utils';
import { computeStopsCounts } from './domain/transit/compute-stops-counts';
import { getStopDisplayNames } from './domain/transit/get-stop-display-names';
import { resolveLangChain, type LangChain } from './domain/transit/i18n/resolve-lang-chain';
import { resolveStopRouteTypes } from './domain/transit/resolve-stop-route-types';
import { getServiceDay, getServiceDayMinutes } from './domain/transit/service-day';
import {
  applyStopEventAttributeTogglesToStops,
  omitStopsWithoutStopTimes,
} from './domain/transit/timetable-filter';
import { getStopServiceState, getTimetableEntriesState } from './domain/transit/timetable-utils';
import { useAnchors } from './hooks/use-anchors';
import { useDateTime } from './hooks/use-date-time';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useNearbyStopTimes } from './hooks/use-nearby-stop-times';
import { useRouteStops } from './hooks/use-route-stops';
import { useSelection } from './hooks/use-selection';
import { useStopHistory } from './hooks/use-stop-history';
import { useTimetable } from './hooks/use-timetable';
import { useTransitRepository } from './hooks/use-transit-repository';
import { useTripInspection } from './hooks/use-trip-inspection';
import { useUserSettings } from './hooks/use-user-settings';
import i18n from './i18n';
import { createLogger } from './lib/logger';
import { getStopParam } from './lib/query-params';
import type { LoadResult } from './repositories/athenai-repository';
import { LocalStorageUserDataRepository } from './repositories/local-storage-user-data-repository';
import type { Bounds, LatLng, RouteShape } from './types/app/map';
import type { StopsCounts } from './types/app/stop';
import type { AppRouteTypeValue, Stop, TimetableEntriesState } from './types/app/transit';
import type {
  StopWithContext,
  StopWithMeta,
  TripInspectionTarget,
} from './types/app/transit-composed';
import { formatDateParts } from './utils/datetime';
import { toggleGroupInList } from './utils/list-toggle';
import { routeTypeGroup } from './utils/route-type-category';
import { routeTypesEmoji } from './utils/route-type-emoji';
import {
  nextInfoLevel,
  nextLang,
  nextPerfMode,
  nextRenderMode,
  nextTileIndex,
} from './utils/settings-cycle';
const logger = createLogger('App');
const DEBOUNCE_MS = 300;
const LATE_NIGHT_THRESHOLD_MINUTES = 22 * 60;

interface AppProps {
  /**
   * Source loading result from startup. Used to surface a toast when
   * one or more data sources failed to load (e.g. bundle_version
   * mismatch during a deploy window). See Issue #128.
   */
  loadResult: LoadResult;
}

export default function App({ loadResult }: AppProps) {
  const { t } = useTranslation();
  const repo = useTransitRepository();
  const [userDataRepo] = useState(() => new LocalStorageUserDataRepository());
  const { settings, updateSetting, updateSettings } = useUserSettings();
  const { dateTime, isCustomTime, resetToNow, setCustomTime } = useDateTime();

  // Sync i18next language with user setting.
  useEffect(() => {
    void i18n.changeLanguage(settings.lang);
  }, [settings.lang]);

  // Surface data source loading failures via toast (Issue #128).
  // Without this, all-source failures (e.g. bundle_version mismatch
  // during a deploy window) leave the UI as an empty map with no
  // visible indication that data is missing.
  // Stable `id` dedupes across StrictMode double-mount and language
  // changes — the same failure produces a single toast whose label
  // updates in place when the language switches.
  useEffect(() => {
    if (loadResult.failed.length === 0) {
      return;
    }
    const prefixes = loadResult.failed.map((f) => f.prefix).join(', ');
    toast.error(t('dataLoad.failed'), {
      id: 'data-load-failed',
      description: `${loadResult.failed.length} source(s): ${prefixes}`,
      duration: Infinity,
    });
  }, [loadResult, t]);

  // Resolve language fallback chain once when lang changes.
  // Components receive this as dataLang (ordered priority list for
  // GTFS/ODPT data translation resolution).
  const langChain: LangChain = useMemo(
    () => resolveLangChain(settings.lang, SUPPORTED_LANGS),
    [settings.lang],
  );

  useEffect(() => {
    logger.debug(`LangChain: ${settings.lang} → [${langChain.join(' → ')}]`);
  }, [settings.lang, langChain]);

  const [inBoundStops, setInBoundStops] = useState<StopWithMeta[]>([]);
  const [radiusStops, setNearbyStops] = useState<StopWithMeta[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);
  const [hasNearbyLoaded, setHasNearbyLoaded] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const {
    tripInspectionSnapshot,
    tripInspectionTargets,
    currentTripInspectionTargetIndex,
    openTripInspectionFromTarget,
    openTripInspectionFromStopId,
    openPreviousTripInspection,
    openNextTripInspection,
    closeTripInspection,
  } = useTripInspection(repo);
  const { timetableData, openRouteHeadsignTimetable, openStopTimetable, closeTimetable } =
    useTimetable(repo);

  // Global keyboard shortcuts. Suppressed while any of the four primary
  // modals owned by app.tsx is open (search / info / help / timetable),
  // so the shortcut cannot re-open the same modal it is currently inside.
  // Lower-frequency dialogs whose state lives in their own components
  // (e.g. TimeSettingDialog) are intentionally NOT tracked here: Radix
  // Dialog handles nested dialog stacking (focus trap / scroll lock /
  // Escape order) correctly, so allowing the shortcut to layer a dialog
  // on top of one of those is acceptable. Add a new state to this list
  // only when a new modal becomes a primary entry point.
  useKeyboardShortcuts({
    enabled:
      !searchModalOpen &&
      !infoDialogOpen &&
      !shortcutHelpOpen &&
      timetableData === null &&
      tripInspectionSnapshot === null,
    handlers: {
      onOpenSearch: () => setSearchModalOpen(true),
      onOpenHelp: () => setShortcutHelpOpen(true),
    },
  });

  // --- Custom Hooks ---

  const { stopTimes: nearbyStopTimes, isNearbyLoading } = useNearbyStopTimes(
    radiusStops,
    dateTime,
    repo,
  );

  // Build routeTypes lookup covering all visible stops (in-bound + nearby)
  const [routeTypeMap, setRouteTypeMap] = useState<Map<string, AppRouteTypeValue[]>>(
    () => new Map(),
  );

  useEffect(() => {
    const allStops = [
      ...inBoundStops.map((s) => s.stop.stop_id),
      ...radiusStops.map((s) => s.stop.stop_id),
    ];
    const uniqueIds = [...new Set(allStops)];

    void Promise.all(
      uniqueIds.map(async (stopId) => {
        const result = await repo.getRouteTypesForStop(stopId);
        const routeTypes = result.success ? result.data : [-1 as const];
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
    stopTimes: nearbyStopTimes,
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
    toast.error(t('anchor.anchorUpdateFailed'), {
      description: anchorError,
      duration: 4500,
    });
    clearAnchorError();
  }, [anchorError, clearAnchorError, t]);

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

  // Viewport-limited StopWithMeta lookup.
  //
  // ⚠️ This callback only searches `radiusStops` (~1 km from the user)
  // and `inBoundStops` (current map viewport). It is intentionally
  // narrow because it sits on the hot path of map interaction and is
  // re-created whenever those collections change.
  //
  // Use this ONLY for stops that are by definition near the user at
  // the moment of the call:
  //   - the just-clicked map marker (radiusStops by construction)
  //   - the currently selected stop being re-resolved during pan
  //   - any other case where the caller already has the stop on screen
  //
  // Do NOT use this for persistent / long-lived / arbitrary stop IDs
  // such as anchors (bookmarks), history entries, stops belonging to
  // a selected route, or a `stop_id` from the URL `?stop=` parameter
  // — `?stop=` is resolved via `repo.getStopMetaById(stopId)` in the
  // effect below precisely because it can target a stop anywhere in
  // the dataset, not just inside the viewport. Those IDs may point
  // to stops far outside the viewport, so this lookup will silently
  // return null and the caller will fall back to a stale snapshot.
  // For those cases call `repo.getStopMetaByIds(...)` (full-dataset
  // indexed lookup) instead — the anchor display lookup below
  // (`anchorStopMetaMap`) is the canonical example.
  //
  // See `DEVELOPMENT.md > Stop ID lookup の選び方` for the rule and
  // historical context (route stops and anchor i18n both regressed
  // by reaching for this helper instead of `getStopMetaByIds`).
  const findStopWithMeta = useCallback(
    (stopId: string) =>
      radiusStops.find((s) => s.stop.stop_id === stopId) ??
      inBoundStops.find((s) => s.stop.stop_id === stopId) ??
      null,
    [radiusStops, inBoundStops],
  );

  // Pre-resolved StopWithMeta map for every anchored stop_id.
  // Built from the repository's full dataset (not just the visible
  // viewport) so that `Portals` can look up the latest translated
  // display name for any anchor regardless of where it is on the map.
  const anchorStopMetaMap = useMemo(() => {
    if (anchors.length === 0) {
      return new Map<string, StopWithMeta>();
    }
    const stopIds = new Set(anchors.map((a) => a.stopId));
    const metas = repo.getStopMetaByIds(stopIds);
    return new Map(metas.map((m) => [m.stop.stop_id, m]));
  }, [anchors, repo]);

  // Lookup an anchored stop's current StopWithMeta. Returns null
  // when the anchor's stop_id is not present in the active dataset
  // (e.g. cross-source anchor in mock mode, or a stop deleted from
  // GTFS); callers should fall back to the AnchorEntry snapshot.
  const lookupAnchorStopMeta = useCallback(
    (stopId: string): StopWithMeta | null => anchorStopMetaMap.get(stopId) ?? null,
    [anchorStopMetaMap],
  );

  // Wrap selectStop to also record in history
  const handleSelectStop = useCallback(
    (stop: Stop) => {
      logger.debug(`handleSelectStop [Marker]: stopId=${stop.stop_id}, name=${stop.stop_name}`);
      selectStop(stop);
      const meta = findStopWithMeta(stop.stop_id);
      if (meta) {
        pushStop(
          meta,
          resolveStopRouteTypes({
            stopId: stop.stop_id,
            routeTypeMap,
            routes: meta.routes,
            unknownPolicy: 'include-unknown',
          }),
        );
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
        pushStop(
          meta,
          resolveStopRouteTypes({
            stopId,
            routeTypeMap,
            routes: meta.routes,
            unknownPolicy: 'include-unknown',
          }),
        );
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
        pushStop(
          stop,
          resolveStopRouteTypes({
            stopId,
            routeTypeMap,
            routes: stop.routes,
            unknownPolicy: 'include-unknown',
          }),
        );
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

  const handleFetchStopTimes = useCallback(
    async (stopId: string): Promise<StopWithContext | null> => {
      const meta =
        inBoundStops.find((s) => s.stop.stop_id === stopId) ??
        radiusStops.find((s) => s.stop.stop_id === stopId);
      if (!meta) {
        return null;
      }
      const [depsResult, rtResult] = await Promise.all([
        // No limit: stop-time stats and verbose display need all entries.
        repo.getUpcomingTimetableEntries(stopId, dateTime),
        repo.getRouteTypesForStop(stopId),
      ]);
      const stopTimes = depsResult.success ? depsResult.data : [];
      const stopServiceState = depsResult.success
        ? getStopServiceState(depsResult.meta)
        : ('no-service' as const);
      const routeTypes = rtResult.success ? rtResult.data : [-1 as const];
      return {
        stop: meta.stop,
        routeTypes,
        stopTimes,
        stopServiceState,
        agencies: meta.agencies,
        routes: meta.routes,
      };
    },
    [repo, dateTime, inBoundStops, radiusStops],
  );

  const handleShowTimetable = useCallback(
    (stopId: string, routeId: string, headsign: string) => {
      void openRouteHeadsignTimetable({
        stopId,
        routeId,
        headsign,
        dateTime,
      });
    },
    [dateTime, openRouteHeadsignTimetable],
  );

  const handleShowStopTimetable = useCallback(
    (stopId: string) => {
      void openStopTimetable({
        stopId,
        dateTime,
      });
    },
    [dateTime, openStopTimetable],
  );

  const handleOpenTripInspectionByStopId = useCallback(
    (stopId: string) => {
      const serviceDate = getServiceDay(dateTime);

      void openTripInspectionFromStopId({
        stopId,
        now: dateTime,
        serviceDate,
      }).then((status) => {
        if (status.status === 'no-data') {
          const messageKey =
            status.reason === 'no-stop-data'
              ? 'tripInspection.messages.noStopData'
              : status.reason === 'no-service-on-this-day'
                ? 'tripInspection.messages.noServiceOnThisDay'
                : 'tripInspection.messages.noData';
          toast.warning(t(messageKey));
          return;
        }

        if (status.status === 'error') {
          toast.error(t('tripInspection.messages.openFailed'));
        }
      });
    },
    [dateTime, openTripInspectionFromStopId, t],
  );

  const handleInspectTrip = useCallback(
    (target: TripInspectionTarget) => {
      void openTripInspectionFromTarget(target).then((status) => {
        if (status.status === 'no-data') {
          const messageKey =
            status.reason === 'no-stop-data'
              ? 'tripInspection.messages.noStopData'
              : status.reason === 'no-service-on-this-day'
                ? 'tripInspection.messages.noServiceOnThisDay'
                : 'tripInspection.messages.noData';
          toast.warning(t(messageKey));
          return;
        }

        if (status.status === 'error') {
          toast.error(t('tripInspection.messages.openFailed'));
        }
      });
    },
    [openTripInspectionFromTarget, t],
  );

  const handleTripInspectionOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeTripInspection();
      }
    },
    [closeTripInspection],
  );

  // Select + pan to a stop from history. Uses focusStop to set
  // focus position directly from stop coordinates, ensuring the map pans
  // even when the stop is outside the current viewport.
  const handleHistorySelect = useCallback(
    (stop: Stop, routeTypes: AppRouteTypeValue[]) => {
      logger.debug(`handleHistorySelect [History]: stopId=${stop.stop_id}, name=${stop.stop_name}`);
      focusStop(stop);
      const meta = findStopWithMeta(stop.stop_id) ?? { stop, agencies: [], routes: [] };
      pushStop(meta, routeTypes);
    },
    [focusStop, pushStop, findStopWithMeta],
  );

  // Anchor stop_id set for efficient lookup in BottomSheet
  const anchorIds = useMemo(() => new Set(anchors.map((a) => a.stopId)), [anchors]);

  // Toggle anchor (bookmark) status for a stop
  const handleToggleAnchorByStopId = useCallback(
    (stopId: string) => {
      if (isStopAnchor(stopId)) {
        // Capture anchor data before removal (entry won't exist after removeAnchor).
        // Resolve display name from current GTFS so the toast follows
        // the user's current language even though the stored entry
        // only has a snapshot stopName. We use `lookupAnchorStopMeta`
        // (full-dataset scan over the anchor set) rather than
        // `findStopWithMeta` (viewport-only) here because the stop_id
        // is a persistent anchor reference and may, in some future UI
        // path, be triggered for an anchor that is not currently in
        // radiusStops / inBoundStops. See `DEVELOPMENT.md > Stop ID
        // lookup の選び方` for the rule.
        const anchor = anchors.find((a) => a.stopId === stopId);
        const meta = lookupAnchorStopMeta(stopId);
        const stopName = meta
          ? getStopDisplayNames(
              meta.stop,
              langChain,
              resolveAgencyLang(meta.agencies, meta.stop.agency_id),
            ).name ||
            anchor?.stopName ||
            stopId
          : (anchor?.stopName ?? stopId);
        logger.debug(`handleToggleAnchor: removing stopId=${stopId}`);
        void removeAnchor(stopId).then((result) => {
          if (result.success) {
            const prefix = anchor?.routeTypes ? `${routeTypesEmoji(anchor.routeTypes)} ` : '';
            toast.warning(t('anchor.removed'), { description: `${prefix}${stopName}` });
          }
        });
      } else {
        void Promise.all([repo.getStopMetaById(stopId), repo.getRouteTypesForStop(stopId)]).then(
          ([metaResult, routeTypesResult]) => {
            if (!metaResult.success) {
              logger.warn('handleToggleAnchorByStopId: stop metadata lookup failed', {
                stopId,
                error: metaResult.error,
              });
              return;
            }

            const meta = metaResult.data;
            const routeTypes = routeTypesResult.success ? routeTypesResult.data : [-1 as const];
            const displayName =
              getStopDisplayNames(
                meta.stop,
                langChain,
                resolveAgencyLang(meta.agencies, meta.stop.agency_id),
              ).name || meta.stop.stop_name;
            logger.debug(
              `handleToggleAnchorByStopId: adding stopId=${stopId}, name=${displayName}`,
            );
            void addAnchor({
              stopId: meta.stop.stop_id,
              stopName: meta.stop.stop_name,
              stopLat: meta.stop.stop_lat,
              stopLon: meta.stop.stop_lon,
              routeTypes,
            }).then((result) => {
              if (result.success) {
                toast.success(t('anchor.added'), {
                  description: `${routeTypesEmoji(routeTypes)} ${displayName}`,
                });
              }
            });
          },
        );
      }
    },
    [isStopAnchor, anchors, removeAnchor, addAnchor, repo, lookupAnchorStopMeta, langChain, t],
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
    (stop: Stop, routeTypes: AppRouteTypeValue[]) => {
      logger.debug(`handleSearchSelect [Search]: stopId=${stop.stop_id}, name=${stop.stop_name}`);
      focusStop(stop);
      setSearchModalOpen(false);
      // SearchDialog already resolved routeTypes from its own routeTypeMap,
      // so we can use them directly without re-resolving.
      const meta = findStopWithMeta(stop.stop_id) ?? { stop, agencies: [], routes: [] };
      pushStop(meta, routeTypes);
    },
    [focusStop, pushStop, findStopWithMeta],
  );

  // --- App-wide filter state (shared across surfaces) ---

  // Stop-event-level filter toggles. Lifted to app.tsx so MapView,
  // BottomSheet, TripInspectionDialog, and TimetableModal can share the
  // same data state (= "what kind of trips the user is currently
  // interested in"). The toggles control entry-level filtering through
  // `applyStopEventAttributeToggles`; each surface decides how to apply
  // it given its own data shape.
  const [showOriginOnly, setShowOriginOnly] = useState(false);
  const [showBoardableOnly, setShowBoardableOnly] = useState(false);
  const isLateNight = getServiceDayMinutes(dateTime) >= LATE_NIGHT_THRESHOLD_MINUTES;
  const [omitEmptyStopsOverride, setOmitEmptyStopsOverride] = useState<boolean | null>(null);
  const omitEmptyStops = omitEmptyStopsOverride ?? isLateNight;
  const isOmitEmptyStopsForced = showOriginOnly || showBoardableOnly;
  const effectiveOmitEmptyStops = omitEmptyStops || isOmitEmptyStopsForced;

  const toggleShowOriginOnly = useCallback(() => {
    setShowOriginOnly((prev) => !prev);
  }, []);
  const toggleShowBoardableOnly = useCallback(() => {
    setShowBoardableOnly((prev) => !prev);
  }, []);
  const toggleOmitEmptyStops = useCallback(() => {
    if (isOmitEmptyStopsForced) {
      return;
    }
    setOmitEmptyStopsOverride((prev) => !(prev ?? isLateNight));
  }, [isLateNight, isOmitEmptyStopsForced]);

  // Bundle the app-wide filter state + toggle handlers into a single
  // memoized object so consumers (BottomSheet / TimetableModal /
  // future MapView etc.) receive a stable reference between toggles.
  const globalFilter = useMemo(
    () => ({
      showOriginOnly,
      showBoardableOnly,
      omitEmptyStops: effectiveOmitEmptyStops,
      isOmitEmptyStopsForced,
      onToggleShowOriginOnly: toggleShowOriginOnly,
      onToggleShowBoardableOnly: toggleShowBoardableOnly,
      onToggleOmitEmptyStops: toggleOmitEmptyStops,
    }),
    [
      showOriginOnly,
      showBoardableOnly,
      effectiveOmitEmptyStops,
      isOmitEmptyStopsForced,
      toggleShowOriginOnly,
      toggleShowBoardableOnly,
      toggleOmitEmptyStops,
    ],
  );

  // logger.debug('GlobalFilter', globalFilter);

  // --- Settings handlers ---

  const enabledRouteTypes = useMemo(
    () => new Set(settings.visibleStopTypes),
    [settings.visibleStopTypes],
  );

  const routeTypesFilteredNearbyStopTimes = useMemo(
    () => nearbyStopTimes.filter((d) => d.routeTypes.some((rt) => enabledRouteTypes.has(rt))),
    [nearbyStopTimes, enabledRouteTypes],
  );

  // Apply origin / boardable filter (= app-wide `globalFilter` toggles)
  // per-stop while preserving the outer stop list. Empty-stop omission
  // happens in the next memo so the two responsibilities stay distinct.
  const stopEventAttributesAppliedNearbyStopTimes = useMemo(
    () =>
      applyStopEventAttributeTogglesToStops(routeTypesFilteredNearbyStopTimes, {
        showOriginOnly,
        showBoardableOnly,
      }),
    [routeTypesFilteredNearbyStopTimes, showOriginOnly, showBoardableOnly],
  );

  // Apply the app-wide empty-stop visibility policy on top of the
  // entry-level filter result. When omitted, only non-empty stops are
  // rendered; when disabled, empty stops remain visible for placeholder UI.
  const stopEventAttributesNonEmptyNearbyStopTimes = useMemo(() => {
    return effectiveOmitEmptyStops
      ? omitStopsWithoutStopTimes(stopEventAttributesAppliedNearbyStopTimes)
      : stopEventAttributesAppliedNearbyStopTimes;
  }, [effectiveOmitEmptyStops, stopEventAttributesAppliedNearbyStopTimes]);

  // Per-stop pre-`globalFilter` `TimetableEntriesState` map. The base
  // is intentionally `routeTypesFilteredNearbyStopTimes` (= settings
  // filter applied, origin/boardable toggles NOT yet applied), so
  // consumers can distinguish `'filter-hidden'` (entries existed
  // pre-`globalFilter`, removed by user toggles) from `'no-service'`
  // (no entries at all). Computing this against the post-`globalFilter`
  // `stopEventAttributesFilteredNearbyStopTimes` would collapse those
  // two states.
  const timetableEntriesStateByStopId = useMemo(() => {
    const map = new Map<string, TimetableEntriesState>();
    for (const swc of routeTypesFilteredNearbyStopTimes) {
      map.set(swc.stop.stop_id, getTimetableEntriesState(swc.stopTimes));
    }
    return map;
  }, [routeTypesFilteredNearbyStopTimes]);

  const nearbyStopsCounts: StopsCounts = useMemo(
    () => computeStopsCounts(routeTypesFilteredNearbyStopTimes),
    [routeTypesFilteredNearbyStopTimes],
  );

  const filteredNearbyStopsCounts: StopsCounts = useMemo(
    () => computeStopsCounts(stopEventAttributesNonEmptyNearbyStopTimes),
    [stopEventAttributesNonEmptyNearbyStopTimes],
  );

  const handleToggleStopType = useCallback(
    (rt: number) => {
      updateSetting(
        'visibleStopTypes',
        toggleGroupInList(settings.visibleStopTypes, routeTypeGroup(rt)),
      );
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

  // Derive service day from dateTime. serviceDay itself recomputes every
  // 15-second tick (new Date), but serviceDayKey (string) only changes at
  // the 03:00 boundary. resolveRouteFreq depends on serviceDayKey, so
  // shapes re-render is skipped for the vast majority of ticks.
  const serviceDay = useMemo(() => getServiceDay(dateTime), [dateTime]);
  const serviceDayKey = formatDateKey(serviceDay);
  const stableServiceDay = useMemo(() => {
    // `serviceDayKey` is `YYYYMMDD` (no separators) per `formatDateKey`,
    // so use fixed-position slicing instead of `split('-')`.
    const year = parseInt(serviceDayKey.slice(0, 4), 10);
    const month = parseInt(serviceDayKey.slice(4, 6), 10);
    const day = parseInt(serviceDayKey.slice(6, 8), 10);
    return new Date(year, month - 1, day);
  }, [serviceDayKey]);
  const serviceDayWeekday = useMemo(() => {
    return stableServiceDay.getDay();
  }, [stableServiceDay]);

  useEffect(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Do NOT parse serviceDayKey via new Date('YYYY-MM-DD') here — JS parses
    // date-only strings as UTC, which yields wrong getDay() in non-UTC timezones.
    logger.info(`Service day: ${serviceDayKey} (${dayNames[serviceDayWeekday]})`);
  }, [serviceDayKey, serviceDayWeekday]);

  const resolveRouteFreq = useCallback(
    (routeId: string) => repo.resolveRouteFreq(routeId, stableServiceDay),
    [repo, stableServiceDay],
  );

  const handleToggleBusShapes = useCallback(() => {
    updateSetting('visibleRouteShapes', toggleGroupInList(settings.visibleRouteShapes, [3, 11]));
  }, [settings.visibleRouteShapes, updateSetting]);

  const handleToggleNonBusShapes = useCallback(() => {
    updateSetting(
      'visibleRouteShapes',
      toggleGroupInList(settings.visibleRouteShapes, [-1, 0, 1, 2, 4, 5, 6, 7, 12]),
    );
  }, [settings.visibleRouteShapes, updateSetting]);

  const handleCycleInfoLevel = useCallback(() => {
    const next = nextInfoLevel(settings.infoLevel);
    logger.info(`infoLevel: ${settings.infoLevel} -> ${next}`);
    updateSetting('infoLevel', next);
  }, [settings.infoLevel, updateSetting]);

  const handleCycleTile = useCallback(() => {
    const prevTileIndex = settings.tileIndex;
    const nextTile = nextTileIndex(prevTileIndex, TILE_SOURCES.length);
    const prevTileLabel =
      prevTileIndex == null
        ? 'none'
        : (TILE_SOURCES[prevTileIndex]?.label ?? `unknown(${String(prevTileIndex)})`);
    const nextTileLabel =
      nextTile == null ? 'none' : (TILE_SOURCES[nextTile]?.label ?? `unknown(${String(nextTile)})`);
    logger.debug(
      `tile: ${prevTileLabel} (${String(prevTileIndex)}) -> ${nextTileLabel} (${String(nextTile)})`,
    );
    updateSetting('tileIndex', nextTile);
  }, [settings.tileIndex, updateSetting]);

  const handleToggleDarkMode = useCallback(() => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    logger.info(`theme: ${settings.theme} -> ${next}`);
    updateSetting('theme', next);
  }, [settings.theme, updateSetting]);

  const handleCycleLang = useCallback(() => {
    const next = nextLang(settings.lang);
    const nextLangEntry = SUPPORTED_LANGS.find((l) => l.code === next);
    const now = new Date();
    const { dateText, dayLabel } = formatDateParts(now, next, DEFAULT_TIMEZONE, { showYear: true });
    logger.info(
      `lang: ${settings.lang} -> ${next} (${nextLangEntry?.label ?? 'unknown'}) date: ${dateText} (${dayLabel})`,
    );
    updateSetting('lang', next);
  }, [settings.lang, updateSetting]);

  // Sync dark class on <html> element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  return (
    <>
      <MapBottomSheetLayout
        mapViewProps={{
          inBoundStops,
          radiusStops,
          selectedStopId,
          focusPosition,
          stopTimes: stopEventAttributesNonEmptyNearbyStopTimes,
          routeTypeMap,
          routeShapes,
          selectionInfo,
          routeStops,
          visibleStopTypes: enabledRouteTypes,
          visibleRouteShapes,
          tileIndex: settings.tileIndex,
          renderMode: settings.renderMode,
          perfMode: settings.perfMode,
          infoLevel: settings.infoLevel,
          dataLang: langChain,
          time: dateTime,
          onBoundsChanged: handleBoundsChanged,
          onStopSelected: handleSelectStop,
          onFetchStopTimes: handleFetchStopTimes,
          onToggleStopType: handleToggleStopType,
          onToggleBusShapes: handleToggleBusShapes,
          onToggleNonBusShapes: handleToggleNonBusShapes,
          onCycleTile: handleCycleTile,
          onToggleRenderMode: handleToggleRenderMode,
          onTogglePerfMode: handleTogglePerfMode,
          onCycleInfoLevel: handleCycleInfoLevel,
          onDeselectStop: deselectStop,
          onRouteShapeSelected: selectRouteShape,
          resolveRouteFreq,
          theme: settings.theme,
          doubleTapDrag: settings.doubleTapDrag,
          onToggleDarkMode: handleToggleDarkMode,
          onCycleLang: handleCycleLang,
          onSearchClick: () => setSearchModalOpen(true),
          onInfoClick: () => setInfoDialogOpen(true),
          stopHistory: history,
          onHistorySelect: handleHistorySelect,
          anchors,
          onPortalSelect: handlePortalSelect,
          lookupAnchorStopMeta,
        }}
        bottomSheetProps={{
          stopTimes: stopEventAttributesNonEmptyNearbyStopTimes,
          timetableEntriesStateByStopId,
          selectedStopId,
          isNearbyLoading,
          hasNearbyLoaded,
          dataConfig: perfProfile.data,
          time: dateTime,
          mapCenter,
          infoLevel: settings.infoLevel,
          dataLangs: langChain,
          anchorIds,
          onStopSelected: handleSelectStopById,
          onShowTimetable: handleShowTimetable,
          onShowStopTimetable: handleShowStopTimetable,
          onToggleAnchor: handleToggleAnchorByStopId,
          onOpenTripInspectionByStopId: handleOpenTripInspectionByStopId,
          onInspectTrip: handleInspectTrip,
        }}
        globalFilter={globalFilter}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
        mapOverlay={
          <TimeControls
            time={dateTime}
            isCustomTime={isCustomTime}
            onResetToNow={resetToNow}
            onCustomTimeSet={setCustomTime}
          />
        }
      />
      <StopSearchDialog
        repo={repo}
        infoLevel={settings.infoLevel}
        dataLang={langChain}
        isStopAnchor={isStopAnchor}
        onSelectStop={handleSearchSelect}
        onToggleAnchor={handleToggleAnchorByStopId}
        onShowStopTimetable={handleShowStopTimetable}
        onOpenTripInspectionByStopId={handleOpenTripInspectionByStopId}
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
      />
      <InfoDialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen} />
      <ShortcutHelpDialog open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />
      <TripInspectionDialog
        open={tripInspectionSnapshot !== null}
        snapshot={tripInspectionSnapshot}
        tripInspectionTargets={tripInspectionTargets}
        currentTripInspectionTargetIndex={currentTripInspectionTargetIndex}
        now={dateTime}
        infoLevel={settings.infoLevel}
        dataLangs={langChain}
        onOpenPreviousTrip={openPreviousTripInspection}
        onOpenNextTrip={openNextTripInspection}
        onOpenChange={handleTripInspectionOpenChange}
      />
      <TimetableModal
        key={timetableData?.stop.stop_id ?? 'closed'}
        data={timetableData}
        time={dateTime}
        infoLevel={settings.infoLevel}
        dataLangs={langChain}
        globalFilter={globalFilter}
        onInspectTrip={handleInspectTrip}
        onClose={closeTimetable}
      />
      <Toaster
        theme={settings.theme}
        position="bottom-center"
        closeButton={true}
        richColors
        expand={true}
        visibleToasts={10}
      />
    </>
  );
}
