import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agency, Route, Stop } from '@/types/app/transit';
import type { TransitRepository } from '@/repositories/transit-repository';
import type {
  SelectedTripSnapshot,
  TimetableEntry,
  TripInspectionTarget,
  TripStopTime,
} from '@/types/app/transit-composed';

const { computeTimetableEntryStatsMock, tripStopsRenderMock, useTranslationMock } = vi.hoisted(
  () => ({
    computeTimetableEntryStatsMock: vi.fn(),
    tripStopsRenderMock: vi.fn(),
    useTranslationMock: vi.fn(),
  }),
);

vi.mock('react-i18next', () => ({
  useTranslation: useTranslationMock,
}));

vi.mock('@/hooks/use-info-level', () => ({
  useInfoLevel: () => ({
    isSimpleEnabled: true,
    isNormalEnabled: true,
    isDetailedEnabled: true,
    isVerboseEnabled: false,
  }),
}));

vi.mock('@/hooks/use-scroll-fades', () => ({
  useScrollFades: () => ({
    showTop: false,
    showBottom: false,
    handleScroll: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-is-low-contrast-against-theme', () => ({
  useThemeContrastAssessment: () => ({
    isLowContrast: false,
    ratio: 10,
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/shared/scroll-fade-edge', () => ({
  ScrollFadeEdge: () => null,
}));

vi.mock('@/components/verbose/verbose-timetable-summary', () => ({
  VerboseTimetableSummary: () => null,
}));

vi.mock('@/domain/transit/timetable-stats', () => ({
  computeTimetableEntryStats: computeTimetableEntryStatsMock,
}));

vi.mock('../filter/boardability-filter', () => ({
  BoardabilityFilter: () => null,
}));

vi.mock('../filter/origin-filter', () => ({
  OriginFilter: () => null,
}));

vi.mock('../timetable/timetable-grid', () => ({
  TimetableGrid: () => null,
}));

vi.mock('../timetable/timetable-header', () => ({
  TimetableHeader: () => null,
}));

vi.mock('../timetable/timetable-headsign-filter', () => ({
  TimetableHeadsignFilter: () => null,
}));

vi.mock('../timetable/timetable-metadata', () => ({
  TimetableMetadata: () => null,
}));

vi.mock('@/components/journey-time-bar', () => ({
  JourneyTimeBar: () => null,
}));

vi.mock('@/components/stop-info', () => ({
  StopInfo: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock('@/domain/transit/color-resolver/route-colors', () => ({
  resolveRouteColors: () => ({ routeColor: '#112233' }),
  getContrastAdjustedRouteColors: () => ({ color: '#112233', textColor: '#ffffff' }),
}));

vi.mock('@/domain/transit/get-headsign-display-names', () => ({
  getHeadsignDisplayNames: () => ({ resolved: { name: 'Headsign' } }),
}));

vi.mock('@/domain/transit/get-stop-display-names', () => ({
  getStopDisplayNames: () => ({ name: 'Stop Name', subNames: [] }),
}));

vi.mock('@/domain/transit/journey-time', () => ({
  deriveJourneyTimeFromTrip: () => ({ totalMinutes: 20, remainingMinutes: 10 }),
}));

vi.mock('@/domain/transit/time', () => ({
  formatAbsoluteTime: () => '08:00',
}));

vi.mock('@/domain/transit/trip-stop-times', () => ({
  getOriginStop: (stopTimes: TripStopTime[]) => stopTimes[0],
  getTerminalStop: (stopTimes: TripStopTime[]) => stopTimes[stopTimes.length - 1],
}));

vi.mock('@/utils/color/contrast-alpha-suffixes', () => ({
  getContrastAwareAlphaSuffixes: () => ({
    subtleAlphaSuffix: '33',
    emphasisAlphaSuffix: '66',
  }),
}));

vi.mock('../badge/id-badge', () => ({
  IdBadge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../label/trip-position-indicator', () => ({
  TripPositionIndicator: () => null,
}));

vi.mock('../trip/trip-basic-info', () => ({
  TripBasicInfo: () => null,
}));

vi.mock('../trip/trip-stop-row-dom', () => ({
  findTripStopRow: () => null,
}));

vi.mock('../trip/trip-stop-scroll', () => ({
  computeScrolledStopIndex: () => null,
  getSelectedRowScrollTop: () => 0,
}));

vi.mock('../trip/trip-stops', () => ({
  TripStops: (props: unknown) => {
    tripStopsRenderMock(props);
    return null;
  },
}));

vi.mock('../trip/trip-pager', () => ({
  TripPager: () => null,
}));

vi.mock('../verbose/verbose-trip-locator', () => ({
  VerboseTripLocator: () => null,
}));

vi.mock('../verbose/verbose-trip-stop-time', () => ({
  VerboseTripStopTime: () => null,
}));

import { TimetableModal, type TimetableData } from './timetable-modal';
import { StopSearchModal } from './stop-search-modal';
import { TripInspectionDialog } from './trip-inspection-dialog';

function makeRoute(id: string): Route {
  return {
    route_id: id,
    route_short_name: id,
    route_short_names: {},
    route_long_name: id,
    route_long_names: {},
    route_type: 3,
    route_color: '112233',
    route_text_color: 'ffffff',
    agency_id: 'agency-1',
  };
}

function makeStop(id: string): Stop {
  return {
    stop_id: id,
    stop_name: id,
    stop_names: {},
    stop_lat: 35,
    stop_lon: 139,
    location_type: 0,
    agency_id: 'agency-1',
  };
}

function makeTimetableEntry(overrides: Partial<TimetableEntry> = {}): TimetableEntry {
  const route = makeRoute('route-1');
  return {
    tripLocator: { patternId: 'pattern-1', serviceId: 'weekday', tripIndex: 0 },
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route,
      tripHeadsign: { name: 'Headsign', names: {} },
      direction: 0,
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: { stopIndex: 0, totalStops: 3, isOrigin: true, isTerminal: false },
    ...overrides,
  };
}

function makeTimetableData(): TimetableData {
  const route = makeRoute('route-1');
  const stop = makeStop('stop-1');
  const agencies: Agency[] = [
    {
      agency_id: 'agency-1',
      agency_name: 'Agency 1',
      agency_long_name: 'Agency 1',
      agency_short_name: 'A1',
      agency_names: {},
      agency_long_names: {},
      agency_short_names: {},
      agency_url: '',
      agency_timezone: 'Asia/Tokyo',
      agency_lang: 'ja',
      agency_fare_url: '',
      agency_colors: [],
    },
  ];
  return {
    type: 'stop',
    stop,
    routes: [route],
    serviceDate: new Date(2026, 3, 1),
    timetableEntries: [makeTimetableEntry()],
    omitted: { nonBoardable: 0 },
    stopServiceState: 'boardable',
    agencies,
  };
}

function makeTripSnapshot(): SelectedTripSnapshot {
  const route = makeRoute('route-1');
  const stop = makeStop('stop-1');
  const timetableEntry = makeTimetableEntry({
    patternPosition: { stopIndex: 0, totalStops: 1, isOrigin: true, isTerminal: true },
  });
  const tripStopTime: TripStopTime = {
    stopMeta: { stop, distance: 0, agencies: [], routes: [] },
    routeTypes: [3],
    timetableEntry,
  };
  return {
    locator: { patternId: 'pattern-1', serviceId: 'weekday', tripIndex: 0 },
    route,
    tripHeadsign: { name: 'Headsign', names: {} },
    direction: 0,
    stopTimes: [tripStopTime],
    currentStopIndex: 0,
    selectedStop: tripStopTime,
    serviceDate: new Date(2026, 3, 1),
  };
}

function makeRepo(): TransitRepository {
  return {
    getAllStops: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getRouteTypesForStop: vi.fn().mockResolvedValue({ success: true, data: [3] }),
  } as unknown as TransitRepository;
}

beforeEach(() => {
  useTranslationMock.mockReset();
  useTranslationMock.mockReturnValue({
    t: (key: string) => key,
    i18n: { language: 'en' },
  });
  computeTimetableEntryStatsMock.mockReset();
  computeTimetableEntryStatsMock.mockReturnValue({
    totalCount: 1,
    originCount: 1,
    terminalCount: 0,
    passingCount: 0,
    boardableCount: 1,
    nonBoardableCount: 0,
    dropOffOnlyCount: 0,
    noDropOffCount: 0,
    routeCount: 1,
    directionCount: 1,
    tripHeadsignCount: 1,
    stopHeadsignCount: 1,
    patternCount: 1,
    serviceCount: 1,
    uniqueTripCount: 1,
  });
  tripStopsRenderMock.mockReset();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dialog memoization regressions', () => {
  it('TimetableModal skips stats recomputation when only time changes', () => {
    const data = makeTimetableData();
    const globalFilter = {
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
      isOmitEmptyStopsForced: false,
      onToggleShowOriginOnly: vi.fn(),
      onToggleShowBoardableOnly: vi.fn(),
      onToggleOmitEmptyStops: vi.fn(),
    };
    const props = {
      data,
      time: new Date(2026, 3, 1, 8, 0),
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose: vi.fn(),
      onInspectTrip: vi.fn(),
    };

    const { rerender } = render(<TimetableModal {...props} />);

    expect(computeTimetableEntryStatsMock).toHaveBeenCalledTimes(2);

    rerender(<TimetableModal {...props} />);

    expect(computeTimetableEntryStatsMock).toHaveBeenCalledTimes(2);

    rerender(<TimetableModal {...props} time={new Date(2026, 3, 1, 8, 1)} />);

    expect(computeTimetableEntryStatsMock).toHaveBeenCalledTimes(2);

    const nextGlobalFilter = {
      ...globalFilter,
      showBoardableOnly: true,
    };
    rerender(<TimetableModal {...props} globalFilter={nextGlobalFilter} />);

    expect(computeTimetableEntryStatsMock).toHaveBeenCalledTimes(4);
  });

  it('TimetableModal skips stats recomputation when only omitEmptyStops changes', () => {
    const data = makeTimetableData();
    const globalFilter = {
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
      isOmitEmptyStopsForced: false,
      onToggleShowOriginOnly: vi.fn(),
      onToggleShowBoardableOnly: vi.fn(),
      onToggleOmitEmptyStops: vi.fn(),
    };
    const props = {
      data,
      time: new Date(2026, 3, 1, 8, 0),
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose: vi.fn(),
      onInspectTrip: vi.fn(),
    };

    const { rerender } = render(<TimetableModal {...props} />);

    expect(computeTimetableEntryStatsMock).toHaveBeenCalledTimes(2);

    const nextGlobalFilter = {
      ...globalFilter,
      omitEmptyStops: true,
      isOmitEmptyStopsForced: true,
      onToggleOmitEmptyStops: vi.fn(),
    };
    rerender(<TimetableModal {...props} globalFilter={nextGlobalFilter} />);

    expect(computeTimetableEntryStatsMock).toHaveBeenCalledTimes(2);
  });

  it('TripInspectionDialog skips TripStops rerender when props are identical', () => {
    const snapshot = makeTripSnapshot();
    const tripInspectionTargets: TripInspectionTarget[] = [
      {
        tripLocator: snapshot.locator,
        stopIndex: 0,
        departureMinutes: 480,
        serviceDate: snapshot.serviceDate,
      },
    ];
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      snapshot,
      tripInspectionTargets,
      currentTripInspectionTargetIndex: 0,
      now: new Date(2026, 3, 1, 8, 0),
      infoLevel: 'normal' as const,
      dataLangs: ['ja'] as const,
      onOpenPreviousTrip: vi.fn(),
      onOpenNextTrip: vi.fn(),
    };

    const { rerender } = render(<TripInspectionDialog {...props} />);
    const initialRenderCount = tripStopsRenderMock.mock.calls.length;

    expect(initialRenderCount).toBeGreaterThan(0);

    rerender(<TripInspectionDialog {...props} />);

    expect(tripStopsRenderMock).toHaveBeenCalledTimes(initialRenderCount);

    rerender(<TripInspectionDialog {...props} now={new Date(2026, 3, 1, 8, 1)} />);

    expect(tripStopsRenderMock).toHaveBeenCalledTimes(initialRenderCount + 1);
  });

  it('StopSearchModal skips rerender when props are identical', () => {
    const repo = makeRepo();
    const props = {
      repo,
      infoLevel: 'normal' as const,
      dataLang: ['ja'] as const,
      onSelectStop: vi.fn(),
      open: false,
      onOpenChange: vi.fn(),
    };

    const { rerender } = render(<StopSearchModal {...props} />);
    const initialRenderCount = useTranslationMock.mock.calls.length;

    expect(initialRenderCount).toBeGreaterThan(0);

    rerender(<StopSearchModal {...props} />);

    expect(useTranslationMock).toHaveBeenCalledTimes(initialRenderCount);

    rerender(<StopSearchModal {...props} infoLevel={'detailed'} />);

    expect(useTranslationMock).toHaveBeenCalledTimes(initialRenderCount + 1);
  });
});
