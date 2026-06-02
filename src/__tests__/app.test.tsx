import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import App from '../app';
import { RootErrorBoundary } from '../components/error-boundary';
import { makeRepo, makeRoute, makeStop, makeStopMeta } from './helpers';
import type { StopHistoryEntry } from '../domain/transit/stop-history';
import type { UseStopHistoryReturn } from '../hooks/use-stop-history';
import type { UseAnchorToggleReturn } from '../hooks/use-anchor-toggle';
import type { UseAnchorsReturn } from '../hooks/use-anchors';
import type { TransitRepository } from '../repositories/transit-repository';
import type { UseTimetableReturn } from '../hooks/use-timetable';
import type { RouteShape } from '../types/app/map';
import type { ContextualTimetableEntry, StopWithContext } from '../types/app/transit-composed';

type UseDateTimeReturn = ReturnType<typeof import('../hooks/use-date-time').useDateTime>;
type UseNearbyStopTimesReturn = ReturnType<
  typeof import('../hooks/use-nearby-stop-times').useNearbyStopTimes
>;
type GetServiceDayMinutes = typeof import('../domain/transit/service-day').getServiceDayMinutes;
type UseTransitRepositoryReturn = TransitRepository;

const {
  mockToastError,
  mockToastWarning,
  mockUseAnchors,
  mockUseAnchorToggle,
  mockGetRouteShapes,
  mockClearAnchorError,
  mockGetServiceDayMinutes,
  mockUseDateTime,
  mockUseNearbyStopTimes,
  mockUseStopHistory,
  mockUseTransitRepository,
  mockFocusStop,
  mockAppLayout,
  mockMapView,
  mockMapOverlay,
  mockInfoDialog,
  mockDataSourceSettingsDialog,
  mockStopSearchDialog,
  mockShortcutHelpDialog,
  mockUseKeyboardShortcuts,
  mockUseTimetable,
  mockOpenStopTimetable,
  mockOpenRouteHeadsignTimetable,
  mockUseLoadResult,
} = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
  mockUseAnchors: vi.fn<(...args: unknown[]) => UseAnchorsReturn>(),
  mockUseAnchorToggle: vi.fn<() => UseAnchorToggleReturn>(),
  mockGetRouteShapes: vi.fn(),
  mockClearAnchorError: vi.fn(),
  mockGetServiceDayMinutes: vi.fn<GetServiceDayMinutes>(),
  mockUseDateTime: vi.fn<() => UseDateTimeReturn>(),
  mockUseNearbyStopTimes: vi.fn<() => UseNearbyStopTimesReturn>(),
  mockUseStopHistory: vi.fn<() => UseStopHistoryReturn>(),
  mockUseTransitRepository: vi.fn<() => UseTransitRepositoryReturn>(),
  mockFocusStop: vi.fn(),
  mockAppLayout: vi.fn(),
  mockMapView: vi.fn(),
  mockMapOverlay: vi.fn(),
  mockInfoDialog: vi.fn(),
  mockDataSourceSettingsDialog: vi.fn(),
  mockStopSearchDialog: vi.fn(),
  mockShortcutHelpDialog: vi.fn(),
  mockUseKeyboardShortcuts: vi.fn(),
  mockUseTimetable: vi.fn<() => UseTimetableReturn>(),
  mockOpenStopTimetable: vi.fn(),
  mockOpenRouteHeadsignTimetable: vi.fn(),
  mockUseLoadResult: vi.fn<() => { loaded: string[]; failed: { prefix: string; error: Error }[] }>(
    () => ({ loaded: [], failed: [] }),
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    warning: mockToastWarning,
  },
}));

vi.mock('../components/ui/sonner', () => ({
  Toaster: () => null,
}));

vi.mock('../hooks/use-transit-repository', () => ({
  useTransitRepository: () => mockUseTransitRepository(),
}));

vi.mock('../hooks/use-load-result', () => ({
  useLoadResult: () => mockUseLoadResult(),
}));

vi.mock('../hooks/use-user-settings', () => ({
  useUserSettings: () => ({
    settings: {
      perfMode: 'normal',
      renderMode: 'auto',
      tileIndex: 0,
      infoLevel: 'normal',
      visibleStopTypes: [3],
      visibleRouteShapes: [3],
      theme: 'light',
      doubleTapDrag: false,
    },
    updateSetting: vi.fn(),
    updateSettings: vi.fn(),
  }),
}));

vi.mock('../hooks/use-date-time', () => ({
  useDateTime: () => mockUseDateTime(),
}));

vi.mock('../domain/transit/service-day', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/transit/service-day')>();
  return {
    ...actual,
    getServiceDayMinutes: (dateTime: Date) => mockGetServiceDayMinutes(dateTime),
  };
});

vi.mock('../hooks/use-nearby-stop-times', () => ({
  useNearbyStopTimes: () => mockUseNearbyStopTimes(),
}));

vi.mock('../hooks/use-timetable', () => ({
  useTimetable: () => mockUseTimetable(),
}));

vi.mock('../hooks/use-selection', () => ({
  useSelection: () => ({
    selectedStopId: null,
    selectionInfo: null,
    focusPosition: null,
    selectStop: vi.fn(),
    selectStopById: vi.fn(),
    deselectStop: vi.fn(),
    selectRouteShape: vi.fn(),
    focusStop: mockFocusStop,
    clearFocus: vi.fn(),
  }),
}));

vi.mock('../hooks/use-stop-history', () => ({
  useStopHistory: () => mockUseStopHistory(),
}));

vi.mock('../hooks/use-route-stops', () => ({
  useRouteStops: () => [],
}));

vi.mock('../hooks/use-anchors', () => ({
  useAnchors: (...args: unknown[]) => mockUseAnchors(...args),
}));

vi.mock('../hooks/use-anchor-toggle', () => ({
  useAnchorToggle: () => mockUseAnchorToggle(),
}));

vi.mock('../lib/query-params', () => ({
  getStopParam: () => null,
}));

vi.mock('../components/map/map-view', () => ({
  MapView: (props: unknown) => {
    mockMapView(props);
    return null;
  },
}));

// `MapOverlay` is hoisted next to `MapView` in `app.tsx` (Phase 1
// refactor). Mock it so the test doesn't pull in the real overlay
// subtree — that subtree's transitive imports (the locate button →
// `use-map-navigation-actions` → `map-defaults`) reach
// `query-params.ts` exports beyond `getStopParam`, which the mock
// above does not provide. Also captures the props so tests that need
// to drive history/portal handlers (now passed to `MapOverlay`
// rather than MapView) can fetch them from this mock.
vi.mock('../components/map/map-overlay', () => ({
  MapOverlay: (props: unknown) => {
    mockMapOverlay(props);
    return null;
  },
}));

vi.mock('../components/app-layout', () => ({
  AppLayout: (props: unknown) => {
    mockAppLayout(props);
    return null;
  },
}));

vi.mock('../components/bottom-sheet', () => ({
  BottomSheet: () => null,
}));

vi.mock('../components/time-controls', () => ({
  TimeControls: () => null,
}));

vi.mock('../components/dialog/timetable-dialog', () => ({
  TimetableDialog: () => null,
}));

vi.mock('../components/dialog/stop-search-dialog', () => ({
  StopSearchDialog: (props: unknown) => {
    mockStopSearchDialog(props);
    return null;
  },
}));

vi.mock('../components/dialog/info-dialog', () => ({
  InfoDialog: (props: unknown) => {
    mockInfoDialog(props);
    return null;
  },
}));

vi.mock('../components/datasource/data-source-settings-container', () => ({
  DataSourceSettingsContainer: (props: unknown) => {
    mockDataSourceSettingsDialog(props);
    return null;
  },
}));

vi.mock('../components/dialog/shortcut-help-dialog', () => ({
  ShortcutHelpDialog: (props: unknown) => {
    mockShortcutHelpDialog(props);
    return null;
  },
}));

vi.mock('../hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: (options: unknown) => {
    mockUseKeyboardShortcuts(options);
  },
}));

describe('App anchor error toast', () => {
  const makeEntry = (
    overrides: { isOrigin?: boolean; isTerminal?: boolean; pickupType?: 0 | 1 | 2 | 3 } = {},
  ): ContextualTimetableEntry => ({
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: {
        route_id: 'route-1',
        route_type: 3,
        agency_id: 'agency-1',
        route_short_name: '1',
        route_short_names: {},
        route_long_name: 'Route 1',
        route_long_names: {},
        route_color: '000000',
        route_text_color: 'FFFFFF',
      },
      tripHeadsign: { name: 'Terminal', names: {} },
    },
    boarding: { pickupType: overrides.pickupType ?? 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: 0,
      totalStops: 3,
      isOrigin: overrides.isOrigin ?? false,
      isTerminal: overrides.isTerminal ?? false,
    },
    tripLocator: { patternId: 'pattern-1', serviceId: 'svc-1', tripIndex: 0 },
    serviceDate: new Date('2026-03-28T00:00:00Z'),
  });

  const makeNearbyStop = (
    stopId: string,
    entries: ContextualTimetableEntry[],
    stopServiceState: StopWithContext['stopServiceState'] = 'boardable',
  ): StopWithContext => ({
    stop: {
      stop_id: stopId,
      stop_name: stopId,
      stop_names: {},
      stop_lat: 0,
      stop_lon: 0,
      location_type: 0,
      agency_id: 'agency-1',
    },
    agencies: [],
    routes: [],
    routeTypes: [3],
    stopTimes: entries,
    stopServiceState,
  });

  const getLastLayoutProps = () => {
    const lastCall = mockAppLayout.mock.lastCall;
    expect(lastCall).toBeTruthy();
    return lastCall?.[0] as {
      globalFilter: {
        omitEmptyStops: boolean;
        isOmitEmptyStopsForced: boolean;
        onToggleShowOriginOnly: () => void;
        onToggleShowBoardableOnly: () => void;
        onToggleOmitEmptyStops: () => void;
      };
      filteredNearbyStopsCounts: {
        total: number;
        nonEmpty: number;
        originCount: number;
        boardableCount: number;
      };
    };
  };

  beforeEach(async () => {
    // Fix i18n language to 'ja' so toast message assertions are deterministic.
    await i18n.changeLanguage('ja');
    mockToastError.mockReset();
    mockToastWarning.mockReset();
    mockUseAnchors.mockReset();
    mockUseAnchorToggle.mockReset();
    mockGetRouteShapes.mockReset();
    mockClearAnchorError.mockReset();
    mockGetServiceDayMinutes.mockReset();
    mockUseDateTime.mockReset();
    mockUseNearbyStopTimes.mockReset();
    mockUseStopHistory.mockReset();
    mockUseTransitRepository.mockReset();
    mockFocusStop.mockReset();
    mockAppLayout.mockReset();
    mockMapView.mockReset();
    mockMapOverlay.mockReset();
    mockInfoDialog.mockReset();
    mockDataSourceSettingsDialog.mockReset();
    mockStopSearchDialog.mockReset();
    mockShortcutHelpDialog.mockReset();
    mockUseKeyboardShortcuts.mockReset();
    mockUseTimetable.mockReset();
    mockOpenStopTimetable.mockReset();
    mockOpenRouteHeadsignTimetable.mockReset();

    mockGetRouteShapes.mockResolvedValue({ success: true, data: [] });
    mockUseTransitRepository.mockReturnValue(
      makeRepo({
        getRouteShapes: mockGetRouteShapes,
      }),
    );
    mockUseStopHistory.mockReturnValue({
      history: [],
      recordStopSelection: vi.fn(),
      lastError: null,
      clearError: vi.fn(),
      clearHistory: vi.fn(),
    });
    mockUseAnchors.mockReturnValue({
      anchors: [],
      lastError: null,
      clearError: mockClearAnchorError,
      addAnchor: vi.fn(),
      removeAnchor: vi.fn(),
      updateAnchor: vi.fn(),
      batchUpdateAnchors: vi.fn(),
      hasAnchor: vi.fn(() => false),
    });
    mockUseAnchorToggle.mockReturnValue({
      handleToggleAnchorByStopId: vi.fn(),
    });
    mockUseDateTime.mockReturnValue({
      virtualNow: new Date('2026-03-28T12:00:00Z'),
      isVirtualNowPinned: false,
      pinVirtualNow: vi.fn(),
      unpinVirtualNow: vi.fn(),
    });
    mockGetServiceDayMinutes.mockReturnValue(12 * 60);
    mockUseNearbyStopTimes.mockReturnValue({
      stopTimes: [],
      isNearbyLoading: false,
    });
    mockUseTimetable.mockReturnValue({
      timetableData: null,
      openStopTimetable: mockOpenStopTimetable,
      openRouteHeadsignTimetable: mockOpenRouteHeadsignTimetable,
      changeDateTime: vi.fn(),
      closeTimetable: vi.fn(),
    });
    mockOpenStopTimetable.mockResolvedValue({ status: 'opened' });
    mockOpenRouteHeadsignTimetable.mockResolvedValue({ status: 'opened' });
  });

  it('does not show toast when lastError is null', async () => {
    mockUseAnchors.mockReturnValue({
      anchors: [],
      lastError: null,
      clearError: mockClearAnchorError,
      addAnchor: vi.fn(),
      removeAnchor: vi.fn(),
      updateAnchor: vi.fn(),
      batchUpdateAnchors: vi.fn(),
      hasAnchor: vi.fn(() => false),
    });

    render(<App />);

    // Give effects time to run
    await waitFor(() => {
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockClearAnchorError).not.toHaveBeenCalled();
    });
  });

  it('shows toast and clears anchor error when useAnchors returns lastError', async () => {
    mockUseAnchors.mockReturnValue({
      anchors: [],
      lastError: 'Duplicate stop: A',
      clearError: mockClearAnchorError,
      addAnchor: vi.fn(),
      removeAnchor: vi.fn(),
      updateAnchor: vi.fn(),
      batchUpdateAnchors: vi.fn(),
      hasAnchor: vi.fn(() => false),
    });

    render(<App />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('アンカーの処理に失敗しました', {
        description: 'Duplicate stop: A',
        duration: 4000,
      });
      expect(mockClearAnchorError).toHaveBeenCalledTimes(1);
    });
  });

  it('shows toast and clears history error when useStopHistory returns lastError', async () => {
    const clearHistoryError = vi.fn();
    mockUseStopHistory.mockReturnValue({
      history: [],
      recordStopSelection: vi.fn(),
      lastError: 'Quota exceeded',
      clearError: clearHistoryError,
      clearHistory: vi.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('履歴の処理に失敗しました', {
        description: 'Quota exceeded',
        duration: 2000,
      });
      expect(clearHistoryError).toHaveBeenCalledTimes(1);
    });
  });

  it('boots without falling into the error boundary when localStorage getter throws during app init', async () => {
    // Regression test for Issue #237: when the `globalThis.localStorage` getter
    // throws (e.g., Chrome's "block all cookies and site data" setting), the
    // App must degrade gracefully instead of crashing into the root error
    // boundary. User-data repositories (anchors, stop selection) and settings
    // are expected to fall back to in-memory / defaults; persistence is
    // silently disabled for the session.
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError');
      },
    });

    try {
      render(
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>,
      );

      // App must render its normal tree; the error boundary fallback must
      // not appear.
      await waitFor(() => {
        expect(getLastLayoutProps()).toBeDefined();
      });
      expect(screen.queryByText('問題が発生しました')).not.toBeInTheDocument();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      }
      consoleErrorSpy.mockRestore();
    }
  });

  it('shows a storage-unavailable toast when localStorage getter throws during app init', async () => {
    // Per PRD section 3.H: when localStorage cannot be read, the user must
    // be notified once that settings / history / Anchor will not persist.
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError');
      },
    });

    try {
      render(<App />);

      await waitFor(() => {
        expect(mockToastWarning).toHaveBeenCalledWith('ストレージが利用できません', {
          id: 'storage-unavailable',
          description: '設定、履歴などが利用できません',
          duration: Infinity,
          closeButton: true,
        });
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      }
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not show the storage-unavailable toast when localStorage is reachable', async () => {
    render(<App />);

    await waitFor(() => {
      expect(getLastLayoutProps()).toBeDefined();
    });
    expect(mockToastWarning).not.toHaveBeenCalledWith(
      'ストレージが利用できません',
      expect.anything(),
    );
  });

  it('forces omitEmptyStops on for origin filter and keeps toggleOmitEmptyStops as a no-op while forced', async () => {
    mockUseNearbyStopTimes.mockReturnValue({
      stopTimes: [
        makeNearbyStop('origin-stop', [makeEntry({ isOrigin: true })]),
        makeNearbyStop('middle-stop', [makeEntry({ isOrigin: false })]),
      ],
      isNearbyLoading: false,
    });

    render(<App />);

    await waitFor(() => {
      const props = getLastLayoutProps();
      expect(props.globalFilter.omitEmptyStops).toBe(false);
      expect(props.globalFilter.isOmitEmptyStopsForced).toBe(false);
      expect(props.filteredNearbyStopsCounts.total).toBe(2);
    });

    act(() => {
      getLastLayoutProps().globalFilter.onToggleShowOriginOnly();
    });

    await waitFor(() => {
      const props = getLastLayoutProps();
      expect(props.globalFilter.omitEmptyStops).toBe(true);
      expect(props.globalFilter.isOmitEmptyStopsForced).toBe(true);
      expect(props.filteredNearbyStopsCounts.total).toBe(1);
    });

    act(() => {
      getLastLayoutProps().globalFilter.onToggleOmitEmptyStops();
    });

    await waitFor(() => {
      const props = getLastLayoutProps();
      expect(props.globalFilter.omitEmptyStops).toBe(true);
      expect(props.globalFilter.isOmitEmptyStopsForced).toBe(true);
      expect(props.filteredNearbyStopsCounts.total).toBe(1);
    });
  });

  it('forces omitEmptyStops on for boardable filter and updates filtered counts', async () => {
    mockUseNearbyStopTimes.mockReturnValue({
      stopTimes: [
        makeNearbyStop('boardable-stop', [makeEntry({ pickupType: 0 })]),
        makeNearbyStop('non-boardable-stop', [makeEntry({ pickupType: 1 })]),
      ],
      isNearbyLoading: false,
    });

    render(<App />);

    await waitFor(() => {
      const props = getLastLayoutProps();
      expect(props.globalFilter.omitEmptyStops).toBe(false);
      expect(props.globalFilter.isOmitEmptyStopsForced).toBe(false);
      expect(props.filteredNearbyStopsCounts.total).toBe(2);
    });

    act(() => {
      getLastLayoutProps().globalFilter.onToggleShowBoardableOnly();
    });

    await waitFor(() => {
      const props = getLastLayoutProps();
      expect(props.globalFilter.omitEmptyStops).toBe(true);
      expect(props.globalFilter.isOmitEmptyStopsForced).toBe(true);
      expect(props.filteredNearbyStopsCounts.total).toBe(1);
      expect(props.filteredNearbyStopsCounts.boardableCount).toBe(1);
    });
  });

  it('auto-enables omitEmptyStops late at night and allows manual override off when not forced', async () => {
    mockGetServiceDayMinutes.mockReturnValue(22 * 60 + 30);
    mockUseNearbyStopTimes.mockReturnValue({
      stopTimes: [
        makeNearbyStop('active-stop', [makeEntry()]),
        makeNearbyStop('ended-stop', [], 'no-service'),
      ],
      isNearbyLoading: false,
    });

    render(<App />);

    await waitFor(() => {
      const props = getLastLayoutProps();
      expect(props.globalFilter.omitEmptyStops).toBe(true);
      expect(props.globalFilter.isOmitEmptyStopsForced).toBe(false);
      expect(props.filteredNearbyStopsCounts.total).toBe(1);
    });

    act(() => {
      getLastLayoutProps().globalFilter.onToggleOmitEmptyStops();
    });

    await waitFor(() => {
      const props = getLastLayoutProps();
      expect(props.globalFilter.omitEmptyStops).toBe(false);
      expect(props.globalFilter.isOmitEmptyStopsForced).toBe(false);
      expect(props.filteredNearbyStopsCounts.total).toBe(2);
    });
  });

  it('shows an error toast when stop timetable loading fails', async () => {
    mockOpenStopTimetable.mockResolvedValue({ status: 'error' });

    render(<App />);

    await waitFor(() => {
      expect(mockAppLayout).toHaveBeenCalled();
    });

    const lastCall = mockAppLayout.mock.lastCall;
    const props = lastCall?.[0] as {
      bottomSheetProps: {
        onShowStopTimetable: (stopId: string) => void;
      };
    };

    act(() => {
      props.bottomSheetProps.onShowStopTimetable('stop-error');
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('時刻表を取得できませんでした');
    });
  });

  it('shows a warning toast when route timetable is unavailable at a stop', async () => {
    mockOpenRouteHeadsignTimetable.mockResolvedValue({ status: 'route-not-found' });

    render(<App />);

    await waitFor(() => {
      expect(mockAppLayout).toHaveBeenCalled();
    });

    const lastCall = mockAppLayout.mock.lastCall;
    const props = lastCall?.[0] as {
      bottomSheetProps: {
        onShowTimetable: (stopId: string, routeId: string, headsign: string) => void;
      };
    };

    act(() => {
      props.bottomSheetProps.onShowTimetable('stop-1', 'route-1', 'Headsign');
    });

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith('この路線の時刻表を表示できません');
    });
  });

  it('re-records history from current stop metadata when that stop is still resolvable', async () => {
    const recordStopSelection = vi.fn();
    const entry: StopHistoryEntry = {
      snapshot: {
        stopId: 'A',
        name: 'Snapshot A',
        lat: 35,
        lon: 139,
        routeTypes: [3],
        agencyNames: [],
      },
      selectedAt: 1000,
    };
    const latestStop = makeStop('A', 36, 140);
    const latestMeta = {
      ...makeStopMeta(latestStop),
      routes: [makeRoute('route-1', 1), makeRoute('route-2', 3)],
    };

    mockUseStopHistory.mockReturnValue({
      history: [entry],
      recordStopSelection,
      lastError: null,
      clearError: vi.fn(),
      clearHistory: vi.fn(),
    });
    mockUseTransitRepository.mockReturnValue(
      makeRepo({
        getRouteShapes: mockGetRouteShapes,
        getStopMetaByIds: vi.fn().mockReturnValue([latestMeta]),
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(mockAppLayout).toHaveBeenCalled();
    });

    // onHistorySelect lives on MapOverlay (Phase 1 refactor: chrome
    // extracted out of MapView; previously this prop flowed
    // App → MapView → MapOverlay, now App → MapOverlay directly).
    // Capture from its mock.
    const lastOverlayCall = mockMapOverlay.mock.lastCall;
    expect(lastOverlayCall).toBeDefined();
    const overlayProps = lastOverlayCall![0] as {
      onHistorySelect: (entry: StopHistoryEntry) => void;
    };

    act(() => {
      overlayProps.onHistorySelect(entry);
    });

    await waitFor(() => {
      expect(recordStopSelection).toHaveBeenCalledWith({
        stopId: 'A',
        name: latestStop.stop_name,
        lat: 36,
        lon: 140,
        routeTypes: [1, 3],
        agencyNames: [],
        platformCode: undefined,
      });
    });
  });

  it('reuses the stored history snapshot when current stop metadata is unavailable', async () => {
    const recordStopSelection = vi.fn();
    const entry: StopHistoryEntry = {
      snapshot: {
        stopId: 'A',
        name: 'Snapshot A',
        lat: 35,
        lon: 139,
        routeTypes: [3],
        agencyNames: [],
      },
      selectedAt: 1000,
    };
    mockUseStopHistory.mockReturnValue({
      history: [entry],
      recordStopSelection,
      lastError: null,
      clearError: vi.fn(),
      clearHistory: vi.fn(),
    });
    mockUseTransitRepository.mockReturnValue(
      makeRepo({
        getRouteShapes: mockGetRouteShapes,
        getStopMetaByIds: vi.fn().mockReturnValue([]),
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(mockAppLayout).toHaveBeenCalled();
    });

    // onHistorySelect now lives on MapOverlay (Phase 1 refactor:
    // chrome extracted out of MapView). Capture from there.
    const lastOverlayCall = mockMapOverlay.mock.lastCall;
    expect(lastOverlayCall).toBeDefined();
    const overlayProps = lastOverlayCall![0] as {
      onHistorySelect: (entry: StopHistoryEntry) => void;
    };

    act(() => {
      overlayProps.onHistorySelect(entry);
    });

    await waitFor(() => {
      expect(recordStopSelection).toHaveBeenCalledWith(entry.snapshot);
    });
  });

  it('ignores history selection when current metadata is unavailable and the snapshot cannot rebuild a stop', async () => {
    const recordStopSelection = vi.fn();
    const entry: StopHistoryEntry = {
      snapshot: {
        stopId: 'A',
        name: 'Snapshot A',
        lat: null,
        lon: null,
        routeTypes: [3],
        agencyNames: [],
      },
      selectedAt: 1000,
    };
    mockUseStopHistory.mockReturnValue({
      history: [entry],
      recordStopSelection,
      lastError: null,
      clearError: vi.fn(),
      clearHistory: vi.fn(),
    });
    mockUseTransitRepository.mockReturnValue(
      makeRepo({
        getRouteShapes: mockGetRouteShapes,
        getStopMetaByIds: vi.fn().mockReturnValue([]),
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(mockAppLayout).toHaveBeenCalled();
    });

    // onHistorySelect now lives on MapOverlay (Phase 1 refactor:
    // chrome extracted out of MapView). Capture from there.
    const lastOverlayCall = mockMapOverlay.mock.lastCall;
    expect(lastOverlayCall).toBeDefined();
    const overlayProps = lastOverlayCall![0] as {
      onHistorySelect: (entry: StopHistoryEntry) => void;
    };

    act(() => {
      overlayProps.onHistorySelect(entry);
    });

    await waitFor(() => {
      expect(recordStopSelection).not.toHaveBeenCalled();
      expect(mockFocusStop).not.toHaveBeenCalled();
    });
  });

  // Phase 4 dialog controller wiring: verify that the `useAppDialogs`
  // hook is wired so the App-level cross-dialog flow (info -> data
  // source settings) and the keyboard-shortcut suppression contract
  // both still hold after the dialog open state was lifted out of
  // `App.tsx` into `useAppDialogs`.
  it('opens DataSourceSettingsDialog when InfoDialog requests it via onOpenDataSourceSettings', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockInfoDialog).toHaveBeenCalled();
      expect(mockDataSourceSettingsDialog).toHaveBeenCalled();
    });

    const initialInfoProps = mockInfoDialog.mock.lastCall?.[0] as {
      open: boolean;
      onOpenDataSourceSettings: () => void;
    };
    const initialDssProps = mockDataSourceSettingsDialog.mock.lastCall?.[0] as {
      open: boolean;
    };
    expect(initialInfoProps.open).toBe(false);
    expect(initialDssProps.open).toBe(false);

    act(() => {
      initialInfoProps.onOpenDataSourceSettings();
    });

    await waitFor(() => {
      const dssProps = mockDataSourceSettingsDialog.mock.lastCall?.[0] as { open: boolean };
      expect(dssProps.open).toBe(true);
    });
  });

  it('closes DataSourceSettingsDialog when its onOpenChange is called with false', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockInfoDialog).toHaveBeenCalled();
    });

    const infoProps = mockInfoDialog.mock.lastCall?.[0] as {
      onOpenDataSourceSettings: () => void;
    };
    act(() => {
      infoProps.onOpenDataSourceSettings();
    });

    await waitFor(() => {
      const dssProps = mockDataSourceSettingsDialog.mock.lastCall?.[0] as { open: boolean };
      expect(dssProps.open).toBe(true);
    });

    const openedDssProps = mockDataSourceSettingsDialog.mock.lastCall?.[0] as {
      onOpenChange: (open: boolean) => void;
    };
    act(() => {
      openedDssProps.onOpenChange(false);
    });

    await waitFor(() => {
      const dssProps = mockDataSourceSettingsDialog.mock.lastCall?.[0] as { open: boolean };
      expect(dssProps.open).toBe(false);
    });
  });

  it('suppresses keyboard shortcuts while InfoDialog is open and re-enables on close', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockUseKeyboardShortcuts).toHaveBeenCalled();
      expect(mockMapOverlay).toHaveBeenCalled();
    });

    const initialOptions = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
    expect(initialOptions.enabled).toBe(true);

    const overlayProps = mockMapOverlay.mock.lastCall?.[0] as { onInfoClick: () => void };
    act(() => {
      overlayProps.onInfoClick();
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(false);
    });

    const openedInfoProps = mockInfoDialog.mock.lastCall?.[0] as {
      onOpenChange: (open: boolean) => void;
    };
    act(() => {
      openedInfoProps.onOpenChange(false);
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(true);
    });
  });

  it('suppresses keyboard shortcuts while DataSourceSettingsDialog is open and re-enables on close', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockUseKeyboardShortcuts).toHaveBeenCalled();
      expect(mockInfoDialog).toHaveBeenCalled();
    });

    const infoProps = mockInfoDialog.mock.lastCall?.[0] as {
      onOpenDataSourceSettings: () => void;
    };
    act(() => {
      infoProps.onOpenDataSourceSettings();
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(false);
    });

    const openedDssProps = mockDataSourceSettingsDialog.mock.lastCall?.[0] as {
      onOpenChange: (open: boolean) => void;
    };
    act(() => {
      openedDssProps.onOpenChange(false);
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(true);
    });
  });

  it('suppresses keyboard shortcuts while StopSearchDialog is open and re-enables on close', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockUseKeyboardShortcuts).toHaveBeenCalled();
      expect(mockMapOverlay).toHaveBeenCalled();
    });

    const overlayProps = mockMapOverlay.mock.lastCall?.[0] as { onSearchClick: () => void };
    act(() => {
      overlayProps.onSearchClick();
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(false);
    });

    const searchProps = mockStopSearchDialog.mock.lastCall?.[0] as {
      onOpenChange: (open: boolean) => void;
    };
    act(() => {
      searchProps.onOpenChange(false);
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(true);
    });
  });

  it('suppresses keyboard shortcuts while ShortcutHelpDialog is open and re-enables on close', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockUseKeyboardShortcuts).toHaveBeenCalled();
    });

    // ShortcutHelpDialog has no UI trigger; the `?` keyboard shortcut is the
    // only entry point. Drive it via the captured `onOpenHelp` handler.
    const initialOptions = mockUseKeyboardShortcuts.mock.lastCall?.[0] as {
      enabled: boolean;
      handlers: { onOpenHelp: () => void };
    };
    expect(initialOptions.enabled).toBe(true);
    act(() => {
      initialOptions.handlers.onOpenHelp();
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(false);
    });

    const helpProps = mockShortcutHelpDialog.mock.lastCall?.[0] as {
      onOpenChange: (open: boolean) => void;
    };
    act(() => {
      helpProps.onOpenChange(false);
    });

    await waitFor(() => {
      const options = mockUseKeyboardShortcuts.mock.lastCall?.[0] as { enabled: boolean };
      expect(options.enabled).toBe(true);
    });
  });

  // Phase 4 third PR wiring: confirm that `routeShapes` resolved by
  // `useRouteShapes` actually reaches `MapView`. The hook itself is
  // unit-tested separately; this asserts the `App` -> MapView prop
  // flow so a missed prop / import would surface here.
  it('passes loaded route shapes down to MapView via useRouteShapes', async () => {
    const shapeFixture: RouteShape = {
      routeId: 'wiring-fixture-route',
      routeType: 3,
      color: '#3FB',
      route: null,
      points: [
        [35.0, 139.0],
        [35.1, 139.1],
      ],
    };
    mockGetRouteShapes.mockResolvedValue({
      success: true,
      data: [shapeFixture],
      truncated: false,
    });

    render(<App />);

    await waitFor(() => {
      const mapViewProps = mockMapView.mock.lastCall?.[0] as {
        routeShapes: RouteShape[];
      };
      expect(mapViewProps.routeShapes).toEqual([shapeFixture]);
    });
  });

  it('closes the search modal after a stop selection (handleSearchSelect path)', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockMapOverlay).toHaveBeenCalled();
      expect(mockStopSearchDialog).toHaveBeenCalled();
    });

    // Open via the overlay click path.
    const overlayProps = mockMapOverlay.mock.lastCall?.[0] as { onSearchClick: () => void };
    act(() => {
      overlayProps.onSearchClick();
    });

    await waitFor(() => {
      const searchProps = mockStopSearchDialog.mock.lastCall?.[0] as { open: boolean };
      expect(searchProps.open).toBe(true);
    });

    // Invoke the selection callback exactly like StopSearchDialog would when
    // the user picks a result. `handleSearchSelect` must close the modal as
    // a side effect.
    const openedSearchProps = mockStopSearchDialog.mock.lastCall?.[0] as {
      onSelectStop: (stop: ReturnType<typeof makeStop>, routeTypes: number[]) => void;
    };
    act(() => {
      openedSearchProps.onSelectStop(makeStop('search-target'), [3]);
    });

    await waitFor(() => {
      const searchProps = mockStopSearchDialog.mock.lastCall?.[0] as { open: boolean };
      expect(searchProps.open).toBe(false);
    });
  });

  it('passes the anchor toggle handler through to all App entry points', async () => {
    const handleToggleAnchorByStopId = vi.fn();
    mockUseAnchorToggle.mockReturnValue({
      handleToggleAnchorByStopId,
    });

    render(<App />);

    await waitFor(() => {
      const layoutProps = mockAppLayout.mock.lastCall?.[0] as {
        bottomSheetProps: {
          onToggleAnchor: typeof handleToggleAnchorByStopId;
        };
      };
      const mapOverlayProps = mockMapOverlay.mock.lastCall?.[0] as {
        onPortalRemove: (entry: { snapshot: { stopId: string } }) => void;
      };
      const stopSearchDialogProps = mockStopSearchDialog.mock.lastCall?.[0] as {
        onToggleAnchor: typeof handleToggleAnchorByStopId;
      };

      expect(layoutProps.bottomSheetProps.onToggleAnchor).toBe(handleToggleAnchorByStopId);
      expect(stopSearchDialogProps.onToggleAnchor).toBe(handleToggleAnchorByStopId);

      mapOverlayProps.onPortalRemove({ snapshot: { stopId: 'portal-stop' } });
      expect(handleToggleAnchorByStopId).toHaveBeenCalledWith('portal-stop');
    });
  });
});
