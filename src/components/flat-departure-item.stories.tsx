import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ContextualTimetableEntry, StopServiceType } from '../types/app/transit-composed';
import type { Agency, Route } from '../types/app/transit';
import { FlatDepartureItem } from './flat-departure-item';

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
  route_long_name: '東京さくらトラム（都電荒川線）',
  route_type: 0 as const,
  route_color: 'E60012',
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
      routeDirection: {
        route: greenRoute,
        tripHeadsign: {
          name: '新橋駅前',
          names: { ja: '新橋駅前', 'ja-Hrkt': 'しんばしえきまえ', en: 'Shimbashi Sta.' },
        },
      },
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
      routeDirection: {
        route: longRoute,
        tripHeadsign: {
          name: '三ノ輪橋',
          names: { 'ja-Hrkt': 'みのわばし', en: 'Minowabashi' },
        },
      },
    },
    icon: true,
    agency,
  },
  // 3分後 — long route + headsign with translations (Waseda)
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 868 }),
      routeDirection: {
        route: longRoute,
        tripHeadsign: {
          name: '早稲田',
          names: { 'ja-Hrkt': 'わせだ', en: 'Waseda' },
        },
      },
    },
    icon: true,
  },
  // 3分後 — long route + long headsign (Kyoto-style)
  {
    entry: {
      ...createEntry({ route: longRoute, departureMinutes: 868 }),
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
      routeDirection: {
        route: baseRoute,
        tripHeadsign: {
          name: '新宿',
          names: { en: 'Shinjuku' },
        },
      },
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

export const KitchenSinkInfoLevelSimple: Story = {
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
          infoLevel="simple"
          dataLang={['ja']}
          agency={a}
        />
      ))}
    </div>
  ),
};

export const KitchenSinkInfoLevelNormal: Story = {
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
          infoLevel="normal"
          dataLang={['ja']}
          agency={a}
        />
      ))}
    </div>
  ),
};

export const KitchenSinkInfoLevelDetailed: Story = {
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

export const KitchenSinkInfoLevelVerbose: Story = {
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
          infoLevel="verbose"
          dataLang={['ja']}
          agency={a}
        />
      ))}
    </div>
  ),
};

// --- stop_headsign patterns ---

/** trip empty + stop present (keio-bus pattern). */
export const TripEmptyStopPresent: Story = {
  args: { entry: createEntry({ headsign: '', stopHeadsign: '武蔵小金井駅南口' }) },
};

/** stop overrides trip — stop_headsign differs from trip_headsign. */
export const StopOverridesTrip: Story = {
  args: {
    entry: createEntry({
      headsign: '北大路BT・下鴨神社・出町柳駅',
      stopHeadsign: '出町柳駅',
    }),
  },
};
