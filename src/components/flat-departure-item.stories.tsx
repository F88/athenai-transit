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
      headsign: overrides.headsign ?? '中野駅',
      headsign_names: {},
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
  args: { infoLevel: 'detailed', agencyName: '都営バス', agency },
};

export const Verbose: Story = {
  args: {
    infoLevel: 'verbose',
    agencyName: '都営バス',
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
          />
        ))}
      </div>
    );
  },
};
