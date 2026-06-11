import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { TransitDisplayDatumForUi } from '../../domain/transit/transit-info-display/build-transit-display-data-for-ui';
import {
  agencyTobus,
  baseStop,
  busRoute,
  storyMapCenter,
  storyServiceDate,
} from '../../stories/fixtures';
import type { AppRouteTypeValue, TimetableEntryAttributes } from '../../types/app/transit';
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
  departureMinutes?: number;
  arrivalMinutes?: number;
  serviceDate?: Date;
  attributes?: TimetableEntryAttributes;
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
 * Build a {@link TransitDisplayDatumForUi} for stories.
 *
 * `TransitDisplayDatumForUi` is the presentational output of `buildTransitDisplayDatumForUi`,
 * so stories construct it directly rather than running the builder.
 *
 * @param overrides - Flat override knobs for the defaults.
 * @returns A complete row with realistic default values.
 */
function makeRow(overrides: MakeRowOverrides = {}): TransitDisplayDatumForUi {
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
    timeText: overrides.timeText ?? '9:30',
    attributes: overrides.attributes ?? {
      isLastStop: true,
      isFirstStop: true,
      isPickupUnavailable: true,
      isDropOffUnavailable: true,
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
    dataWithMeta: makeRow(),
    infoLevel: 'normal' as const,
    size: 'md' as const,
    hasMultiRoutes: false,
    mapCenter: storyMapCenter,
    onStopSelected: fn(),
    onInspectTrip: fn(),
  },
  argTypes: {
    dataWithMeta: { control: 'object' },
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    hasMultiRoutes: { control: 'boolean' },
  },
  // TransitDisplayEntry renders an <li>; wrap in a <ul> mirroring the
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
    dataWithMeta: makeRow({ headsign: '' }),
  },
};

/** Long stop name, route name, and headsign all exercise truncation. */
export const LongText: Story = {
  args: {
    dataWithMeta: makeRow({
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
    dataWithMeta: makeRow({ routeName: 'TX', headsign: 'X', timeText: '14:30' }),
  },
};

// --- Variants ---

const SIZE_COMPARISON_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/** Long stop / route / headsign that overflow the board width so truncation shows. */
const longTextRowOverrides = {
  timeText: '14:30',
  stopName: '東京都立産業技術研究センター前',
  routeName: '北大01 (長い路線名)',
  headsign: '北大路バスターミナル・下鴨神社・出町柳駅',
  attributes: {
    isLastStop: true,
    isFirstStop: true,
    isPickupUnavailable: true,
    isDropOffUnavailable: true,
  },
} as const;

/**
 * The same row at every display size, smallest to largest. The short rows
 * (which fit) are grouped first, then the long rows (which overflow), so each
 * group's behavior is read together rather than interleaved: the long-row group
 * shows how truncation looks at each size.
 */
export const SizeComparison: Story = {
  render: (args) => {
    const rows = [
      ...SIZE_COMPARISON_SIZES.map((size) => ({
        size,
        data: makeRow({ key: `short-${size}` }),
      })),
      ...SIZE_COMPARISON_SIZES.map((size) => ({
        size,
        data: makeRow({ key: `long-${size}`, ...longTextRowOverrides }),
      })),
    ];
    return (
      <>
        {rows.map(({ size, data }) => (
          <TransitDisplayEntry
            key={data.key}
            dataWithMeta={data}
            infoLevel={args.infoLevel}
            size={size}
            hasMultiRoutes={args.hasMultiRoutes}
            mapCenter={args.mapCenter}
            onStopSelected={args.onStopSelected}
            onInspectTrip={args.onInspectTrip}
          />
        ))}
      </>
    );
  },
};

// --- Kitchen sink ---

const kitchenSinkRows: TransitDisplayDatumForUi[] = [
  makeRow({
    key: 'k1',
    timeText: '14:30',
    departureMinutes: 870,
    routeName: '都02',
    headsign: '大塚駅前',
    // origin
    attributes: {
      isLastStop: false,
      isFirstStop: true,
      isPickupUnavailable: false,
      isDropOffUnavailable: false,
    },
  }),
  makeRow({
    key: 'k2',
    timeText: '14:33',
    departureMinutes: 873,
    stopName: '東京都立産業技術研究センター前',
    routeName: '北大01',
    headsign: '北大路バスターミナル・下鴨神社・出町柳駅',
    // terminal
    attributes: {
      isLastStop: true,
      isFirstStop: false,
      isPickupUnavailable: false,
      isDropOffUnavailable: false,
    },
  }),
  makeRow({
    key: 'k3',
    timeText: '14:35',
    departureMinutes: 875,
    routeName: 'TX',
    headsign: 'X',
    // pickup unavailable
    attributes: {
      isLastStop: false,
      isFirstStop: false,
      isPickupUnavailable: true,
      isDropOffUnavailable: false,
    },
  }),
  makeRow({
    key: 'k4',
    timeText: '14:40',
    departureMinutes: 880,
    routeName: '荒川線',
    headsign: '',
    // drop-off unavailable
    attributes: {
      isLastStop: false,
      isFirstStop: false,
      isPickupUnavailable: false,
      isDropOffUnavailable: true,
    },
  }),
  makeRow({
    key: 'k5',
    timeText: '14:42',
    departureMinutes: 882,
    stopName: '三ノ輪橋',
    routeName: '都08',
    headsign: '日暮里駅',
    // all attributes set (maximum content)
    attributes: {
      isLastStop: true,
      isFirstStop: true,
      isPickupUnavailable: true,
      isDropOffUnavailable: true,
    },
  }),
  makeRow({
    key: 'k6',
    timeText: '14:45',
    departureMinutes: 885,
    routeName: '反96',
    headsign: '五反田駅',
    // no attributes set (plain row, no labels)
    attributes: {
      isLastStop: false,
      isFirstStop: false,
      isPickupUnavailable: false,
      isDropOffUnavailable: false,
    },
  }),
];

/**
 * Maximum-content rows: short and long stop / route / headsign text, with each
 * attribute label exercised across the rows (origin, terminal, pickup
 * unavailable, drop-off unavailable, all combined, and none).
 */
export const KitchenSink: Story = {
  render: (args) => (
    <>
      {kitchenSinkRows.map((row) => (
        <TransitDisplayEntry
          key={row.key}
          dataWithMeta={row}
          infoLevel={args.infoLevel}
          size={args.size}
          hasMultiRoutes={args.hasMultiRoutes}
          mapCenter={args.mapCenter}
          onStopSelected={args.onStopSelected}
          onInspectTrip={args.onInspectTrip}
        />
      ))}
    </>
  ),
};
