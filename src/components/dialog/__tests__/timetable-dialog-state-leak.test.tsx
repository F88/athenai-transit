import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimetableDialog } from '../timetable-dialog';
import type { GlobalFilter } from '@/types/app/global-filter';
import type { TimetableData } from '@/types/app/timetable';
import type { Route, Stop } from '@/types/app/transit';

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
    originCount: 0,
    terminalCount: 0,
    boardableCount: 0,
    nonBoardableCount: 0,
    noPickupCount: 0,
    noDropOffCount: 0,
    dropOffOnlyCount: 0,
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

function makeData(overrides: Partial<TimetableData>): TimetableData {
  const stop = makeStop('stop-A');
  const route = makeRoute('route-1');
  return {
    type: 'stop',
    stop,
    routes: [route],
    referenceDateTime: new Date(2026, 3, 1, 8, 0),
    serviceDate: new Date(2026, 3, 1),
    timetableEntries: [],
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
    //    (= what a chip click would do).
    act(() => {
      getLastFilterProps().onToggleFilter('永福町');
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set(['永福町']));

    // 3. Retarget the dialog to route-headsign mode for the SAME stop.
    //    (`TimetableHeadsignFilter` is only rendered for `data.type === 'stop'`,
    //    so we cannot directly observe `activeFilters` in route-headsign mode.)
    rerender(<TimetableDialog {...props} data={routeHeadsignData} />);

    // 4. Retarget back to stop mode and verify the filter was cleared by the
    //    "Adjusting state on prop changes" reset, not silently leaked.
    rerender(<TimetableDialog {...props} data={stopData} />);
    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });

  it('keeps activeFilters when only the date changes for the same stop and mode', () => {
    // Same identity (type / stop_id / headsign) = filter must be preserved.
    const initialData = makeData({ type: 'stop' });
    const sameStopLaterDate = makeData({
      type: 'stop',
      referenceDateTime: new Date(2026, 3, 2, 8, 0),
      serviceDate: new Date(2026, 3, 2),
    });

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
      getLastFilterProps().onToggleFilter('永福町');
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set(['永福町']));

    rerender(<TimetableDialog {...props} data={sameStopLaterDate} />);

    // Date changed, but (type, stop_id, headsign) are unchanged -> filter kept.
    expect(getLastFilterProps().activeFilters).toEqual(new Set(['永福町']));
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
      getLastFilterProps().onToggleFilter('永福町');
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set(['永福町']));

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
      getLastFilterProps().onToggleFilter('永福町');
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set(['永福町']));

    rerender(<TimetableDialog {...props} data={routeHeadsignData} />);
    rerender(<TimetableDialog {...props} data={colonStopData} />);

    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });

  it('clears activeFilters when the dialog closes', () => {
    const stopData = makeData({ type: 'stop' });
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
      getLastFilterProps().onToggleFilter('永福町');
    });
    expect(getLastFilterProps().activeFilters).toEqual(new Set(['永福町']));

    act(() => {
      getLastDialogProps().onOpenChange?.(false);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getLastFilterProps().activeFilters).toEqual(new Set());
  });
});
