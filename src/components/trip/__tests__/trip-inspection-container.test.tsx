import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TripInspectionContainer,
  type TripInspectionContainerHandle,
} from '../trip-inspection-container';
import { getServiceDay } from '@/domain/transit/service-day';
import { getTripInspectionOpenOutcomeMessage } from '@/domain/transit/trip-inspection-message';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { InfoLevel } from '@/types/app/settings';
import type { SelectedTripSnapshot, TripInspectionTarget } from '@/types/app/transit-composed';

type TripInspectionDialogMockProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SelectedTripSnapshot | null;
  tripInspectionTargets: TripInspectionTarget[];
  currentTripInspectionTargetIndex: number;
  showNoticeNonce: number;
  now: Date;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  onOpenPreviousTrip: () => void;
  onOpenNextTrip: () => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
  onSelectStopById?: (stopId: string) => void;
};

const { tripInspectionDialogProps, useTripInspectionMock, showOpenOutcomeToastMock, tMock } =
  vi.hoisted(() => ({
    tripInspectionDialogProps: vi.fn<(props: TripInspectionDialogMockProps) => void>(),
    useTripInspectionMock: vi.fn(),
    showOpenOutcomeToastMock: vi.fn(),
    tMock: vi.fn((key: string) => key),
  }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: tMock }),
}));

vi.mock('@/components/dialog/trip-inspection-dialog', () => ({
  TripInspectionDialog: (props: TripInspectionDialogMockProps) => {
    tripInspectionDialogProps(props);
    return null;
  },
}));

vi.mock('@/hooks/use-trip-inspection', () => ({
  useTripInspection: useTripInspectionMock,
}));

vi.mock('@/lib/open-outcome-toast', () => ({
  showOpenOutcomeToast: showOpenOutcomeToastMock,
}));

const repo = {} as TransitRepository;

function makeTarget(overrides: Partial<TripInspectionTarget> = {}): TripInspectionTarget {
  return {
    tripLocator: {
      patternId: 'pattern-a',
      serviceId: 'weekday',
      tripIndex: 0,
    },
    serviceDate: new Date(2026, 4, 31),
    stopIndex: 2,
    departureMinutes: 8 * 60,
    ...overrides,
  };
}

function makeSnapshot(): SelectedTripSnapshot {
  return {
    locator: {
      patternId: 'pattern-a',
      serviceId: 'weekday',
      tripIndex: 0,
    },
    route: {
      route_id: 'route-1',
      route_short_name: '1',
      route_short_names: {},
      route_long_name: 'Route 1',
      route_long_names: {},
      route_type: 3,
      route_color: '000000',
      route_text_color: 'FFFFFF',
      agency_id: 'agency-1',
    },
    tripHeadsign: { name: 'Terminal', names: {} },
    serviceDate: new Date(2026, 4, 31),
    stopTimes: [],
    selectedStop: {
      routeTypes: [],
      timetableEntry: {
        tripLocator: {
          patternId: 'pattern-a',
          serviceId: 'weekday',
          tripIndex: 0,
        },
        schedule: { departureMinutes: 8 * 60, arrivalMinutes: 8 * 60 },
        routeDirection: {
          route: {
            route_id: 'route-1',
            route_short_name: '1',
            route_short_names: {},
            route_long_name: 'Route 1',
            route_long_names: {},
            route_type: 3,
            route_color: '000000',
            route_text_color: 'FFFFFF',
            agency_id: 'agency-1',
          },
          tripHeadsign: { name: 'Terminal', names: {} },
        },
        boarding: { pickupType: 0, dropOffType: 0 },
        patternPosition: {
          stopIndex: 2,
          totalStops: 10,
          isTerminal: false,
          isOrigin: false,
        },
      },
      stopMeta: {
        stop: {
          stop_id: 'stop-1',
          stop_name: 'Stop 1',
          stop_names: {},
          stop_lat: 0,
          stop_lon: 0,
          location_type: 0,
          agency_id: 'agency-1',
        },
        agencies: [],
        routes: [],
      },
    },
    currentStopIndex: 2,
  };
}

function getLastTripInspectionDialogProps(): TripInspectionDialogMockProps {
  const props = tripInspectionDialogProps.mock.lastCall?.[0];
  if (!props) {
    throw new Error('TripInspectionDialog was not rendered');
  }
  return props;
}

describe('TripInspectionContainer', () => {
  const openTripInspectionFromTarget = vi.fn().mockResolvedValue({ status: 'opened' });
  const openTripInspectionFromStopId = vi.fn().mockResolvedValue({ status: 'opened' });
  const openPreviousTripInspection = vi.fn();
  const openNextTripInspection = vi.fn();
  const closeTripInspection = vi.fn();

  let currentSnapshot: SelectedTripSnapshot | null = null;
  let currentTargets: TripInspectionTarget[] = [];
  let currentTargetIndex = -1;
  let currentShowNoticeNonce = 0;

  beforeEach(() => {
    tripInspectionDialogProps.mockReset();
    useTripInspectionMock.mockReset();
    showOpenOutcomeToastMock.mockReset();
    tMock.mockClear();
    openTripInspectionFromTarget.mockClear();
    openTripInspectionFromStopId.mockClear();
    openPreviousTripInspection.mockClear();
    openNextTripInspection.mockClear();
    closeTripInspection.mockClear();
    currentSnapshot = null;
    currentTargets = [];
    currentTargetIndex = -1;
    currentShowNoticeNonce = 0;

    useTripInspectionMock.mockImplementation(() => ({
      tripInspectionSnapshot: currentSnapshot,
      tripInspectionTargets: currentTargets,
      currentTripInspectionTargetIndex: currentTargetIndex,
      showNoticeNonce: currentShowNoticeNonce,
      openTripInspectionFromTarget,
      openTripInspectionFromStopId,
      openPreviousTripInspection,
      openNextTripInspection,
      closeTripInspection,
    }));
  });

  it('exposes open methods via ref', () => {
    const containerRef = createRef<TripInspectionContainerHandle>();

    render(
      <TripInspectionContainer
        ref={containerRef}
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    expect(containerRef.current?.openByStopId).toBeTypeOf('function');
    expect(containerRef.current?.openByTarget).toBeTypeOf('function');
  });

  it('forwards relativeTimeNow to TripInspectionDialog as now', () => {
    const relativeTimeNow = new Date(2026, 4, 31, 8, 0);

    render(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={relativeTimeNow}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    const lastProps = getLastTripInspectionDialogProps();
    expect(lastProps.open).toBe(false);
    expect(lastProps.snapshot).toBeNull();
    expect(lastProps.now).toBe(relativeTimeNow);
  });

  it('derives serviceDate from referenceDateTime when opened by stopId', async () => {
    const containerRef = createRef<TripInspectionContainerHandle>();
    const referenceDateTime = new Date(2026, 4, 31, 1, 30);

    render(
      <TripInspectionContainer
        ref={containerRef}
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    await act(async () => {
      containerRef.current?.openByStopId({
        stopId: 'stop-1',
        referenceDateTime,
      });
      await Promise.resolve();
    });

    expect(openTripInspectionFromStopId).toHaveBeenCalledWith({
      stopId: 'stop-1',
      now: referenceDateTime,
      serviceDate: getServiceDay(referenceDateTime),
    });
  });

  it('uses direct-open source when opened by target via ref', async () => {
    const containerRef = createRef<TripInspectionContainerHandle>();
    const target = makeTarget();

    render(
      <TripInspectionContainer
        ref={containerRef}
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    await act(async () => {
      containerRef.current?.openByTarget(target);
      await Promise.resolve();
    });

    expect(openTripInspectionFromTarget).toHaveBeenCalledWith(target, 'direct-open');
  });

  it('uses trip-stops-time-select source for in-dialog trip re-selection', async () => {
    const target = makeTarget();

    render(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    await act(async () => {
      getLastTripInspectionDialogProps().onInspectTrip?.(target);
      await Promise.resolve();
    });

    expect(openTripInspectionFromTarget).toHaveBeenCalledWith(target, 'trip-stops-time-select');
  });

  it('shows a mapped toast when openByTarget returns a non-opened outcome', async () => {
    const containerRef = createRef<TripInspectionContainerHandle>();
    const target = makeTarget();
    const outcome = { status: 'error' } as const;

    openTripInspectionFromTarget.mockResolvedValueOnce(outcome);

    render(
      <TripInspectionContainer
        ref={containerRef}
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    await act(async () => {
      containerRef.current?.openByTarget(target);
      await Promise.resolve();
    });

    expect(showOpenOutcomeToastMock).toHaveBeenCalledWith(
      getTripInspectionOpenOutcomeMessage(outcome),
      tMock,
    );
  });

  it('notifies the parent when open state changes including after dialog close', () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    currentSnapshot = makeSnapshot();
    currentTargets = [makeTarget()];
    currentTargetIndex = 0;
    currentShowNoticeNonce = 1;
    rerender(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    act(() => {
      getLastTripInspectionDialogProps().onOpenChange(false);
    });
    expect(closeTripInspection).toHaveBeenCalledTimes(1);

    currentSnapshot = null;
    currentTargets = [];
    currentTargetIndex = -1;
    currentShowNoticeNonce = 0;
    rerender(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('forwards trip-inspection state and display props to the dialog when open', () => {
    const snapshot = makeSnapshot();
    const targets = [makeTarget(), makeTarget({ stopIndex: 3 })];
    currentSnapshot = snapshot;
    currentTargets = targets;
    currentTargetIndex = 1;
    currentShowNoticeNonce = 4;

    render(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="verbose"
        dataLangs={['en', 'ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    const props = getLastTripInspectionDialogProps();
    expect(props.open).toBe(true);
    expect(props.snapshot).toBe(snapshot);
    expect(props.tripInspectionTargets).toBe(targets);
    expect(props.currentTripInspectionTargetIndex).toBe(1);
    expect(props.showNoticeNonce).toBe(4);
    expect(props.infoLevel).toBe('verbose');
    expect(props.dataLangs).toEqual(['en', 'ja']);
  });

  it('wires the dialog pager to the hook prev / next handlers', () => {
    render(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={vi.fn()}
      />,
    );

    const props = getLastTripInspectionDialogProps();
    props.onOpenPreviousTrip();
    props.onOpenNextTrip();

    expect(openPreviousTripInspection).toHaveBeenCalledTimes(1);
    expect(openNextTripInspection).toHaveBeenCalledTimes(1);
  });

  it('forwards onSelectStopById to the dialog', () => {
    const onSelectStopById = vi.fn();

    render(
      <TripInspectionContainer
        repo={repo}
        relativeTimeNow={new Date(2026, 4, 31, 8, 0)}
        infoLevel="normal"
        dataLangs={['ja']}
        onSelectStopById={onSelectStopById}
      />,
    );

    getLastTripInspectionDialogProps().onSelectStopById?.('stop-9');

    expect(onSelectStopById).toHaveBeenCalledWith('stop-9');
  });
});
