import type L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toast } from 'sonner';

// types
import type { AutoLocateOffReason } from './types/app/auto-locate';
import type { UserLocation } from './types/app/map';
import type { AppRouteTypeValue, Stop } from './types/app/transit';
import type {
  StopWithContext,
  StopWithMeta,
  TripInspectionTarget,
} from './types/app/transit-composed';

// config
import { PERF_PROFILES } from './config/perf-profiles';
import { SUPPORTED_LANGS } from './config/supported-langs';
import { TILE_SOURCES } from './config/tile-sources';
import { DEFAULT_TIMEZONE } from './config/transit-defaults';

// i18n
import i18n from './i18n';

// lib
import { applyAppTheme } from './lib/app-theme';
import { createLogger } from './lib/logger';

// domain
import { type AnchorEntry } from './domain/portal/anchor';
import { formatDateKey } from './domain/transit/calendar-utils';
import { deriveFilteredNearbyStops } from './domain/transit/derive-filtered-nearby-stops';
import { resolveLangChain, type LangChain } from './domain/transit/i18n/resolve-lang-chain';
import { getServiceDay } from './domain/transit/service-day';
import { type StopHistoryEntry } from './domain/transit/stop-history';
import { findVisibleStopMetaById, lookupStopMetaFromMap } from './domain/transit/stop-meta-lookup';
import {
  buildHistoryNavigationPayload,
  buildPortalNavigationPayload,
  buildSelectionSnapshotFromMeta,
  buildSelectionSnapshotFromStop,
} from './domain/transit/stop-navigation';
import { createStopReferenceSnapshot } from './domain/transit/stop-reference-snapshot';
import { buildStopRouteTypeMap } from './domain/transit/stop-route-type-map';
import { getTimetableOpenOutcomeMessage } from './domain/transit/timetable-message';
import { getStopServiceState } from './domain/transit/timetable-utils';
import { getTripInspectionOpenOutcomeMessage } from './domain/transit/trip-inspection-message';

// hooks
import { useAnchorRefresh } from './hooks/use-anchor-refresh';
import { useAnchorToggle } from './hooks/use-anchor-toggle';
import { useAnchors, type UseAnchorsReturn } from './hooks/use-anchors';
import { useAppDialogs } from './hooks/use-app-dialogs';
import { useDateTime } from './hooks/use-date-time';
import { useGlobalFilter } from './hooks/use-global-filter';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useLoadResult } from './hooks/use-load-result';
import { useNearbyStopTimes } from './hooks/use-nearby-stop-times';
import { useRouteShapes } from './hooks/use-route-shapes';
import { useRouteStops } from './hooks/use-route-stops';
import { useSelection } from './hooks/use-selection';
import { useStopHistory, type UseStopHistoryReturn } from './hooks/use-stop-history';
import { useStopNavigation } from './hooks/use-stop-navigation';
import { useStopParamHandler } from './hooks/use-stop-param-handler';
import { useStopsForBounds } from './hooks/use-stops-for-bounds';
import { useTimetable } from './hooks/use-timetable';
import { useTransitRepository } from './hooks/use-transit-repository';
import { useTripInspection } from './hooks/use-trip-inspection';
import { useUserSettings } from './hooks/use-user-settings';
import { useWebStorageAvailability } from './hooks/use-web-storage-availability';

// repository
import { LocalStorageAnchorRepository } from './repositories/anchor/local-storage-anchor-repository';
import { LocalStorageStopSelectionRepository } from './repositories/stop-selection/local-storage-stop-selection-repository';

// utils
import { formatDateParts } from './utils/datetime';
import { toggleGroupInList } from './utils/list-toggle';
import { routeTypeGroup } from './utils/route-type-category';
import {
  nextInfoLevel,
  nextLang,
  nextPerfMode,
  nextRenderMode,
  nextTileIndex,
} from './utils/settings-cycle';

// components
import { AppLayout } from './components/app-layout';
import { DataSourceSettingsDialog } from './components/dialog/data-source-settings-dialog';
import { InfoDialog } from './components/dialog/info-dialog';
import { ShortcutHelpDialog } from './components/dialog/shortcut-help-dialog';
import { StopSearchDialog } from './components/dialog/stop-search-dialog';
import { TimetableModal } from './components/dialog/timetable-modal';
import { TripInspectionDialog } from './components/dialog/trip-inspection-dialog';
import { MapOverlay } from './components/map/map-overlay';
import { MapView } from './components/map/map-view';
import { MapViewContainer } from './components/map/map-view-container';
import { Toaster } from './components/ui/sonner';
import { MapSlotProvider } from './contexts/map-slot-provider';

const logger = createLogger('App');

interface OpenOutcomeToastMessage {
  severity: 'warning' | 'error';
  messageKey: string;
}

function showOpenOutcomeToast(
  message: OpenOutcomeToastMessage | null,
  t: ReturnType<typeof useTranslation>['t'],
): void {
  if (!message) {
    return;
  }

  if (message.severity === 'warning') {
    toast.warning(t(message.messageKey));
    return;
  }

  toast.error(t(message.messageKey));
}

export default function App() {
  const { t } = useTranslation();
  const repo = useTransitRepository();
  const loadResult = useLoadResult();
  const [anchorRepo] = useState(() => new LocalStorageAnchorRepository());
  const [stopSelectionRepo] = useState(() => new LocalStorageStopSelectionRepository());
  const { settings, updateSetting, updateSettings } = useUserSettings();
  const { dateTime, isCustomTime, resetToNow, setCustomTime } = useDateTime();
  const isWebStorageReady = useWebStorageAvailability('local');

  // Sync i18next language with user setting.
  useEffect(() => {
    void i18n.changeLanguage(settings.lang);
  }, [settings.lang]);

  // Notify the user when the browser blocks access to Web Storage (e.g.,
  // Chrome's "block all cookies and site data" setting). Persistence for
  // settings / history / Anchor is unavailable in this state, so the toast
  // stays on screen (`duration: Infinity`) until the user dismisses it
  // explicitly -- auto-dismissing risks the user missing the notice and
  // never realising why nothing persists. The stable `id` collapses
  // duplicate toasts across StrictMode re-mount and language changes;
  // the label updates in place when the language switches.
  // See PRD section 3.H.
  useEffect(() => {
    if (isWebStorageReady) {
      return;
    }
    toast.warning(t('storage.unavailable.title'), {
      id: 'storage-unavailable',
      description: t('storage.unavailable.description'),
      duration: Infinity,
      closeButton: true,
    });
  }, [isWebStorageReady, t]);

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
  // data translation resolution).
  const langChain: LangChain = useMemo(
    () => resolveLangChain(settings.lang, SUPPORTED_LANGS),
    [settings.lang],
  );

  useEffect(() => {
    if (logger.isEnabled('debug')) {
      logger.debug(`LangChain: ${settings.lang} → [${langChain.join(' → ')}]`);
    }
  }, [settings.lang, langChain]);

  const perfProfile = PERF_PROFILES[settings.perfMode];

  // `clearFocus` originates from `useSelection`, which itself depends
  // on the stops produced by `useStopsForBounds`. To break that
  // circular dependency without re-creating callbacks on every render,
  // `useStopsForBounds` is given a stable `onStopsCommitted` callback
  // that reads the latest `clearFocus` from a ref; the ref is updated
  // in an effect right after `useSelection` returns.
  const clearFocusRef = useRef<() => void>(() => {});
  const handleStopsCommitted = useCallback(() => {
    clearFocusRef.current();
  }, []);

  const { inBoundStops, radiusStops, mapCenter, hasNearbyLoaded, handleBoundsChanged } =
    useStopsForBounds({
      repo,
      perfProfile,
      onStopsCommitted: handleStopsCommitted,
    });
  const routeShapes = useRouteShapes(repo);
  // Auto-tracking flag is intentionally not persisted: a tracking
  // permission/intent shouldn't silently survive a reload, so it always
  // starts off and the user must opt in each session. Lives in app.tsx
  // (rather than MapView) so `handleBoundsChanged` can gate its fetch
  // on the same flag without an extra signal channel.
  const [autoLocateEnabled, setAutoLocateEnabled] = useState(false);
  // Auto-locate state changes funnel through these helpers so every
  // real ON / OFF transition produces exactly one reason-tagged log
  // line. Each `disableAutoLocate` call site supplies a typed `reason`
  // from `AutoLocateOffReason`, which makes "why did tracking stop?"
  // a one-grep query in field traces.
  //
  // The setState updater form reads the latest `autoLocateEnabled`
  // value without listing it in deps (= helpers stay stable), and lets
  // us suppress the log when the call would have been a no-op anyway.
  // Many call sites (drag, marker selection, random jump etc.) fire
  // unconditionally regardless of the current flag, so without this
  // guard the log would be noisy whenever tracking was already off.
  const enableAutoLocate = useCallback(() => {
    setAutoLocateEnabled((prev) => {
      if (!prev) {
        logger.info('auto-locate enabled');
      }
      return true;
    });
  }, []);
  const disableAutoLocate = useCallback((reason: AutoLocateOffReason) => {
    setAutoLocateEnabled((prev) => {
      if (prev) {
        logger.info(`auto-locate disabled: reason=${reason}`);
      }
      return false;
    });
  }, []);

  // Last known user geolocation. Lifted from MapView so both the
  // user-location marker (rendered inside MapView) and the locate
  // button (rendered inside MapOverlay) read from the same
  // source. `useMapLocateWatch` inside MapView publishes each fix via
  // the `onLocated` prop; the manual locate flow inside the locate
  // button publishes via the same callback.
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  // Counter that increments every time a fresh geolocation fix
  // arrives (manual locate or auto-tracking watchPosition update).
  // Forwarded to the locate button as `locatePulseKey` so the button
  // replays a brief ripple animation to acknowledge the event without
  // altering its persistent state.
  const [locateUpdateCount, setLocateUpdateCount] = useState(0);
  const handleLocated = useCallback((location: UserLocation) => {
    setUserLocation(location);
    setLocateUpdateCount((n) => n + 1);
  }, []);

  // Leaflet `L.Map` instance captured from MapView via `onMapInstance`.
  // Forwarded to chrome that needs to drive the map directly (e.g.
  // `MapOverlay`'s MapControlPanel / MapNavigationPanel /
  // locate-button manual-locate flow). Stays `null` until MapView
  // mounts; consumers must tolerate the initial `null`.
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const {
    infoDialogOpen,
    setInfoDialogOpen,
    dataSourceSettingsDialogOpen,
    setDataSourceSettingsDialogOpen,
    searchModalOpen,
    setSearchModalOpen,
    shortcutHelpOpen,
    setShortcutHelpOpen,
    openInfoDialog,
    openDataSourceSettingsDialog,
    openSearchModal,
    openShortcutHelp,
  } = useAppDialogs();
  const {
    tripInspectionSnapshot,
    tripInspectionTargets,
    currentTripInspectionTargetIndex,
    showNoticeNonce,
    openTripInspectionFromTarget,
    openTripInspectionFromStopId,
    openPreviousTripInspection,
    openNextTripInspection,
    closeTripInspection,
  } = useTripInspection(repo);
  const { timetableData, openRouteHeadsignTimetable, openStopTimetable, closeTimetable } =
    useTimetable(repo);

  // Disable global shortcuts while primary modal state is active. This
  // includes `useAppDialogs` boolean flags and payload-backed dialog state
  // from timetable / trip-inspection hooks.
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
      !dataSourceSettingsDialogOpen &&
      !shortcutHelpOpen &&
      timetableData === null &&
      tripInspectionSnapshot === null,
    handlers: {
      onOpenSearch: openSearchModal,
      onOpenHelp: openShortcutHelp,
    },
  });

  // --- Custom Hooks ---

  const { stopTimes: nearbyStopTimes, isNearbyLoading } = useNearbyStopTimes(
    radiusStops,
    dateTime,
    repo,
  );

  // routeTypes lookup for all visible stops (in-bound + nearby).
  // Sync derivation keeps it in the same commit as the stops, so
  // new markers never flash gray before colour resolves. See
  // `buildStopRouteTypeMap` for the data-equivalence rationale.
  const routeTypeMap = useMemo(
    () => buildStopRouteTypeMap([...inBoundStops, ...radiusStops]),
    [inBoundStops, radiusStops],
  );

  const {
    selectedStopId,
    selectionInfo,
    focusPosition,
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

  // Publish the live `clearFocus` to the ref read by
  // `useStopsForBounds`'s `onStopsCommitted`. See the ref declaration
  // above for the circular-dependency rationale.
  useEffect(() => {
    clearFocusRef.current = clearFocus;
  }, [clearFocus]);

  const routeStops = useRouteStops(selectionInfo?.routeIds ?? null, repo);

  const { selectStop, navigateAndFocusStop } = useStopNavigation({
    disableAutoLocate,
    selectStopById,
    focusStop,
  });

  // --- History state and metadata lookup ---

  const {
    history,
    lastError: historyError,
    clearError: clearHistoryError,
    recordStopSelection,
  }: UseStopHistoryReturn = useStopHistory(stopSelectionRepo);

  useEffect(() => {
    if (!historyError) {
      return;
    }
    logger.warn(`history persistence failed: ${historyError}`);
    toast.error(t('history.operationFailed'), {
      description: historyError,
      duration: 2_000,
    });
    clearHistoryError();
  }, [clearHistoryError, historyError, t]);

  const historyStopMetaMap = useMemo(() => {
    if (history.length === 0) {
      return new Map<string, StopWithMeta>();
    }
    const historyEntries: readonly StopHistoryEntry[] = history;
    const stopIds = new Set<string>();
    for (const entry of historyEntries) {
      stopIds.add(entry.snapshot.stopId);
    }
    const metas = repo.getStopMetaByIds(stopIds);
    return new Map(metas.map((meta) => [meta.stop.stop_id, meta]));
  }, [history, repo]);

  const lookupHistoryStopMeta = useCallback(
    (stopId: string): StopWithMeta | null => lookupStopMetaFromMap(stopId, historyStopMetaMap),
    [historyStopMetaMap],
  );

  const recordStopMetaSelection = useCallback(
    (stopMeta: StopWithMeta) => {
      const snapshot = buildSelectionSnapshotFromMeta(stopMeta, routeTypeMap, langChain);
      void recordStopSelection(snapshot);
    },
    [langChain, recordStopSelection, routeTypeMap],
  );

  const recordStopSelectionByVisibleStop = useCallback(
    (stopId: string, fallbackStop?: Stop) => {
      const stopMeta = findVisibleStopMetaById(stopId, radiusStops, inBoundStops);
      if (stopMeta != null) {
        recordStopMetaSelection(stopMeta);
        return;
      }

      if (fallbackStop == null) {
        return;
      }

      const snapshot = buildSelectionSnapshotFromStop(fallbackStop, routeTypeMap, langChain);
      void recordStopSelection(snapshot);
    },
    [
      inBoundStops,
      langChain,
      radiusStops,
      recordStopMetaSelection,
      recordStopSelection,
      routeTypeMap,
    ],
  );

  // Apply ?stop= query param: resolve via repo, then pan / record once.
  // See `useStopParamHandler` for the ref-backed callback pattern that
  // avoids duplicate fetches when callbacks change during async resolve.
  useStopParamHandler({ repo, navigateAndFocusStop, recordStopMetaSelection });

  // --- Anchor state and metadata lookup ---

  const {
    anchors,
    lastError: anchorError,
    clearError: clearAnchorError,
    addAnchor,
    removeAnchor,
    batchUpdateAnchors,
    hasAnchor: isStopAnchor,
  }: UseAnchorsReturn = useAnchors(anchorRepo);

  const anchorIds = useMemo(() => new Set(anchors.map((a) => a.snapshot.stopId)), [anchors]);

  // Pre-resolved StopWithMeta map for every anchored stop_id.
  // Built from the repository's full dataset (not just the visible
  // viewport) so that `Portals` can look up the latest translated
  // display name for any anchor regardless of where it is on the map.
  const anchorStopMetaMap = useMemo(() => {
    if (anchors.length === 0) {
      return new Map<string, StopWithMeta>();
    }
    const stopIds = new Set(anchors.map((a) => a.snapshot.stopId));
    const metas = repo.getStopMetaByIds(stopIds);
    return new Map(metas.map((m) => [m.stop.stop_id, m]));
  }, [anchors, repo]);

  // Lookup an anchored stop's current StopWithMeta. Returns null
  // when the anchor's stop_id is not present in the active dataset
  // (e.g. cross-source anchor in mock mode, or a stop deleted from
  // the data); callers should fall back to the AnchorEntry snapshot.
  const lookupAnchorStopMeta = useCallback(
    (stopId: string): StopWithMeta | null => lookupStopMetaFromMap(stopId, anchorStopMetaMap),
    [anchorStopMetaMap],
  );

  const { handleToggleAnchorByStopId } = useAnchorToggle({
    anchors,
    hasAnchor: isStopAnchor,
    addAnchor,
    removeAnchor,
    repo,
    lookupAnchorStopMeta,
    langChain,
    t,
  });

  useEffect(() => {
    if (!anchorError) {
      return;
    }
    logger.warn(`anchor operation failed: ${anchorError}`);
    toast.error(t('anchor.operationFailed'), {
      description: anchorError,
      duration: 4_000,
    });
    clearAnchorError();
  }, [anchorError, clearAnchorError, t]);

  // Refresh anchor entries with latest data once per session.
  // See `useAnchorRefresh` for the "first non-empty anchors" timing
  // semantics (driven by `useAnchors`'s async load).
  useAnchorRefresh({ anchors, repo, batchUpdateAnchors, langChain });

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
      }).then((status) => {
        showOpenOutcomeToast(getTimetableOpenOutcomeMessage(status.status), t);
      });
    },
    [dateTime, openRouteHeadsignTimetable, t],
  );

  const handleShowStopTimetable = useCallback(
    (stopId: string) => {
      void openStopTimetable({
        stopId,
        dateTime,
      }).then((status) => {
        showOpenOutcomeToast(getTimetableOpenOutcomeMessage(status.status), t);
      });
    },
    [dateTime, openStopTimetable, t],
  );

  const handleOpenTripInspectionByStopId = useCallback(
    (stopId: string) => {
      const serviceDate = getServiceDay(dateTime);

      void openTripInspectionFromStopId({
        stopId,
        now: dateTime,
        serviceDate,
      }).then((status) => {
        showOpenOutcomeToast(getTripInspectionOpenOutcomeMessage(status), t);
      });
    },
    [dateTime, openTripInspectionFromStopId, t],
  );

  const handleInspectTrip = useCallback(
    (target: TripInspectionTarget) => {
      void openTripInspectionFromTarget(target, 'direct-open').then((status) => {
        showOpenOutcomeToast(getTripInspectionOpenOutcomeMessage(status), t);
      });
    },
    [openTripInspectionFromTarget, t],
  );

  const handleInspectTripFromDialog = useCallback(
    (target: TripInspectionTarget) => {
      void openTripInspectionFromTarget(target, 'trip-stops-time-select').then((status) => {
        showOpenOutcomeToast(getTripInspectionOpenOutcomeMessage(status), t);
      });
    },
    [openTripInspectionFromTarget, t],
  );

  const handleSelectStopFromTripInspection = useCallback(
    (stopId: string) => {
      void (async () => {
        const result = await repo.getStopMetaById(stopId);
        if (!result.success) {
          toast.error(t('tripInspection.messages.openFailed'));
          return;
        }
        navigateAndFocusStop('select-trip-inspection', result.data.stop);
        recordStopMetaSelection(result.data);
      })();
    },
    [navigateAndFocusStop, recordStopMetaSelection, repo, t],
  );

  const handleTripInspectionOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeTripInspection();
      }
    },
    [closeTripInspection],
  );

  // Wrap selectStop to also record in history.
  //
  // Disables auto-tracking because selecting a stop pans the map to
  // the stop's coordinates (via `PanToFocus` reading `focusPosition`),
  // which would fight the auto-pan effect and make subsequent
  // `moveend` events ineligible for nearby/in-bounds refetch.
  const handleSelectStop = useCallback(
    (stop: Stop) => {
      selectStop({ reason: 'select-marker', stopId: stop.stop_id, fallbackStop: stop });
      recordStopSelectionByVisibleStop(stop.stop_id, stop);
    },
    [recordStopSelectionByVisibleStop, selectStop],
  );

  // Wrap selectStopById to also record in history.
  // See `handleSelectStop` for the rationale of disabling auto-tracking.
  const handleSelectStopById = useCallback(
    (stopId: string) => {
      selectStop({ reason: 'select-bottom-sheet', stopId });
      recordStopSelectionByVisibleStop(stopId);
    },
    [recordStopSelectionByVisibleStop, selectStop],
  );

  // Select + pan to a stop from history.
  //
  // The pure resolver decides whether this selection should be ignored or
  // resolved, and when resolved it records whether the navigation target came
  // from current repository metadata or the persisted snapshot fallback.
  //
  // The caller only handles the shared execution path for resolved actions.
  const handleHistorySelect = useCallback(
    (entry: StopHistoryEntry) => {
      const payload = buildHistoryNavigationPayload(
        entry,
        routeTypeMap,
        langChain,
        lookupHistoryStopMeta,
      );
      if (payload == null) {
        logger.warn(`handleHistorySelect unresolved stopId=${entry.snapshot.stopId}`);
        return;
      }
      navigateAndFocusStop('select-history', payload.stop);
      void recordStopSelection(payload.snapshot);
    },
    [langChain, lookupHistoryStopMeta, navigateAndFocusStop, recordStopSelection, routeTypeMap],
  );

  // Select + pan to a stop from Portal dropdown.
  // See `handleHistorySelect` for the rationale of disabling
  // auto-tracking before panning.
  const handlePortalSelect = useCallback(
    (entry: AnchorEntry) => {
      logger.debug(
        `handlePortalSelect [Portal]: stopId=${entry.snapshot.stopId}, name=${entry.snapshot.name}`,
      );
      const payload = buildPortalNavigationPayload(
        entry,
        routeTypeMap,
        langChain,
        lookupAnchorStopMeta,
      );
      if (payload == null) {
        logger.warn(`handlePortalSelect unresolved stopId=${entry.snapshot.stopId}`);
        return;
      }
      navigateAndFocusStop('select-portal', payload.stop);
      void recordStopSelection(payload.snapshot);
    },
    [langChain, lookupAnchorStopMeta, navigateAndFocusStop, recordStopSelection, routeTypeMap],
  );

  // Select + pan to a stop chosen from the search dialog.
  // See `handleHistorySelect` for the rationale of disabling
  // auto-tracking before panning.
  const handleSearchSelect = useCallback(
    (stop: Stop, routeTypes: AppRouteTypeValue[]) => {
      logger.debug(`handleSearchSelect [Search]: stopId=${stop.stop_id}, name=${stop.stop_name}`);
      navigateAndFocusStop('select-search', stop);
      const snapshot = createStopReferenceSnapshot(stop, routeTypes, langChain);
      void recordStopSelection(snapshot);
      setSearchModalOpen(false);
    },
    [langChain, navigateAndFocusStop, recordStopSelection, setSearchModalOpen],
  );

  // --- App-wide filter state (shared across surfaces) ---

  // Stop-event-level filter toggles owned by `useGlobalFilter`. The
  // hook bundles state (`showOriginOnly` / `showBoardableOnly` /
  // `omitEmptyStopsOverride`), late-night derived policy
  // (`isLateNight` / `effectiveOmitEmptyStops` / forced-on rules),
  // and the memoized `globalFilter` object that BottomSheet /
  // TimetableModal consume. `App` keeps `showOriginOnly`,
  // `showBoardableOnly`, and `effectiveOmitEmptyStops` to feed
  // `deriveFilteredNearbyStops`; MapView reads the filtered result
  // (`stopTimes`) rather than `globalFilter` itself.
  const { showOriginOnly, showBoardableOnly, effectiveOmitEmptyStops, globalFilter } =
    useGlobalFilter(dateTime);

  // --- Settings handlers ---

  const enabledRouteTypes = useMemo(
    () => new Set(settings.visibleStopTypes),
    [settings.visibleStopTypes],
  );

  // Derive the visible nearby-stop state in one selector: route-type
  // filter (settings), origin/boardable filter (globalFilter),
  // empty-stop omit policy, pre-globalFilter `TimetableEntriesState`
  // snapshot, and pre/post-filter counts. Internally this is still a
  // multi-pass pipeline (filter -> state map -> toggles -> omit ->
  // counts); the consolidation is structural -- one derivation block
  // instead of a chain of `useMemo` -- not a single-traversal
  // optimization. Aliases below keep the existing call sites
  // untouched while the selector owns the pipeline. See
  // `deriveFilteredNearbyStops` for the step ordering and the
  // pre-globalFilter rationale for the state map.
  const {
    filtered: stopEventAttributesNonEmptyNearbyStopTimes,
    timetableEntriesStateByStopId,
    rawCounts: nearbyStopsCounts,
    filteredCounts: filteredNearbyStopsCounts,
  } = useMemo(
    () =>
      deriveFilteredNearbyStops({
        nearbyStopTimes,
        enabledRouteTypes,
        showOriginOnly,
        showBoardableOnly,
        omitEmptyStops: effectiveOmitEmptyStops,
      }),
    [
      nearbyStopTimes,
      enabledRouteTypes,
      showOriginOnly,
      showBoardableOnly,
      effectiveOmitEmptyStops,
    ],
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
    if (logger.isEnabled('debug')) {
      const prevTileLabel =
        prevTileIndex == null
          ? 'none'
          : (TILE_SOURCES[prevTileIndex]?.label ?? `unknown(${String(prevTileIndex)})`);
      const nextTileLabel =
        nextTile == null
          ? 'none'
          : (TILE_SOURCES[nextTile]?.label ?? `unknown(${String(nextTile)})`);
      logger.debug(
        `tile: ${prevTileLabel} (${String(prevTileIndex)}) -> ${nextTileLabel} (${String(nextTile)})`,
      );
    }
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
    applyAppTheme(settings.theme);
  }, [settings.theme]);

  return (
    // App root container: provides the positioned ancestor that lets
    // children use `absolute inset-0` to fill the viewport, and sets
    // the page to a fixed viewport box. `relative` without `z-index`
    // is intentional — it must not create a stacking context, so
    // descendant z-1000+ values bubble up to the root context (see
    // DEVELOPMENT.md "z-index 階層").
    <div className="relative h-dvh w-dvw overflow-hidden">
      {/* `MapSlotProvider` shares the layout-declared "visible map
       * slot" element between `MapViewContainer` (reads it to position
       * the hoisted MapView's wrapper) and the active layout component
       * (registers its slot div via `useSetMapSlotElement`). */}
      <MapSlotProvider>
        {/* Always-mounted map layer (case 1A hoist): MapView lives at
         * App root and survives every layout-mode / orientation
         * transition. Its wrapper is positioned to match the
         * layout-declared slot so Leaflet's view bounds correspond to
         * the area the user actually sees. */}
        <MapViewContainer>
          <MapView
            inBoundStops={inBoundStops}
            radiusStops={radiusStops}
            selectedStopId={selectedStopId}
            focusPosition={focusPosition}
            stopTimes={stopEventAttributesNonEmptyNearbyStopTimes}
            routeTypeMap={routeTypeMap}
            routeShapes={routeShapes}
            selectionInfo={selectionInfo}
            routeStops={routeStops}
            visibleStopTypes={enabledRouteTypes}
            visibleRouteShapes={visibleRouteShapes}
            tileIndex={settings.tileIndex}
            renderMode={settings.renderMode}
            infoLevel={settings.infoLevel}
            dataLang={langChain}
            time={dateTime}
            onBoundsChanged={handleBoundsChanged}
            onStopSelected={handleSelectStop}
            onFetchStopTimes={handleFetchStopTimes}
            onDeselectStop={deselectStop}
            onRouteShapeSelected={selectRouteShape}
            resolveRouteFreq={resolveRouteFreq}
            theme={settings.theme}
            doubleTapDrag={settings.doubleTapDrag}
            autoLocateEnabled={autoLocateEnabled}
            onDisableAutoLocate={disableAutoLocate}
            userLocation={userLocation}
            onLocated={handleLocated}
            onMapInstance={setMapInstance}
            heightClassName="h-full"
          />
          {/* All chrome that overlays the map: corner panels, locate
           * button, top-centre StopHistory / Portals dropdowns, and
           * the TimeControls time-pinning bar. Sibling of MapView so
           * the Leaflet subtree owns only Leaflet content. Rendered
           * inside MapViewContainer so its `absolute` children resolve
           * against the same slot bbox as MapView — keeping all
           * map-area chrome (TimeControls' `left-1/2`, the StopHistory
           * / Portals dropdowns, etc.) consistently anchored to the
           * visible map area rather than the full viewport. */}
          <MapOverlay
            map={mapInstance}
            tileIndex={settings.tileIndex}
            visibleRouteShapes={visibleRouteShapes}
            visibleStopTypes={enabledRouteTypes}
            renderMode={settings.renderMode}
            perfMode={settings.perfMode}
            infoLevel={settings.infoLevel}
            theme={settings.theme}
            selectedStopId={selectedStopId}
            stopHistory={history}
            anchors={anchors}
            onCycleTile={handleCycleTile}
            onToggleBusShapes={handleToggleBusShapes}
            onToggleNonBusShapes={handleToggleNonBusShapes}
            onToggleRenderMode={handleToggleRenderMode}
            onTogglePerfMode={handleTogglePerfMode}
            onCycleInfoLevel={handleCycleInfoLevel}
            onToggleDarkMode={handleToggleDarkMode}
            onCycleLang={handleCycleLang}
            dataLang={langChain}
            onToggleStopType={handleToggleStopType}
            onSearchClick={openSearchModal}
            onInfoClick={openInfoDialog}
            onLocated={handleLocated}
            autoLocateEnabled={autoLocateEnabled}
            onEnableAutoLocate={enableAutoLocate}
            onDisableAutoLocate={disableAutoLocate}
            locatePulseKey={locateUpdateCount}
            onDeselectStop={deselectStop}
            onHistorySelect={handleHistorySelect}
            onPortalSelect={handlePortalSelect}
            onPortalRemove={(entry: AnchorEntry) =>
              handleToggleAnchorByStopId(entry.snapshot.stopId)
            }
            lookupAnchorStopMeta={lookupAnchorStopMeta}
            lookupHistoryStopMeta={lookupHistoryStopMeta}
            time={dateTime}
            isCustomTime={isCustomTime}
            onResetToNow={resetToNow}
            onCustomTimeSet={setCustomTime}
          />
        </MapViewContainer>
        <AppLayout
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
        />
      </MapSlotProvider>
      {/* Dialogs / Toaster do not consume `MapSlotContext`, so they
       * live as siblings of `MapSlotProvider` rather than children.
       * Keeping the provider's scope narrow (`MapViewContainer` +
       * `AppLayout` only) makes "which subtree depends on the map
       * slot" obvious at a glance and lets these overlays be tested
       * without a `MapSlotProvider` fixture. */}
      <StopSearchDialog
        repo={repo}
        infoLevel={settings.infoLevel}
        dataLang={langChain}
        mapCenter={mapCenter}
        isStopAnchor={isStopAnchor}
        onSelectStop={handleSearchSelect}
        onToggleAnchor={handleToggleAnchorByStopId}
        onShowStopTimetable={handleShowStopTimetable}
        onOpenTripInspectionByStopId={handleOpenTripInspectionByStopId}
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
      />
      <InfoDialog
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        onOpenDataSourceSettings={openDataSourceSettingsDialog}
      />
      <DataSourceSettingsDialog
        open={dataSourceSettingsDialogOpen}
        onOpenChange={setDataSourceSettingsDialogOpen}
      />
      <ShortcutHelpDialog open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />
      <TripInspectionDialog
        open={tripInspectionSnapshot !== null}
        snapshot={tripInspectionSnapshot}
        tripInspectionTargets={tripInspectionTargets}
        currentTripInspectionTargetIndex={currentTripInspectionTargetIndex}
        showNoticeNonce={showNoticeNonce}
        now={dateTime}
        infoLevel={settings.infoLevel}
        dataLangs={langChain}
        onOpenPreviousTrip={openPreviousTripInspection}
        onOpenNextTrip={openNextTripInspection}
        onInspectTrip={handleInspectTripFromDialog}
        onSelectStopById={handleSelectStopFromTripInspection}
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
    </div>
  );
}
