import type { ComponentProps } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AppRouteTypeValue } from '@/types/app/transit';
import { TripStops1 } from '../trip-stops-1';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/use-info-level', () => ({
  useInfoLevel: () => ({
    isSimpleEnabled: true,
    isNormalEnabled: true,
    isDetailedEnabled: false,
    isVerboseEnabled: false,
  }),
}));

vi.mock('../../stop-info', () => ({
  StopInfo: () => <div>StopInfo</div>,
}));

vi.mock('../../stop-time-time-info', () => ({
  StopTimeTimeInfo: () => <div>StopTimeTimeInfo</div>,
}));

vi.mock('../../trip-info', () => ({
  TripInfo: () => null,
}));

vi.mock('../../verbose/verbose-trip-stop-time', () => ({
  VerboseTripStopTime: () => null,
}));

vi.mock('../../badge/label-count-badge', () => ({
  LabelCountBadge: ({ label }: { label: string }) => <div>{label}</div>,
}));

function makeTripStopsProps(): ComponentProps<typeof TripStops1> {
  const serviceDate = new Date(2026, 4, 11);
  const routeTypes: AppRouteTypeValue[] = [3];

  return {
    tripSnapshot: {
      locator: { patternId: 'pattern-1', serviceId: 'weekday', tripIndex: 0 },
      route: {
        route_id: 'route-1',
        route_short_name: 'R1',
        route_short_names: {},
        route_long_name: 'Route 1',
        route_long_names: {},
        route_type: 3,
        agency_id: 'agency-1',
        route_color: '112233',
        route_text_color: 'ffffff',
      },
      tripHeadsign: { name: 'Headsign', names: {} },
      direction: 0,
      stopTimes: [
        {
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
            distance: 0,
            agencies: [],
            routes: [],
          },
          routeTypes,
          timetableEntry: {
            tripLocator: { patternId: 'pattern-1', serviceId: 'weekday', tripIndex: 0 },
            schedule: { arrivalMinutes: 480, departureMinutes: 480 },
            routeDirection: {
              route: {
                route_id: 'route-1',
                route_short_name: 'R1',
                route_short_names: {},
                route_long_name: 'Route 1',
                route_long_names: {},
                route_type: 3,
                agency_id: 'agency-1',
                route_color: '112233',
                route_text_color: 'ffffff',
              },
              tripHeadsign: { name: 'Headsign', names: {} },
            },
            boarding: { pickupType: 0, dropOffType: 0 },
            patternPosition: {
              stopIndex: 0,
              totalStops: 1,
              isOrigin: true,
              isTerminal: true,
            },
          },
        },
      ],
      currentStopIndex: 0,
      selectedStop: {
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
          distance: 0,
          agencies: [],
          routes: [],
        },
        routeTypes,
        timetableEntry: {
          tripLocator: { patternId: 'pattern-1', serviceId: 'weekday', tripIndex: 0 },
          schedule: { arrivalMinutes: 480, departureMinutes: 480 },
          routeDirection: {
            route: {
              route_id: 'route-1',
              route_short_name: 'R1',
              route_short_names: {},
              route_long_name: 'Route 1',
              route_long_names: {},
              route_type: 3,
              agency_id: 'agency-1',
              route_color: '112233',
              route_text_color: 'ffffff',
            },
            tripHeadsign: { name: 'Headsign', names: {} },
          },
          boarding: { pickupType: 0, dropOffType: 0 },
          patternPosition: {
            stopIndex: 0,
            totalStops: 1,
            isOrigin: true,
            isTerminal: true,
          },
        },
      },
      serviceDate,
    },
    renderedSnapshot: null,
    selectedPatternStopIndex: 0,
    routeColors: { color: '#112233', textColor: '#ffffff' },
    infoLevel: 'normal' as const,
    dataLangs: ['ja'] as const,
    now: new Date(2026, 4, 11, 8, 0),
  };
}

describe('TripStops1', () => {
  it('does not mark rows interactive when onSelectStopById is absent', () => {
    const props = makeTripStopsProps();
    const { container } = render(<TripStops1 {...props} />);

    const row = container.querySelector('[data-trip-stop-index="0"]');

    expect(row).not.toBeNull();
    expect(row).not.toHaveAttribute('role');
    expect(row).not.toHaveAttribute('tabindex');
  });

  it('marks rows interactive and selects the stop when onSelectStopById exists', () => {
    const onSelectStopById = vi.fn();
    const props = makeTripStopsProps();
    const { container } = render(<TripStops1 {...props} onSelectStopById={onSelectStopById} />);

    const row = container.querySelector('[data-trip-stop-index="0"]');

    expect(row).not.toBeNull();
    expect(row).toHaveAttribute('role', 'button');
    expect(row).toHaveAttribute('tabindex', '0');

    fireEvent.click(row!);

    expect(onSelectStopById).toHaveBeenCalledWith('stop-1');
  });
});
