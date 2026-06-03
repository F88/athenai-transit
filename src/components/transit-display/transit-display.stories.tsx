import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type {
  TransitDisplayData,
  TransitDisplayEntryData,
} from '../../domain/transit/transit-info-display/build-transit-display-data';
import {
  agencyTobus,
  baseStop,
  busRoute,
  storyMapCenter,
  storyNow,
  storyServiceDate,
} from '../../stories/fixtures';
import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithContext } from '../../types/app/transit-composed';
import { routeTypesEmoji } from '../../utils/route-type-emoji';
import { TransitDisplay } from './transit-displays';

/** Flat override knobs for {@link makeEntry}, assembled into the nested row shape. */
interface MakeEntryOverrides {
  key?: string;
  stopName?: string;
  platformCode?: string;
  distance?: number;
  routeType?: AppRouteTypeValue;
  routeName?: string;
  agencyName?: string;
  headsign?: string;
  timeText?: string;
  isArrival?: boolean;
}

/** Build a minimal {@link StopWithContext} for a row's `stop.context`. */
function makeStopContext(stopId: string, routeType: AppRouteTypeValue): StopWithContext {
  return {
    stop: { ...baseStop, stop_id: stopId },
    agencies: [agencyTobus],
    routes: [busRoute],
    routeTypes: [routeType],
    stopTimes: [],
    stopServiceState: 'boardable',
  };
}

/**
 * Build a {@link TransitDisplayEntryData} for stories. The entry data is the
 * presentational output of `buildTransitDisplayEntryData`, so stories construct
 * it directly rather than running the builder.
 */
function makeEntry(overrides: MakeEntryOverrides = {}): TransitDisplayEntryData {
  const key = overrides.key ?? 'story-entry';
  const routeType = overrides.routeType ?? 3;
  const stopId = `stop-${key}`;
  return {
    key,
    stop: {
      id: stopId,
      name: overrides.stopName ?? '錦糸町駅前',
      platformCode: overrides.platformCode,
      distance: overrides.distance ?? 235,
      routeTypesEmoji: routeTypesEmoji([routeType]),
      context: makeStopContext(stopId, routeType),
    },
    routeTypeEmoji: routeTypesEmoji([routeType]),
    routeName: overrides.routeName ?? '都02',
    agencyName: overrides.agencyName ?? '都バス',
    headsign: overrides.headsign ?? '大塚駅前',
    timeText: overrides.timeText ?? '14:30',
    isArrival: overrides.isArrival ?? false,
    arrivalMinutes: 870,
    departureMinutes: 870,
    serviceDate: storyServiceDate,
    inspectionTarget: {
      serviceDate: storyServiceDate,
      tripLocator: { patternId: 'route-001__大塚駅前', serviceId: 'story:default', tripIndex: 0 },
      stopIndex: 3,
      departureMinutes: 870,
    },
  };
}

/** Assemble a {@link TransitDisplayData} from meta overrides and rows. */
function makeDisplay(
  metaOverrides: Partial<TransitDisplayData['meta']> = {},
  data: readonly TransitDisplayEntryData[] = departureRows,
): TransitDisplayData {
  return {
    meta: { timeBasis: 'departure', routeType: 3, max: 12, radius: 100, ...metaOverrides },
    data,
  };
}

const departureRows: TransitDisplayEntryData[] = [
  makeEntry({ key: 'd1', timeText: '14:30', routeName: '都02', headsign: '大塚駅前' }),
  makeEntry({
    key: 'd2',
    timeText: '14:33',
    routeName: '錦27',
    headsign: '葛西駅前',
    distance: 80,
  }),
  makeEntry({
    key: 'd3',
    timeText: '14:37',
    routeName: '都08',
    headsign: '日暮里駅',
    distance: 410,
  }),
];

const arrivalRows: TransitDisplayEntryData[] = [
  makeEntry({
    key: 'a1',
    timeText: '14:31',
    routeName: '都02',
    headsign: '錦糸町駅前',
    isArrival: true,
  }),
  makeEntry({
    key: 'a2',
    timeText: '14:35',
    routeName: '錦27',
    headsign: '錦糸町駅前',
    isArrival: true,
  }),
];

const trainRows: TransitDisplayEntryData[] = [
  makeEntry({
    key: 't1',
    routeType: 2,
    timeText: '14:32',
    routeName: '総武線',
    agencyName: 'JR東日本',
    headsign: '千葉',
    stopName: '錦糸町',
    platformCode: '3',
  }),
  makeEntry({
    key: 't2',
    routeType: 2,
    timeText: '14:38',
    routeName: '総武線',
    agencyName: 'JR東日本',
    headsign: '三鷹',
    stopName: '錦糸町',
    platformCode: '4',
  }),
];

const meta = {
  title: 'TransitDisplay/TransitDisplay',
  component: TransitDisplay,
  args: {
    display: makeDisplay(),
    emptyMessage: 'Hidden by filter',
    now: storyNow,
    mapCenter: storyMapCenter,
    infoLevel: 'normal' as const,
    onStopSelected: fn(),
    onInspectTrip: fn(),
  },
  argTypes: {
    display: { control: 'object' },
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
  },
  // Mirror the parent TransitDisplays wrapper (px-4) so framing/spacing match production.
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-white px-4 py-2 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TransitDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

/** Default: a bus departure board. Up arrow + DEPARTURES in the header band. */
export const Default: Story = {};

// --- Variants ---

/** Arrival board: right arrow + ARRIVALS, sorted/shown by arrival time. */
export const ArrivalBoard: Story = {
  args: {
    display: makeDisplay({ timeBasis: 'arrival' }, arrivalRows),
  },
};

/** Rail board: the header mode emoji follows the board's route type. */
export const TrainDeparture: Story = {
  args: {
    display: makeDisplay({ routeType: 2 }, trainRows),
  },
};

// --- Edge cases ---

/** No entries: the body shows the empty fallback message. */
export const Empty: Story = {
  args: {
    display: makeDisplay({}, []),
  },
};

// --- Kitchen sink ---

const kitchenSinkRows: TransitDisplayEntryData[] = [
  makeEntry({ key: 'k1', timeText: '14:30', routeName: '都02', headsign: '大塚駅前' }),
  makeEntry({
    key: 'k2',
    timeText: '14:33',
    stopName: '東京都立産業技術研究センター前',
    routeName: '北大01',
    headsign: '北大路バスターミナル・下鴨神社・出町柳駅',
    platformCode: 'A2',
    distance: 12,
  }),
  makeEntry({ key: 'k3', timeText: '14:35', routeName: 'TX', headsign: 'X', distance: 980 }),
  makeEntry({ key: 'k4', timeText: '14:40', routeName: '荒川線', headsign: '' }),
];

/**
 * Maximum-content board: long stop / route / headsign names, platform codes,
 * and a wide distance range, rendered at the verbose info level (mode emojis on).
 */
export const KitchenSink: Story = {
  args: {
    display: makeDisplay({}, kitchenSinkRows),
    infoLevel: 'verbose' as const,
  },
};
