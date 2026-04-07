import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ContextualTimetableEntry, StopServiceType } from '../types/app/transit-composed';
import type { Agency, Route } from '../types/app/transit';
import { fn } from 'storybook/test';
import { DepartureItem } from './departure-item';

/** Fictional base route for stories. */
const baseRoute: Route = {
  route_id: 'route-001',
  route_short_name: '渋64',
  route_long_name: '渋谷駅〜中野駅',
  route_names: {},
  route_type: 3 as const,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'agency-001',
};

const greenRoute: Route = {
  ...baseRoute,
  route_id: 'route-002',
  route_short_name: '都01',
  route_long_name: '渋谷駅〜新橋駅',
  route_color: '00A850',
};

const tramRoute: Route = {
  ...baseRoute,
  route_id: 'route-003',
  route_short_name: '荒川線',
  route_long_name: '三ノ輪橋〜早稲田',
  route_type: 0 as const,
  route_color: 'E60012',
};

const noColorRoute: Route = {
  ...baseRoute,
  route_id: 'route-004',
  route_short_name: 'A5',
  route_long_name: '',
  route_color: '',
  route_text_color: '',
};

const agency: Agency = {
  agency_id: 'agency-001',
  agency_name: '都営バス',
  agency_short_name: '都営',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: '00A850', text: 'FFFFFF' }],
};

const longAgency: Agency = {
  agency_id: 'agency-002',
  agency_name: '東京都交通局',
  agency_short_name: '都営交通',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: 'E60012', text: 'FFFFFF' }],
};

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
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_type: 0 as const,
  route_color: 'E60012',
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
        routeDirection: {
          route: greenRoute,
          tripHeadsign: {
            name: '新橋駅前',
            names: {
              ja: '新橋駅前',
              'ja-Hrkt': 'しんばしえきまえ',
              en: 'Shimbashi Sta.',
            },
          },
        },
      },
      {
        ...createEntry({ departureMinutes: 892 }),
        routeDirection: {
          route: greenRoute,
          tripHeadsign: {
            name: '新橋駅前',
            names: {
              ja: '新橋駅前',
              'ja-Hrkt': 'しんばしえきまえ',
              en: 'Shimbashi Sta.',
            },
          },
        },
      },
    ],
    agency,
  },
  // Long route name + headsign with translations
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 875 }),
        routeDirection: {
          route: longRoute,
          tripHeadsign: {
            name: '三ノ輪橋',
            names: { 'ja-Hrkt': 'みのわばし', en: 'Minowabashi' },
          },
        },
      },
      {
        ...createEntry({ route: longRoute, departureMinutes: 890 }),
        routeDirection: {
          route: longRoute,
          tripHeadsign: {
            name: '三ノ輪橋',
            names: { 'ja-Hrkt': 'みのわばし', en: 'Minowabashi' },
          },
        },
      },
    ],
    agency: longAgency,
  },
  // Long route name + different headsign with translations
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 880 }),
        routeDirection: {
          route: longRoute,
          tripHeadsign: {
            name: '早稲田',
            names: { 'ja-Hrkt': 'わせだ', en: 'Waseda' },
          },
        },
      },
    ],
    agency: longAgency,
  },
  // Long route + long headsign with long translations (Kyoto-style)
  {
    entries: [
      {
        ...createEntry({ route: longRoute, departureMinutes: 882 }),
        routeDirection: {
          route: longRoute,
          tripHeadsign: {
            name: '北大路バスターミナル・下鴨神社・出町柳駅',
            names: {
              en: 'Kitaoji Bus Terminal via Shimogamo Shrine & Demachiyanagi Sta.',
            },
          },
        },
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
        routeDirection: {
          route: longRoute,
          tripHeadsign: {
            name: '三ノ輪橋',
            names: { 'ja-Hrkt': 'みのわばし', en: 'Minowabashi' },
          },
        },
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
        routeDirection: {
          route: longRoute,
          tripHeadsign: {
            name: '北大路バスターミナル・下鴨神社・出町柳駅',
            names: {
              en: 'Kitaoji Bus Terminal via Shimogamo Shrine & Demachiyanagi Sta.',
            },
          },
        },
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
        routeDirection: {
          route: baseRoute,
          tripHeadsign: {
            name: '新宿',
            names: { en: 'Shinjuku' },
          },
        },
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

export const KitchenSinkInfoLevelSimple: Story = {
  args: { entries: threeEntries },
  render: () => (
    <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
      {kitchenSinkGroups.map((group, i) => (
        <DepartureItem
          key={i}
          entries={group.entries}
          now={now}
          infoLevel="simple"
          dataLang={['ja']}
          showRouteTypeIcon
          agency={group.agency}
          onShowTimetable={fn()}
        />
      ))}
    </div>
  ),
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { entries: threeEntries },
  render: () => (
    <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
      {kitchenSinkGroups.map((group, i) => (
        <DepartureItem
          key={i}
          entries={group.entries}
          now={now}
          infoLevel="normal"
          dataLang={['ja']}
          showRouteTypeIcon
          agency={group.agency}
          onShowTimetable={fn()}
        />
      ))}
    </div>
  ),
};

export const KitchenSinkInfoLevelDetailed: Story = {
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

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { entries: threeEntries },
  render: () => (
    <div className="max-w-sm rounded-lg bg-[#f5f7fa] p-3 dark:bg-gray-800">
      {kitchenSinkGroups.map((group, i) => (
        <DepartureItem
          key={i}
          entries={group.entries}
          now={now}
          infoLevel="verbose"
          dataLang={['ja']}
          showRouteTypeIcon
          agency={group.agency}
          onShowTimetable={fn()}
        />
      ))}
    </div>
  ),
};

// --- stop_headsign patterns ---

/** trip empty + stop present (keio-bus pattern). */
export const TripEmptyStopPresent: Story = {
  args: {
    entries: [
      createEntry({ headsign: '', stopHeadsign: '武蔵小金井駅南口' }),
      createEntry({ headsign: '', stopHeadsign: '武蔵小金井駅南口', departureMinutes: 885 }),
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
      createEntry({
        route: longRoute,
        headsign: '北大路BT・下鴨神社・出町柳駅',
        stopHeadsign: '出町柳駅',
        departureMinutes: 885,
      }),
    ],
    agency: longAgency,
  },
};
