import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import App from '../app';
import type { UseAnchorsReturn } from '../hooks/use-anchors';
import type { UseTimetableReturn } from '../hooks/use-timetable';
import type { ContextualTimetableEntry, StopWithContext } from '../types/app/transit-composed';

type UseDateTimeReturn = ReturnType<typeof import('../hooks/use-date-time').useDateTime>;
type UseNearbyStopTimesReturn = ReturnType<
  typeof import('../hooks/use-nearby-stop-times').useNearbyStopTimes
>;
type GetServiceDayMinutes = typeof import('../domain/transit/service-day').getServiceDayMinutes;

const {
  mockToastError,
  mockToastWarning,
  mockUseAnchors,
  mockGetRouteShapes,
  mockClearAnchorError,
  mockGetServiceDayMinutes,
  mockUseDateTime,
  mockUseNearbyStopTimes,
  mockMapBottomSheetLayout,
  mockUseTimetable,
  mockOpenStopTimetable,
  mockOpenRouteHeadsignTimetable,
} = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
  mockUseAnchors: vi.fn<(...args: unknown[]) => UseAnchorsReturn>(),
  mockGetRouteShapes: vi.fn(),
  mockClearAnchorError: vi.fn(),
  mockGetServiceDayMinutes: vi.fn<GetServiceDayMinutes>(),
  mockUseDateTime: vi.fn<() => UseDateTimeReturn>(),
  mockUseNearbyStopTimes: vi.fn<() => UseNearbyStopTimesReturn>(),
  mockMapBottomSheetLayout: vi.fn(),
  mockUseTimetable: vi.fn<() => UseTimetableReturn>(),
  mockOpenStopTimetable: vi.fn(),
  mockOpenRouteHeadsignTimetable: vi.fn(),
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
  useTransitRepository: () => ({
    getRouteShapes: mockGetRouteShapes,
  }),
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
    focusStop: vi.fn(),
    clearFocus: vi.fn(),
  }),
}));

vi.mock('../hooks/use-stop-history', () => ({
  useStopHistory: () => ({
    history: [],
    pushStop: vi.fn(),
  }),
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
  MapView: () => null,
}));

vi.mock('../components/map-bottom-sheet-layout', () => ({
  MapBottomSheetLayout: (props: unknown) => {
    mockMapBottomSheetLayout(props);
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
    const lastCall = mockMapBottomSheetLayout.mock.lastCall;
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
    mockMapBottomSheetLayout.mockReset();
    mockUseTimetable.mockReset();
    mockOpenStopTimetable.mockReset();
    mockOpenRouteHeadsignTimetable.mockReset();

    mockGetRouteShapes.mockResolvedValue({ success: true, data: [] });
    mockUseAnchors.mockReturnValue({
      anchors: [],
      lastError: null,
      clearError: mockClearAnchorError,
      addStop: vi.fn(),
      removeStop: vi.fn(),
      updateStop: vi.fn(),
      batchUpdateStops: vi.fn(),
      isStopAnchor: vi.fn(() => false),
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
      addStop: vi.fn(),
      removeStop: vi.fn(),
      updateStop: vi.fn(),
      batchUpdateStops: vi.fn(),
      isStopAnchor: vi.fn(() => false),
    });

    render(<App loadResult={{ loaded: [], failed: [] }} />);

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
      addStop: vi.fn(),
      removeStop: vi.fn(),
      updateStop: vi.fn(),
      batchUpdateStops: vi.fn(),
      isStopAnchor: vi.fn(() => false),
    });

    render(<App loadResult={{ loaded: [], failed: [] }} />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('アンカー更新に失敗しました', {
        description: 'Duplicate stop: A',
        duration: 4500,
      });
      expect(mockClearAnchorError).toHaveBeenCalledTimes(1);
    });
  });

  it('forces omitEmptyStops on for origin filter and keeps toggleOmitEmptyStops as a no-op while forced', async () => {
    mockUseNearbyStopTimes.mockReturnValue({
      stopTimes: [
        makeNearbyStop('origin-stop', [makeEntry({ isOrigin: true })]),
        makeNearbyStop('middle-stop', [makeEntry({ isOrigin: false })]),
      ],
      isNearbyLoading: false,
    });

    render(<App loadResult={{ loaded: [], failed: [] }} />);

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

    render(<App loadResult={{ loaded: [], failed: [] }} />);

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

    render(<App loadResult={{ loaded: [], failed: [] }} />);

    await waitFor(() => {
      expect(mockMapBottomSheetLayout).toHaveBeenCalled();
    });

    const lastCall = mockMapBottomSheetLayout.mock.lastCall;
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

    render(<App loadResult={{ loaded: [], failed: [] }} />);

    await waitFor(() => {
      expect(mockMapBottomSheetLayout).toHaveBeenCalled();
    });

    const lastCall = mockMapBottomSheetLayout.mock.lastCall;
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
});
