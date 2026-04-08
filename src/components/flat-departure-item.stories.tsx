import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ContextualTimetableEntry, StopServiceType } from '../types/app/transit-composed';
import type { Agency, Route } from '../types/app/transit';
import {
  agencyTobus as agency,
  busRoute as baseRoute,
  busRoute2 as greenRoute,
  createRouteDirection,
  emptyHeadsign,
  headsignKyotoLong,
  headsignMinowabashi,
  headsignShimbashiEkimae,
  headsignShinjuku,
  headsignWaseda,
  noColorRoute,
  stopHeadsignDemachiyanagi,
  stopHeadsignMusashiKoganeiSouth,
  tramRoute,
} from '../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import { FlatDepartureItem } from './flat-departure-item';

/** Create a ContextualTimetableEntry for stories. */
function createEntry(
  overrides: Partial<{
    departureMinutes: number;
    arrivalMinutes: number;
    route: Route;
    headsign: string;
    stopHeadsign: string;
    pickupType: StopServiceType;
    dropOffType: StopServiceType;
    isTerminal: boolean;
    isOrigin: boolean;
    stopIndex: number;
    totalStops: number;
    direction: 0 | 1;
  }> = {},
): ContextualTimetableEntry {
  const depMin = overrides.departureMinutes ?? 870; // 14:30
  return {
    schedule: {
      departureMinutes: depMin,
      arrivalMinutes: overrides.arrivalMinutes ?? depMin,
    },
    routeDirection: {
      route: overrides.route ?? baseRoute,
      tripHeadsign: { name: overrides.headsign ?? '中野駅', names: {} },
      ...(overrides.stopHeadsign != null
        ? { stopHeadsign: { name: overrides.stopHeadsign, names: {} } }
        : {}),
      direction: overrides.direction,
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 3,
      totalStops: overrides.totalStops ?? 15,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    serviceDate: new Date('2026-03-30T00:00:00'),
  };
}

/** now = 14:25 → 5 minutes before the default 14:30 departure. */
const now = new Date('2026-03-30T14:25:00');

const meta = {
  title: 'Departure/FlatDepartureItem',
  component: FlatDepartureItem,
  args: {
    entry: createEntry(),
    now,
    isFirst: true,
    showRouteTypeIcon: false,
    infoLevel: 'normal',
    dataLang: ['ja'],
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    isFirst: { control: 'boolean' },
    showRouteTypeIcon: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FlatDepartureItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const NotFirst: Story = {
  args: { isFirst: false },
};

export const WithRouteTypeIcon: Story = {
  args: { showRouteTypeIcon: true },
};

// --- Route variants ---

export const GreenRoute: Story = {
  args: { entry: createEntry({ route: greenRoute, headsign: '新橋駅' }) },
};

export const TramRoute: Story = {
  args: {
    entry: createEntry({ route: tramRoute, headsign: '早稲田' }),
    showRouteTypeIcon: true,
  },
};

export const NoRouteColor: Story = {
  args: { entry: createEntry({ route: noColorRoute, headsign: '駅前' }) },
};

// --- Special states ---

export const Terminal: Story = {
  args: {
    entry: createEntry({
      isTerminal: true,
      arrivalMinutes: 870,
      departureMinutes: 870,
    }),
  },
};

export const PickupUnavailable: Story = {
  args: { entry: createEntry({ pickupType: 1 }) },
};

export const EmptyHeadsign: Story = {
  args: { entry: createEntry({ headsign: '' }) },
};

// --- Info levels ---

export const Detailed: Story = {
  args: { infoLevel: 'detailed', agency },
};

export const Verbose: Story = {
  args: {
    infoLevel: 'verbose',
    agency,
    entry: createEntry({ direction: 0 }),
  },
};

// --- Multiple items ---

/** Multiple flat items as they appear in the stop view. */
export const MultipleItems: Story = {
  args: { entry: createEntry() },
  render: () => {
    const entries = [
      createEntry({ departureMinutes: 870, headsign: '中野駅' }),
      createEntry({ departureMinutes: 885, route: greenRoute, headsign: '新橋駅' }),
      createEntry({ departureMinutes: 900, headsign: '中野駅' }),
      createEntry({ departureMinutes: 920, pickupType: 1, headsign: '車庫前' }),
      createEntry({ departureMinutes: 935, route: tramRoute, headsign: '早稲田' }),
    ];
    return (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        {entries.map((entry, i) => (
          <FlatDepartureItem
            key={i}
            entry={entry}
            now={now}
            isFirst={i === 0}
            showRouteTypeIcon
            infoLevel="normal"
            dataLang={['ja']}
          />
        ))}
      </div>
    );
  },
};

/** Long route name (no short name) — tests layout wrapping. */
const longRoute: Route = {
  ...baseRoute,
  route_id: 'toaran:SA',
  route_short_name: '',
  route_short_names: {},
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_type: 0 as const,
  route_color: 'E60012',
};

// --- stop_headsign patterns ---

/** trip empty + stop present (keio-bus pattern). */
export const TripEmptyStopPresent: Story = {
  args: {
    entry: {
      ...createEntry(),
      routeDirection: createRouteDirection({
        ...createEntry().routeDirection,
        tripHeadsign: emptyHeadsign,
        stopHeadsign: stopHeadsignMusashiKoganeiSouth,
      }),
    },
  },
};

/** stop overrides trip — stop_headsign differs from trip_headsign. */
export const StopOverridesTrip: Story = {
  args: {
    entry: {
      ...createEntry(),
      routeDirection: createRouteDirection({
        ...createEntry().routeDirection,
        tripHeadsign: headsignKyotoLong,
        stopHeadsign: stopHeadsignDemachiyanagi,
      }),
    },
  },
};

export const LangComparison: Story = {
  args: {
    agency,
    entry: {
      ...createEntry({ route: greenRoute, departureMinutes: 870 }),
      routeDirection: createRouteDirection({
        route: greenRoute,
        tripHeadsign: headsignShimbashiEkimae,
      }),
    },
    infoLevel: 'normal',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <FlatDepartureItem
            entry={args.entry}
            now={args.now}
            isFirst={args.isFirst}
            showRouteTypeIcon={args.showRouteTypeIcon}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
            agency={args.agency}
          />
        </div>
      ))}
    </div>
  ),
};

/** Kitchen sink items: various data patterns to verify layout. */
const kitchenSinkItems: {
  entry: ContextualTimetableEntry;
  agency?: Agency;
  icon?: boolean;
}[] = [
  // 0分後 — まもなく, short route
  { entry: createEntry({ departureMinutes: 865, headsign: '中野駅' }) },
  // 1分後 — short route + headsign with translations
  {
    entry: {
      ...createEntry({ departureMinutes: 866 }),
      routeDirection: createRouteDirection({
        route: greenRoute,
        tripHeadsign: headsignShimbashiEkimae,
      }),
    },
    agency,
  },
  // 1分後 — long route + short headsign
  {
    entry: createEntry({ route: longRoute, departureMinutes: 866, headsign: '三ノ輪橋' }),
    icon: true,
  },
  // 2分後 — long route + headsign with translations
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 867 }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignMinowabashi }),
    },
    icon: true,
    agency,
  },
  // 3分後 — long route + headsign with translations (Waseda)
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 868 }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignWaseda }),
    },
    icon: true,
  },
  // 3分後 — long route + long headsign (Kyoto-style)
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 868 }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
    },
    icon: true,
    agency,
  },
  // 5分後 — all long + terminal
  {
    entry: {
      ...createEntry({
        route: longRoute,
        departureMinutes: 870,
        isTerminal: true,
        arrivalMinutes: 870,
      }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
    },
    icon: true,
    agency,
  },
  // 9分後 — all long + pickup unavailable
  {
    entry: {
      ...createEntry({
        route: longRoute,
        departureMinutes: 874,
        pickupType: 1,
      }),
      routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
    },
    icon: true,
    agency,
  },
  // 10分後 — all short + terminal
  {
    entry: {
      ...createEntry({
        departureMinutes: 875,
        isTerminal: true,
        arrivalMinutes: 875,
      }),
      routeDirection: createRouteDirection({ route: baseRoute, tripHeadsign: headsignShinjuku }),
    },
    icon: true,
    agency,
  },
  // 11分後 — long route + terminal (no relative time)
  {
    entry: createEntry({
      route: longRoute,
      departureMinutes: 876,
      headsign: '三ノ輪橋',
      isTerminal: true,
      arrivalMinutes: 876,
    }),
    icon: true,
  },
  // 14分後 — pickup unavailable (no relative time)
  { entry: createEntry({ departureMinutes: 879, headsign: '車庫前', pickupType: 1 }) },
  // 15分後 — empty headsign
  { entry: createEntry({ departureMinutes: 880, headsign: '' }) },
  // 30分後
  { entry: createEntry({ departureMinutes: 895, headsign: '中野駅' }) },
  // 60分後
  { entry: createEntry({ departureMinutes: 925, headsign: '中野駅' }) },
  // 120分後
  { entry: createEntry({ departureMinutes: 985, headsign: '中野駅' }) },
];

export const KitchenSink: Story = {
  args: { entry: createEntry() },
  render: () => (
    <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
      {kitchenSinkItems.map(({ entry, agency: a, icon }, i) => (
        <FlatDepartureItem
          key={i}
          entry={entry}
          now={now}
          isFirst={i === 0}
          showRouteTypeIcon={icon ?? false}
          infoLevel="detailed"
          dataLang={['ja']}
          agency={a}
        />
      ))}
    </div>
  ),
};
