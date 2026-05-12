import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TripStops } from '../trip-stops';

vi.mock('../trip-stops-1', () => ({
  TripStops1: () => <div>TripStops1 rendered</div>,
}));

vi.mock('../trip-stops-2', () => ({
  TripStops2: () => <div>TripStops2 rendered</div>,
}));

function makeProps(): React.ComponentProps<typeof TripStops> {
  return {
    tripSnapshot: {
      currentStopIndex: 0,
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
      serviceDate: new Date(2026, 4, 11),
      stopTimes: [],
      selectedStop: {
        timetableEntry: {
          patternPosition: {
            stopIndex: 0,
            totalStops: 0,
          },
        },
      },
    } as unknown as React.ComponentProps<typeof TripStops>['tripSnapshot'],
    renderedSnapshot: null,
    selectedPatternStopIndex: 0,
    routeColors: { color: '#112233', textColor: '#ffffff' },
    infoLevel: 'normal',
    dataLangs: ['ja'],
    now: new Date(2026, 4, 11, 8, 0),
  };
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('TripStops', () => {
  it('renders the configured default variant when the query parameter is absent', () => {
    window.history.replaceState({}, '', '/');

    render(<TripStops {...makeProps()} />);

    expect(screen.getByText('TripStops2 rendered')).toBeInTheDocument();
  });

  it('renders TripStops2 when ?tripStops=v2 is present', () => {
    window.history.replaceState({}, '', '/?tripStops=v2');

    render(<TripStops {...makeProps()} />);

    expect(screen.getByText('TripStops2 rendered')).toBeInTheDocument();
  });

  it('falls back to the configured default variant when the query parameter is invalid', () => {
    window.history.replaceState({}, '', '/?tripStops=unexpected');

    render(<TripStops {...makeProps()} />);

    expect(screen.getByText('TripStops2 rendered')).toBeInTheDocument();
  });
});
