import { render } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimetableContainer, type TimetableContainerHandle } from '../timetable-container';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { GlobalFilter } from '@/types/app/global-filter';
import type { TimetableData } from '@/types/app/timetable';
import type { Route, Stop } from '@/types/app/transit';

type TimetableDialogMockProps = {
  data: TimetableData | null;
  infoLevel: 'detailed' | 'verbose' | 'normal' | 'simple';
  dataLangs: readonly string[];
  globalFilter: GlobalFilter;
  onInspectTrip?: (target: unknown) => void;
  onChangeDateTime: (dateTime: Date) => void;
  onClose: () => void;
};

// `vi.mock` calls are hoisted above top-level `const` declarations, so the
// mocks have to grab their shared fns via `vi.hoisted` instead of closing
// over locally-declared `vi.fn()`s (which would still be uninitialized when
// the mock factory runs).
const { timetableDialogProps, useTimetableMock } = vi.hoisted(() => ({
  timetableDialogProps: vi.fn<(props: TimetableDialogMockProps) => void>(),
  useTimetableMock: vi.fn(),
}));

vi.mock('@/components/dialog/timetable-dialog', () => ({
  TimetableDialog: (props: TimetableDialogMockProps) => {
    timetableDialogProps(props);
    return null;
  },
}));

vi.mock('@/hooks/use-timetable', () => ({
  useTimetable: useTimetableMock,
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

const repo = {} as TransitRepository;

function getLastTimetableDialogProps(): TimetableDialogMockProps {
  const props = timetableDialogProps.mock.lastCall?.[0];
  if (!props) {
    throw new Error('TimetableDialog was not rendered');
  }
  return props;
}

describe('TimetableContainer', () => {
  const openStopTimetable = vi.fn().mockResolvedValue({ status: 'opened' });
  const openRouteHeadsignTimetable = vi.fn().mockResolvedValue({ status: 'opened' });
  const changeDateTime = vi.fn().mockResolvedValue({ status: 'opened' });
  const closeTimetable = vi.fn();

  let currentTimetableData: TimetableData | null = null;

  beforeEach(() => {
    timetableDialogProps.mockReset();
    useTimetableMock.mockReset();
    openStopTimetable.mockClear();
    openRouteHeadsignTimetable.mockClear();
    changeDateTime.mockClear();
    closeTimetable.mockClear();
    currentTimetableData = null;
    useTimetableMock.mockImplementation(() => ({
      timetableData: currentTimetableData,
      openStopTimetable,
      openRouteHeadsignTimetable,
      changeDateTime,
      closeTimetable,
    }));
  });

  it('exposes open methods via ref', () => {
    const containerRef = createRef<TimetableContainerHandle>();
    render(
      <TimetableContainer
        ref={containerRef}
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
      />,
    );
    expect(containerRef.current?.openStopTimetable).toBe(openStopTimetable);
    expect(containerRef.current?.openRouteHeadsignTimetable).toBe(openRouteHeadsignTimetable);
  });

  it('renders the dialog with `data: null` when no timetable is open', () => {
    render(
      <TimetableContainer
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
      />,
    );
    const lastProps = getLastTimetableDialogProps();
    expect(lastProps.data).toBeNull();
  });

  it('flows new data into the dialog when the same stop is re-targeted from stop to route-headsign mode', () => {
    const stopData = makeData({ type: 'stop' });
    const routeHeadsignData = makeData({
      type: 'route-headsign',
      headsign: '永福町',
    });

    const { rerender } = render(
      <TimetableContainer
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
      />,
    );

    currentTimetableData = stopData;
    rerender(
      <TimetableContainer
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
      />,
    );
    const afterStop = getLastTimetableDialogProps();
    expect(afterStop.data).toBe(stopData);

    currentTimetableData = routeHeadsignData;
    rerender(
      <TimetableContainer
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
      />,
    );
    const afterRouteHeadsign = getLastTimetableDialogProps();
    expect(afterRouteHeadsign.data).toBe(routeHeadsignData);
    expect(afterRouteHeadsign.data?.type).toBe('route-headsign');
    expect(afterRouteHeadsign.data?.stop.stop_id).toBe('stop-A');
    expect(afterRouteHeadsign.data?.headsign).toBe('永福町');
  });

  it('notifies the parent via onOpenChange when timetableData transitions between null and non-null', () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <TimetableContainer
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
        onOpenChange={onOpenChange}
      />,
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    currentTimetableData = makeData({ type: 'stop' });
    rerender(
      <TimetableContainer
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
        onOpenChange={onOpenChange}
      />,
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    currentTimetableData = null;
    rerender(
      <TimetableContainer
        repo={repo}
        infoLevel="detailed"
        dataLangs={['ja']}
        globalFilter={globalFilter}
        onOpenChange={onOpenChange}
      />,
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
