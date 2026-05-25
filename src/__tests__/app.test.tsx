import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import App from '../app';
import { RootErrorBoundary } from '../components/error-boundary';
import { makeRepo, makeRoute, makeStop, makeStopMeta } from './helpers';
import type { StopHistoryEntry } from '../domain/transit/stop-history';
import type { UseStopHistoryReturn } from '../hooks/use-stop-history';
import type { UseAnchorsReturn } from '../hooks/use-anchors';
import type { TransitRepository } from '../repositories/transit-repository';
import type { UseTimetableReturn } from '../hooks/use-timetable';
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
  mockUseTimetable,
  mockOpenStopTimetable,
  mockOpenRouteHeadsignTimetable,
  mockUseLoadResult,
} = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
  mockUseAnchors: vi.fn<(...args: unknown[]) => UseAnchorsReturn>(),
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

vi.mock('../components/dialog/timetable-modal', () => ({
  TimetableModal: () => null,
}));

vi.mock('../components/dialog/stop-search-dialog', () => ({
  StopSearchDialog: () => null,
}));

vi.mock('../components/dialog/info-dialog', () => ({
  InfoDialog: () => null,
}));

vi.mock('../components/dialog/data-source-settings-dialog', () => ({
  DataSourceSettingsDialog: () => null,
}));

describe('App anchor error toast', () => {
  const makeEntry = (
    overrides: { isOrigin?: boolean; isTerminal?: boolean; pickupType?: 0 | 1 | 2 | 3 } = {},
  ): ContextualTimetableEntry =>
    ({
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
    }) as ContextualTimetableEntry;

  const makeNearbyStop = (
    stopId: string,
    entries: ContextualTimetableEntry[],
    stopServiceState: StopWithContext['stopServiceState'] = 'boardable',
  ): StopWithContext =>
    ({
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
    }) as StopWithContext;

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
    mockUseDateTime.mockReturnValue({
      dateTime: new Date('2026-03-28T12:00:00Z'),
      isCustomTime: false,
      resetToNow: vi.fn(),
      setCustomTime: vi.fn(),
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
      expect(mockToastError).toHaveBeenCalledWith('アンカー更新に失敗しました', {
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
      expect(mockToastError).toHaveBeenCalledWith('履歴の保存に失敗しました', {
        description: 'Quota exceeded',
        duration: 2000,
      });
      expect(clearHistoryError).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the error boundary fallback when localStorage getter throws during app init', async () => {
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

      await waitFor(() => {
        expect(screen.getByText('問題が発生しました')).toBeInTheDocument();
        expect(
          screen.getByText(
            'アプリの表示中にエラーが発生しました。再読み込みで回復しない場合は、キャッシュを消去してお試しください。',
          ),
        ).toBeInTheDocument();
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      }
      consoleErrorSpy.mockRestore();
    }
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
    const overlayProps = lastOverlayCall?.[0] as {
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
    const overlayProps = lastOverlayCall?.[0] as {
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
    const overlayProps = lastOverlayCall?.[0] as {
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
});
