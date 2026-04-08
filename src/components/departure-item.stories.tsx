import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ContextualTimetableEntry, StopServiceType } from '../types/app/transit-composed';
import type { Agency, Route } from '../types/app/transit';
import {
  agencyLong as longAgency,
  agencyTobus as agency,
  busRoute as baseRoute,
  busRoute2 as greenRoute,
  createRouteDirection,
  emptyHeadsign,
  headsignKyotoLong,
  headsignMinowabashi,
  headsignNakano,
  headsignShimbashiEkimae,
  headsignShinjuku,
  headsignWaseda,
  noColorRoute,
  stopHeadsignDemachiyanagi,
  stopHeadsignMusashiKoganeiSouth,
  tramRoute,
} from '../stories/fixtures';
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import { fn } from 'storybook/test';
import { DepartureItem } from './departure-item';

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

/** Three entries at 14:30, 14:45, 15:00 for a typical group. */
const threeEntries = [
  createEntry({ departureMinutes: 870 }),
  createEntry({ departureMinutes: 885 }),
  createEntry({ departureMinutes: 900 }),
];

const meta = {
  title: 'Departure/DepartureItem',
  component: DepartureItem,
  args: {
    entries: threeEntries,
    now,
    infoLevel: 'normal',
    dataLang: ['ja'],
    showRouteTypeIcon: false,
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    showRouteTypeIcon: { control: 'boolean' },
    maxDisplay: { control: { type: 'number', min: 1, max: 5, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DepartureItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const SingleEntry: Story = {
  args: { entries: [createEntry()] },
};

export const WithRouteTypeIcon: Story = {
  args: { showRouteTypeIcon: true },
};

// --- Route variants ---

export const GreenRoute: Story = {
  args: {
    entries: [
      createEntry({ route: greenRoute, headsign: '新橋駅', departureMinutes: 870 }),
      createEntry({ route: greenRoute, headsign: '新橋駅', departureMinutes: 890 }),
      createEntry({ route: greenRoute, headsign: '新橋駅', departureMinutes: 910 }),
    ],
  },
};

export const TramRoute: Story = {
  args: {
    entries: [
      createEntry({ route: tramRoute, headsign: '早稲田', departureMinutes: 870 }),
      createEntry({ route: tramRoute, headsign: '早稲田', departureMinutes: 880 }),
    ],
    showRouteTypeIcon: true,
  },
};

export const NoRouteColor: Story = {
  args: {
    entries: [
      createEntry({ route: noColorRoute, headsign: '駅前', departureMinutes: 870 }),
      createEntry({ route: noColorRoute, headsign: '駅前', departureMinutes: 895 }),
    ],
  },
};

// --- Special states ---

export const TerminalEntries: Story = {
  args: {
    entries: [
      createEntry({ isTerminal: true, arrivalMinutes: 870 }),
      createEntry({ isTerminal: true, arrivalMinutes: 890 }),
    ],
  },
};

export const DropOffOnly: Story = {
  args: {
    entries: [
      createEntry({ pickupType: 1, departureMinutes: 870 }),
      createEntry({ pickupType: 1, departureMinutes: 890 }),
    ],
  },
};

export const EmptyHeadsign: Story = {
  args: {
    entries: [createEntry({ headsign: '' })],
  },
};

// --- Timetable button ---

export const WithTimetableButton: Story = {
  args: { onShowTimetable: fn() },
};

// --- maxDisplay ---

export const MaxDisplay1: Story = {
  args: { maxDisplay: 1 },
};

export const MaxDisplay5: Story = {
  args: {
    maxDisplay: 5,
    entries: [
      createEntry({ departureMinutes: 870 }),
      createEntry({ departureMinutes: 885 }),
      createEntry({ departureMinutes: 900 }),
      createEntry({ departureMinutes: 920 }),
      createEntry({ departureMinutes: 940 }),
    ],
  },
};

// --- Info levels ---

export const Detailed: Story = {
  args: { infoLevel: 'detailed', agency },
};

export const Verbose: Story = {
  args: {
    infoLevel: 'verbose',
    agency,
    entries: [
      createEntry({ departureMinutes: 870, direction: 0 }),
      createEntry({ departureMinutes: 885, direction: 0 }),
      createEntry({ departureMinutes: 900, direction: 0 }),
    ],
  },
};

// --- Multiple groups ---

/** Multiple route groups as they appear in the bottom sheet. */
export const MultipleGroups: Story = {
  args: { entries: threeEntries },
  render: () => {
    const groups = [
      {
        entries: [
          createEntry({ departureMinutes: 870, headsign: '中野駅' }),
          createEntry({ departureMinutes: 885, headsign: '中野駅' }),
          createEntry({ departureMinutes: 900, headsign: '中野駅' }),
        ],
      },
      {
        entries: [
          createEntry({
            route: greenRoute,
            headsign: '新橋駅',
            departureMinutes: 872,
          }),
          createEntry({
            route: greenRoute,
            headsign: '新橋駅',
            departureMinutes: 892,
          }),
        ],
      },
      {
        entries: [
          createEntry({
            route: tramRoute,
            headsign: '早稲田',
            departureMinutes: 875,
          }),
        ],
      },
    ];
    return (
      <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
        {groups.map((group, i) => (
          <DepartureItem
            key={i}
            entries={group.entries}
            now={now}
            infoLevel="normal"
            dataLang={['ja']}
            showRouteTypeIcon
            onShowTimetable={fn()}
          />
        ))}
      </div>
    );
  },
};

/** Long route name (no short name) — tests layout. */
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
    entries: [
      createEntry({ headsign: '', stopHeadsign: '武蔵小金井駅南口' }),
      {
        ...createEntry({ departureMinutes: 885 }),
        routeDirection: createRouteDirection({
          ...createEntry({ departureMinutes: 885 }).routeDirection,
          tripHeadsign: emptyHeadsign,
          stopHeadsign: stopHeadsignMusashiKoganeiSouth,
        }),
      },
    ],
  },
};

/** stop overrides trip — stop_headsign differs from trip_headsign. */
export const StopOverridesTrip: Story = {
  args: {
    entries: [
      createEntry({
        route: longRoute,
        headsign: '北大路BT・下鴨神社・出町柳駅',
        stopHeadsign: '出町柳駅',
      }),
      {
        ...createEntry({ route: longRoute, departureMinutes: 885 }),
        routeDirection: createRouteDirection({
          ...createEntry({ route: longRoute, departureMinutes: 885 }).routeDirection,
          tripHeadsign: headsignKyotoLong,
          stopHeadsign: stopHeadsignDemachiyanagi,
        }),
      },
    ],
    agency: longAgency,
  },
};

export const LangComparison: Story = {
  args: {
    agency,
    entries: [
      {
        ...createEntry({ route: greenRoute, departureMinutes: 870 }),
        routeDirection: createRouteDirection({
          route: greenRoute,
          tripHeadsign: headsignShimbashiEkimae,
        }),
      },
      {
        ...createEntry({ route: greenRoute, departureMinutes: 885 }),
        routeDirection: createRouteDirection({
          route: greenRoute,
          tripHeadsign: headsignShimbashiEkimae,
        }),
      },
      {
        ...createEntry({ route: baseRoute, departureMinutes: 900 }),
        routeDirection: createRouteDirection({ route: baseRoute, tripHeadsign: headsignNakano }),
      },
    ],
    infoLevel: 'normal',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <DepartureItem
            entries={args.entries}
            now={args.now}
            infoLevel={args.infoLevel}
            dataLang={dataLang}
            showRouteTypeIcon={args.showRouteTypeIcon}
            agency={args.agency}
            maxDisplay={args.maxDisplay}
            onShowTimetable={args.onShowTimetable}
          />
        </div>
      ))}
    </div>
  ),
};

/** Kitchen sink groups: various data patterns to verify layout. */
const kitchenSinkGroups: { entries: ContextualTimetableEntry[]; agency?: Agency }[] = [
  // Short route + short headsign
  {
    entries: [
      createEntry({ departureMinutes: 870, headsign: '中野駅' }),
      createEntry({ departureMinutes: 885, headsign: '中野駅' }),
      createEntry({ departureMinutes: 900, headsign: '中野駅' }),
    ],
    agency,
  },
  // Short route + headsign with translations
  {
    entries: [
      {
        ...createEntry({ departureMinutes: 872 }),
        routeDirection: createRouteDirection({
          route: greenRoute,
          tripHeadsign: headsignShimbashiEkimae,
        }),
      },
      {
        ...createEntry({ departureMinutes: 892 }),
        routeDirection: createRouteDirection({
          route: greenRoute,
          tripHeadsign: headsignShimbashiEkimae,
        }),
      },
    ],
    agency,
  },
  // Long route name + headsign with translations
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 875 }),
        routeDirection: createRouteDirection({
          route: longRoute,
          tripHeadsign: headsignMinowabashi,
        }),
      },
      {
        ...createEntry({ route: longRoute, departureMinutes: 890 }),
        routeDirection: createRouteDirection({
          route: longRoute,
          tripHeadsign: headsignMinowabashi,
        }),
      },
    ],
    agency: longAgency,
  },
  // Long route name + different headsign with translations
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 880 }),
        routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignWaseda }),
      },
    ],
    agency: longAgency,
  },
  // Long route + long headsign with long translations (Kyoto-style)
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 882 }),
        routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
      },
    ],
    agency: longAgency,
  },
  // Long route + terminal
  {
    entries: [
      {
        ...createEntry({
          route: longRoute,
          departureMinutes: 884,
          isTerminal: true,
          arrivalMinutes: 884,
        }),
        routeDirection: createRouteDirection({
          route: longRoute,
          tripHeadsign: headsignMinowabashi,
        }),
      },
    ],
    agency: longAgency,
  },
  // All elements: icon + long route + long subNames + long headsign + drop-off only + agency
  {
    entries: [
      {
        ...createEntry({
          route: longRoute,
          departureMinutes: 886,
          pickupType: 1,
        }),
        routeDirection: createRouteDirection({ route: longRoute, tripHeadsign: headsignKyotoLong }),
      },
    ],
    agency: longAgency,
  },
  // All elements short: icon + short route + short subNames + short headsign + drop-off only + agency
  {
    entries: [
      {
        ...createEntry({
          departureMinutes: 888,
          pickupType: 1,
        }),
        routeDirection: createRouteDirection({ route: baseRoute, tripHeadsign: headsignShinjuku }),
      },
    ],
    agency,
  },
  // Empty headsign
  {
    entries: [createEntry({ departureMinutes: 905, headsign: '' })],
    agency,
  },
];

export const KitchenSink: Story = {
  args: { entries: threeEntries },
  render: () => (
    <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
      {kitchenSinkGroups.map((group, i) => (
        <DepartureItem
          key={i}
          entries={group.entries}
          now={now}
          infoLevel="detailed"
          dataLang={['ja']}
          showRouteTypeIcon
          agency={group.agency}
          onShowTimetable={fn()}
        />
      ))}
    </div>
  ),
};
