import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type {
  TransitDisplayDataWithMetaData,
  TransitDisplayDatum,
  TransitDisplayMeta,
} from '../../domain/transit/transit-info-display/build-transit-display-data';
import {
  agencyGx,
  agencyTobus,
  baseStop,
  busRoute,
  busRoute2,
  createEntry,
  emptyHeadsign,
  headsignNakano,
  headsignShinjuku,
  longNameStop,
  railRoute,
  stopHeadsignShort,
  storyMapCenter,
  storyNow,
  storyTransitDisplayStats,
  tripHeadsignLong,
} from '../../stories/fixtures';
import type { Agency, Route, Stop } from '../../types/app/transit';
import type { StopServiceType, TranslatableText } from '../../types/app/transit-composed';
import { TransitDisplay2 } from './transit-displays-2';

/** Flat override knobs for {@link makeDatum}, assembled into the raw row shape. */
interface MakeDatumOverrides {
  stop?: Stop;
  route?: Route;
  agency?: Agency;
  distance?: number;
  tripHeadsign?: TranslatableText;
  stopHeadsign?: TranslatableText;
  departureMinutes?: number;
  arrivalMinutes?: number;
  stopIndex?: number;
  isLastStop?: boolean;
  isFirstStop?: boolean;
  pickupType?: StopServiceType;
  dropOffType?: StopServiceType;
}

/**
 * Build a raw {@link TransitDisplayDatum} for stories. `TransitDisplay2` passes
 * raw rows down and resolves names / colors at the leaf, so stories construct the
 * unresolved candidate ({@link createEntry} entry + its {@link StopWithContext}).
 * The board derives each row's React key from stop id + pattern + stop index, so
 * vary `tripHeadsign` / `stopIndex` across rows to keep keys unique.
 */
function makeDatum(overrides: MakeDatumOverrides = {}): TransitDisplayDatum {
  const route = overrides.route ?? busRoute;
  const agency = overrides.agency ?? agencyTobus;
  const entry = createEntry({
    route,
    tripHeadsign: overrides.tripHeadsign,
    stopHeadsign: overrides.stopHeadsign,
    departureMinutes: overrides.departureMinutes,
    arrivalMinutes: overrides.arrivalMinutes,
    stopIndex: overrides.stopIndex,
    isLastStop: overrides.isLastStop,
    isFirstStop: overrides.isFirstStop,
    pickupType: overrides.pickupType,
    dropOffType: overrides.dropOffType,
  });
  return {
    timetableEntry: entry,
    stop: {
      stop: overrides.stop ?? baseStop,
      distance: overrides.distance ?? 235,
      agencies: [agency],
      routes: [route],
      routeTypes: [route.route_type],
      stopTimes: [],
      stopServiceState: 'boardable',
    },
  };
}

/** Assemble a {@link TransitDisplayDataWithMetaData} from meta overrides and rows. */
function makeDisplay(
  metaOverrides: Partial<TransitDisplayMeta> = {},
  rows: readonly TransitDisplayDatum[] = departureRows,
): TransitDisplayDataWithMetaData {
  const meta: TransitDisplayMeta = {
    category: 'departures',
    routeTypes: [3],
    routes: [],
    directions: [0],
    max: 20,
    radius: 100,
    ...metaOverrides,
  };
  return {
    meta,
    data: {
      routeTypes: meta.routeTypes,
      routes: meta.routes,
      directions: meta.directions,
      category: meta.category,
      data: [...rows],
    },
    stats: storyTransitDisplayStats,
  };
}

const departureRows: TransitDisplayDatum[] = [
  makeDatum({ departureMinutes: 870, stopIndex: 3, tripHeadsign: headsignNakano }),
  makeDatum({
    route: busRoute2,
    departureMinutes: 873,
    stopIndex: 5,
    tripHeadsign: headsignShinjuku,
    distance: 80,
  }),
  makeDatum({
    departureMinutes: 877,
    stopIndex: 7,
    tripHeadsign: emptyHeadsign,
    stopHeadsign: stopHeadsignShort,
    distance: 410,
  }),
];

const arrivalRows: TransitDisplayDatum[] = [
  makeDatum({
    departureMinutes: 871,
    stopIndex: 12,
    tripHeadsign: headsignNakano,
    isLastStop: true,
  }),
  makeDatum({
    route: busRoute2,
    departureMinutes: 875,
    stopIndex: 14,
    tripHeadsign: headsignShinjuku,
    isLastStop: true,
  }),
];

const trainRows: TransitDisplayDatum[] = [
  makeDatum({
    route: railRoute,
    agency: agencyGx,
    departureMinutes: 872,
    stopIndex: 3,
    tripHeadsign: headsignNakano,
    stop: longNameStop,
  }),
  makeDatum({
    route: railRoute,
    agency: agencyGx,
    departureMinutes: 878,
    stopIndex: 4,
    tripHeadsign: headsignShinjuku,
    stop: longNameStop,
  }),
];

const meta = {
  title: 'TransitDisplay/TransitDisplay2',
  component: TransitDisplay2,
  args: {
    transitDisplayDataWithMetaData: makeDisplay(),
    dataLangs: ['ja'],
    now: storyNow,
    mapCenter: storyMapCenter,
    infoLevel: 'normal' as const,
    size: 'md' as const,
    onStopSelected: fn(),
    onInspectTrip: fn(),
  },
  argTypes: {
    transitDisplayDataWithMetaData: { control: 'object' },
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
  // Mirror the parent TransitDisplays2 wrapper (px-4) so framing / spacing match
  // production.
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-white px-4 py-2 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TransitDisplay2>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

/** Default: a bus departure board. Up arrow + DEPARTURES in the header band. */
export const Default: Story = {};

// --- Variants ---

/** Arrival board: right arrow + ARRIVALS, each row showing its arrival time. */
export const ArrivalBoard: Story = {
  args: {
    transitDisplayDataWithMetaData: makeDisplay({ category: 'arrivals' }, arrivalRows),
  },
};

/** Rail board: the header mode emoji follows the board's route type. */
export const TrainDeparture: Story = {
  args: {
    transitDisplayDataWithMetaData: makeDisplay({ routeTypes: [2] }, trainRows),
  },
};

/** Mixed route types on one board: rows keep their own route + agency colors. */
export const MixedRouteTypes: Story = {
  args: {
    transitDisplayDataWithMetaData: makeDisplay({ routeTypes: [3, 2] }, [
      ...departureRows,
      ...trainRows,
    ]),
  },
};

/** The same board rendered at every display size, smallest to largest. */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="space-y-2">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <TransitDisplay2
          key={size}
          transitDisplayDataWithMetaData={args.transitDisplayDataWithMetaData}
          dataLangs={args.dataLangs}
          now={args.now}
          mapCenter={args.mapCenter}
          infoLevel={args.infoLevel}
          size={size}
          onStopSelected={args.onStopSelected}
          onInspectTrip={args.onInspectTrip}
        />
      ))}
    </div>
  ),
};

// --- Edge cases ---

/** No entries: only the header band renders (this view has no empty fallback row). */
export const Empty: Story = {
  args: {
    transitDisplayDataWithMetaData: makeDisplay({}, []),
  },
};

// --- Kitchen sink ---

const kitchenSinkRows: TransitDisplayDatum[] = [
  makeDatum({
    departureMinutes: 870,
    stopIndex: 1,
    tripHeadsign: headsignNakano,
    isFirstStop: true,
  }),
  makeDatum({
    departureMinutes: 873,
    stopIndex: 3,
    stop: longNameStop,
    tripHeadsign: tripHeadsignLong,
    distance: 12,
    pickupType: 1,
    dropOffType: 1,
  }),
  makeDatum({
    route: railRoute,
    agency: agencyGx,
    departureMinutes: 877,
    stopIndex: 5,
    tripHeadsign: emptyHeadsign,
    stopHeadsign: stopHeadsignShort,
    distance: 980,
  }),
  makeDatum({
    route: busRoute2,
    departureMinutes: 882,
    stopIndex: 15,
    tripHeadsign: headsignShinjuku,
    isLastStop: true,
  }),
];

/**
 * Maximum-content board: long stop / headsign names, mixed route types, near and
 * far distances, and the full attribute set, rendered at the verbose info level
 * (distance badges + unavailability flags on).
 */
export const KitchenSink: Story = {
  args: {
    transitDisplayDataWithMetaData: makeDisplay({ routeTypes: [3, 2] }, kitchenSinkRows),
    infoLevel: 'verbose' as const,
  },
};
