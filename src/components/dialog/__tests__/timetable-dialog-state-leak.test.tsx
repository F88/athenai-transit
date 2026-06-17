import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimetableDialog } from '../timetable-dialog';
import { getRouteHeadsignKey } from '@/domain/transit/get-route-headsign-key';
import type { GlobalFilter } from '@/types/app/global-filter';
import type { TimetableData } from '@/types/app/timetable';
import type { Route, Stop } from '@/types/app/transit';
import type { RouteDirection, TimetableEntry } from '@/types/app/transit-composed';

type MockDialogProps = { children: React.ReactNode; onOpenChange?: (open: boolean) => void };
type MockHeadsignFilterProps = {
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
};

const dialogProps = vi.fn<(props: MockDialogProps) => void>();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

vi.mock('@/hooks/use-info-level', () => ({
  useInfoLevel: () => ({
    isDetailedEnabled: true,
    isVerboseEnabled: false,
    isNormalEnabled: true,
    isSimpleEnabled: false,
  }),
}));

vi.mock('@/hooks/use-scroll-overflow', () => ({
  useScrollOverflow: () => ({
    update: vi.fn(),
    hasContentAbove: false,
    hasContentBelow: false,
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: (props: MockDialogProps) => {
    dialogProps(props);
    return <div>{props.children}</div>;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/shared/scroll-fade-edge', () => ({
  ScrollFadeEdge: () => null,
}));

vi.mock('@/components/verbose/verbose-timetable-summary', () => ({
  VerboseTimetableSummary: () => null,
}));

vi.mock('@/domain/transit/timetable-stats', () => ({
  computeTimetableEntryStats: () => ({
    totalCount: 0,
    position: { originCount: 0, terminalCount: 0, passingCount: 0 },
    boarding: {
      pickupTypeCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
      dropOffTypeCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
    },
    passenger: {
      boardableCount: 0,
      nonBoardableCount: 0,
      alightableCount: 0,
      nonAlightableCount: 0,
    },
    routeDirection: {
      routeCount: 0,
      directionCount: 0,
      tripHeadsignCount: 0,
      stopHeadsignCount: 0,
    },
    tripLocator: { patternCount: 0, serviceCount: 0, uniqueTripCount: 0 },
  }),
}));

vi.mock('@/components/filter/boardability-filter', () => ({
  BoardabilityFilter: () => null,
}));

vi.mock('@/components/filter/origin-filter', () => ({
  OriginFilter: () => null,
}));

vi.mock('@/components/timetable/timetable-grid', () => ({
  TimetableGrid: () => null,
}));

vi.mock('@/components/timetable/timetable-header', () => ({
  TimetableHeader: () => null,
}));

const headsignFilterProps = vi.fn<(props: MockHeadsignFilterProps) => void>();
vi.mock('@/components/timetable/timetable-headsign-filter', () => ({
  TimetableHeadsignFilter: (props: MockHeadsignFilterProps) => {
    headsignFilterProps(props);
    return null;
  },
}));

vi.mock('@/components/timetable/timetable-metadata', () => ({
  TimetableMetadata: () => null,
}));

function makeStop(id: string): Stop {
  return {
    stop_id: id,
    stop_name: id,
    stop_names: {},
    stop_lat: 0,
    stop_lon: 0,
    location_type: 0,
    agency_id: 'agency-1',
  };
}

function makeRoute(id: string): Route {
  return {
    route_id: id,
    route_short_name: id,
    route_long_name: id,
    route_short_names: {},
    route_long_names: {},
    route_type: 3,
    route_color: '',
    route_text_color: '',
    agency_id: 'agency-1',
  };
}

// Build a minimal `RouteDirection` whose `getEffectiveHeadsign` (and thus
// `getRouteHeadsignKey`) resolves to the given headsign string. Other
// `TimetableEntry` consumers in the dialog (filterTimetableEntries with
// `showFirstStopOnly` / `showBoardableOnly` both false in this suite) do not
// inspect this object, so only `route` + `tripHeadsign` need to be real.
function makeRouteDirection(route: Route, headsign: string): RouteDirection {
  return {
    route,
    tripHeadsign: { name: headsign, names: {} },
  };
}

// Build a minimal `TimetableEntry` whose `routeDirection` carries the given
// headsign. Cast through `unknown` because only the fields used by this
// suite (-> `presentHeadsignKeys = entries.map(getRouteHeadsignKey(...))`)
// are populated; the remaining structural fields are never read.
function makeEntry(route: Route, headsign: string): TimetableEntry {
  return {
    routeDirection: makeRouteDirection(route, headsign),
  } as unknown as TimetableEntry;
}

function makeData(overrides: Partial<TimetableData>): TimetableData {
  const stop = makeStop('stop-A');
  const route = makeRoute('route-1');
  return {
    type: 'stop',
    stop,
    routes: [route],
    referenceDateTime: new Date(2026, 3, 1, 8, 0),
    serviceDate: new Date(2026, 3, 1),
    timetableEntries: [makeEntry(route, '永福町')],
    omitted: { nonBoardable: 0 },
    stopServiceState: 'boardable',
    agencies: [
      {
        agency_id: 'agency-1',
        agency_name: 'Agency',
        agency_long_name: 'Agency',
        agency_short_name: 'A',
        agency_names: {},
        agency_long_names: {},
        agency_short_names: {},
        agency_url: '',
        agency_timezone: 'Asia/Tokyo',
        agency_lang: 'ja',
        agency_fare_url: '',
        agency_colors: [],
      },
    ],
    ...overrides,
  };
}

const globalFilter = {
  showOriginOnly: false,
  showBoardableOnly: false,
  omitEmptyStops: false,
  isOmitEmptyStopsForced: false,
  onToggleShowOriginOnly: vi.fn(),
  onToggleShowBoardableOnly: vi.fn(),
  onToggleOmitEmptyStops: vi.fn(),
} as unknown as GlobalFilter;

function getLastFilterProps(): {
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
} {
  const props = headsignFilterProps.mock.lastCall?.[0];
  if (!props) {
    throw new Error('TimetableHeadsignFilter was not rendered');
  }
  return props;
}

function getLastDialogProps(): { onOpenChange?: (open: boolean) => void } {
  const props = dialogProps.mock.lastCall?.[0];
  if (!props) {
    throw new Error('Dialog was not rendered');
  }
  return props;
}

describe('TimetableDialog activeFilters state leak', () => {
  beforeEach(() => {
    headsignFilterProps.mockReset();
    dialogProps.mockReset();
  });

  it('clears activeFilters when data is retargeted to a different mode for the same stop', () => {
    const stopData = makeData({ type: 'stop' });
    const routeHeadsignData = makeData({
      type: 'route-headsign',
      headsign: '永福町',
    });
    const headsignKey = getRouteHeadsignKey(stopData.timetableEntries[0].routeDirection);

    const props = {
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose: vi.fn(),
      onInspectTrip: vi.fn(),
      onChangeDateTime: vi.fn(),
    };

    const { rerender } = render(<TimetableDialog {...props} data={stopData} />);

    // 1. Initial state: activeFilters is empty.
    expect(getLastFilterProps().activeFilters).toEqual(new Set());

    // 2. Apply a filter by invoking the headsign filter's onToggleFilter callback
    //    (= what a chip click would do). The key must be the real
    //    `getRouteHeadsignKey(...)` output so it matches an entry's
    //    `routeDirection` and survives the `useReconcileIdSet` sync.
    act(() => {
      getLastFilterProps().onToggleFilter(headsignKey);
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set([headsignKey]));

    // 3. Retarget the dialog to route-headsign mode for the SAME stop.
    //    (`TimetableHeadsignFilter` is only rendered for `data.type === 'stop'`,
    //    so we cannot directly observe `activeFilters` in route-headsign mode.)
    rerender(<TimetableDialog {...props} data={routeHeadsignData} />);

    // 4. Retarget back to stop mode and verify the filter was cleared by the
    //    "Adjusting state on prop changes" reset, not silently leaked.
    rerender(<TimetableDialog {...props} data={stopData} />);
    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });

  it('keeps activeFilters across date change when the picked headsign still appears in the new entries', () => {
    // Same identity (type / stop_id / headsign) so the `dataIdentity` B-style
    // reset does not fire, AND the picked headsign is still represented in
    // the new date's entries -> `useReconcileIdSet` is a no-op, filter kept.
    const route = makeRoute('route-1');
    const initialData = makeData({
      type: 'stop',
      timetableEntries: [makeEntry(route, '永福町')],
    });
    const sameStopLaterDateSameRoutes = makeData({
      type: 'stop',
      referenceDateTime: new Date(2026, 3, 2, 8, 0),
      serviceDate: new Date(2026, 3, 2),
      timetableEntries: [makeEntry(route, '永福町')],
    });
    const headsignKey = getRouteHeadsignKey(initialData.timetableEntries[0].routeDirection);

    const props = {
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose: vi.fn(),
      onInspectTrip: vi.fn(),
      onChangeDateTime: vi.fn(),
    };

    const { rerender } = render(<TimetableDialog {...props} data={initialData} />);

    act(() => {
      getLastFilterProps().onToggleFilter(headsignKey);
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set([headsignKey]));

    rerender(<TimetableDialog {...props} data={sameStopLaterDateSameRoutes} />);

    expect(getLastFilterProps().activeFilters).toEqual(new Set([headsignKey]));
  });

  it('drops activeFilters keys that have left the entry population after a same-identity data update', () => {
    // Same identity (type / stop_id / headsign) so the `dataIdentity` reset
    // does NOT fire. The new entries no longer contain the picked headsign
    // (e.g. a different timetable on a different date) -> `useReconcileIdSet`
    // removes it in the same render so a "no clickable pill but filter on"
    // dead-end never appears.
    const route = makeRoute('route-1');
    const initialData = makeData({
      type: 'stop',
      timetableEntries: [makeEntry(route, '永福町')],
    });
    const sameStopLaterDateDifferentHeadsigns = makeData({
      type: 'stop',
      referenceDateTime: new Date(2026, 3, 2, 8, 0),
      serviceDate: new Date(2026, 3, 2),
      timetableEntries: [makeEntry(route, '新宿')],
    });
    const headsignKey = getRouteHeadsignKey(initialData.timetableEntries[0].routeDirection);

    const props = {
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose: vi.fn(),
      onInspectTrip: vi.fn(),
      onChangeDateTime: vi.fn(),
    };

    const { rerender } = render(<TimetableDialog {...props} data={initialData} />);

    act(() => {
      getLastFilterProps().onToggleFilter(headsignKey);
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set([headsignKey]));

    rerender(<TimetableDialog {...props} data={sameStopLaterDateDifferentHeadsigns} />);

    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });

  it('clears activeFilters when the stop changes within stop mode', () => {
    const stopAData = makeData({
      type: 'stop',
      stop: makeStop('stop-A'),
    });
    const stopBData = makeData({
      type: 'stop',
      stop: makeStop('stop-B'),
    });
    const headsignKey = getRouteHeadsignKey(stopAData.timetableEntries[0].routeDirection);

    const props = {
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose: vi.fn(),
      onInspectTrip: vi.fn(),
      onChangeDateTime: vi.fn(),
    };

    const { rerender } = render(<TimetableDialog {...props} data={stopAData} />);

    act(() => {
      getLastFilterProps().onToggleFilter(headsignKey);
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set([headsignKey]));

    rerender(<TimetableDialog {...props} data={stopBData} />);

    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });

  it('clears activeFilters when retargeted between colon-containing stop identities', () => {
    const colonStopData = makeData({
      type: 'stop',
      stop: makeStop('tmm:101'),
      headsign: undefined,
    });
    const routeHeadsignData = makeData({
      type: 'route-headsign',
      stop: makeStop('tmm'),
      headsign: '101:',
    });
    const headsignKey = getRouteHeadsignKey(colonStopData.timetableEntries[0].routeDirection);

    const props = {
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose: vi.fn(),
      onInspectTrip: vi.fn(),
      onChangeDateTime: vi.fn(),
    };

    const { rerender } = render(<TimetableDialog {...props} data={colonStopData} />);

    act(() => {
      getLastFilterProps().onToggleFilter(headsignKey);
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set([headsignKey]));

    rerender(<TimetableDialog {...props} data={routeHeadsignData} />);
    rerender(<TimetableDialog {...props} data={colonStopData} />);

    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });

  it('clears activeFilters when the dialog closes', () => {
    const stopData = makeData({ type: 'stop' });
    const headsignKey = getRouteHeadsignKey(stopData.timetableEntries[0].routeDirection);
    const onClose = vi.fn();

    const props = {
      infoLevel: 'detailed' as const,
      dataLangs: ['ja'] as const,
      globalFilter,
      onClose,
      onInspectTrip: vi.fn(),
      onChangeDateTime: vi.fn(),
    };

    render(<TimetableDialog {...props} data={stopData} />);

    act(() => {
      getLastFilterProps().onToggleFilter(headsignKey);
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set([headsignKey]));

    act(() => {
      getLastDialogProps().onOpenChange?.(false);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });
});
