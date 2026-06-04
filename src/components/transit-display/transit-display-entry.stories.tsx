import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { TransitDisplayEntryData } from '../../domain/transit/transit-info-display/build-transit-display-data';
import {
  agencyTobus,
  baseStop,
  busRoute,
  storyMapCenter,
  storyServiceDate,
} from '../../stories/fixtures';
import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopWithContext } from '../../types/app/transit-composed';
import { routeTypesEmoji } from '../../utils/route-type-emoji';
import { TransitDisplayEntry } from './transit-displays';

/** Flat override knobs for {@link makeRow}, assembled into the nested row shape. */
interface MakeRowOverrides {
  key?: string;
  stopId?: string;
  stopName?: string;
  platformCode?: string;
  distance?: number;
  routeType?: AppRouteTypeValue;
  routeTypes?: AppRouteTypeValue[];
  routeName?: string;
  agencyName?: string;
  headsign?: string;
  timeText?: string;
  isArrival?: boolean;
  isPickupUnavailable?: boolean;
  departureMinutes?: number;
  arrivalMinutes?: number;
  serviceDate?: Date;
}

/** Build a minimal {@link StopWithContext} for the row's `stop.context`. */
function makeStopContext(stopId: string, routeTypes: AppRouteTypeValue[]): StopWithContext {
  return {
    stop: { ...baseStop, stop_id: stopId },
    agencies: [agencyTobus],
    routes: [busRoute],
    routeTypes,
    stopTimes: [],
    stopServiceState: 'boardable',
  };
}

/**
 * Build a {@link TransitDisplayEntryData} for stories.
 *
 * `TransitDisplayEntryData` is the presentational output of `buildTransitDisplayEntryData`,
 * so stories construct it directly rather than running the builder.
 *
 * @param overrides - Flat override knobs for the defaults.
 * @returns A complete row with realistic default values.
 */
function makeRow(overrides: MakeRowOverrides = {}): TransitDisplayEntryData {
  const stopId = overrides.stopId ?? 'stop-001';
  const departureMinutes = overrides.departureMinutes ?? 870; // 14:30
  const serviceDate = overrides.serviceDate ?? storyServiceDate;
  const routeTypes = overrides.routeTypes ?? [3];
  return {
    key: overrides.key ?? 'story-row',
    stop: {
      id: stopId,
      name: overrides.stopName ?? '錦糸町駅前',
      platformCode: overrides.platformCode,
      distance: overrides.distance ?? 235,
      routeTypesEmoji: routeTypesEmoji(routeTypes),
      context: makeStopContext(stopId, routeTypes),
    },
    routeTypeEmoji: routeTypesEmoji([overrides.routeType ?? 3]),
    routeName: overrides.routeName ?? '都02',
    agencyName: overrides.agencyName ?? '都バス',
    headsign: overrides.headsign ?? '大塚駅前',
    timeText: overrides.timeText ?? '14:30',
    isArrival: overrides.isArrival ?? false,
    attributes: {
      isTerminal: overrides.isArrival ?? false,
      isOrigin: false,
      isPickupUnavailable: overrides.isPickupUnavailable ?? false,
      isDropOffUnavailable: false,
    },
    arrivalMinutes: overrides.arrivalMinutes ?? departureMinutes,
    departureMinutes,
    serviceDate,
    inspectionTarget: {
      serviceDate,
      tripLocator: { patternId: 'route-001__大塚駅前', serviceId: 'story:default', tripIndex: 0 },
      stopIndex: 3,
      departureMinutes,
    },
  };
}

const meta = {
  title: 'TransitDisplay/TransitDisplayEntry',
  component: TransitDisplayEntry,
  args: {
    data: makeRow(),
    infoLevel: 'normal' as const,
    hasMultiRoutes: false,
    mapCenter: storyMapCenter,
    onStopSelected: fn(),
    onInspectTrip: fn(),
  },
  argTypes: {
    data: { control: 'object' },
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    hasMultiRoutes: { control: 'boolean' },
  },
  // TransitDisplay renders an <li>; wrap in a <ul> mirroring the
  // parent TransitDisplays list so layout and semantics match production.
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <ul className="m-0 list-none space-y-1 p-0">
          <Story />
        </ul>
      </div>
    ),
  ],
} satisfies Meta<typeof TransitDisplayEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

/** Default: a single departure row. Use Controls to tweak any field. */
export const Default: Story = {};

// --- Edge cases ---

/** Empty headsign falls back to the `-` placeholder in the second line. */
export const EmptyHeadsign: Story = {
  args: {
    data: makeRow({ headsign: '' }),
  },
};

/** Long stop name, route name, and headsign all exercise truncation. */
export const LongText: Story = {
  args: {
    data: makeRow({
      stopName: '東京都立産業技術研究センター前',
      routeName: '北大01',
      headsign: '北大路バスターミナル・下鴨神社・出町柳駅',
      timeText: '14:30',
    }),
  },
};

/** Single-character headsign — minimum-length rendering. */
export const ShortHeadsign: Story = {
  args: {
    data: makeRow({ routeName: 'TX', headsign: 'X', timeText: '14:30' }),
  },
};

// --- Kitchen sink ---

const kitchenSinkRows: TransitDisplayEntryData[] = [
  makeRow({
    key: 'k1',
    timeText: '14:30',
    departureMinutes: 870,
    routeName: '都02',
    headsign: '大塚駅前',
    isArrival: false,
  }),
  makeRow({
    key: 'k2',
    timeText: '14:33',
    departureMinutes: 873,
    stopName: '東京都立産業技術研究センター前',
    routeName: '北大01',
    headsign: '北大路バスターミナル・下鴨神社・出町柳駅',
    isArrival: true,
  }),
  makeRow({
    key: 'k3',
    timeText: '14:35',
    departureMinutes: 875,
    routeName: 'TX',
    headsign: 'X',
    isArrival: false,
  }),
  makeRow({
    key: 'k4',
    timeText: '14:40',
    departureMinutes: 880,
    routeName: '荒川線',
    headsign: '',
    isArrival: true,
  }),
  makeRow({
    key: 'k5',
    timeText: '14:42',
    departureMinutes: 882,
    stopName: '三ノ輪橋',
    routeName: '都08',
    headsign: '日暮里駅',
    isArrival: false,
  }),
];

/**
 * A realistic terminal board: multiple rows mixing arrivals and
 * departures, with short and long stop names, route names, and
 * headsigns rendered in timeline order.
 */
export const KitchenSink: Story = {
  render: (args) => (
    <>
      {kitchenSinkRows.map((row) => (
        <TransitDisplayEntry
          key={row.key}
          data={row}
          infoLevel={args.infoLevel}
          hasMultiRoutes={args.hasMultiRoutes}
          mapCenter={args.mapCenter}
          onStopSelected={args.onStopSelected}
          onInspectTrip={args.onInspectTrip}
        />
      ))}
    </>
  ),
};
