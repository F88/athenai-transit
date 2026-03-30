import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import type { Agency } from '../types/app/transit';
import { fn } from 'storybook/test';
import { DepartureItem } from './departure-item';

/** Fictional base route for stories. */
const baseRoute = {
  route_id: 'route-001',
  route_short_name: '渋64',
  route_long_name: '渋谷駅〜中野駅',
  route_names: {},
  route_type: 3 as const,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'agency-001',
};

const greenRoute = {
  ...baseRoute,
  route_id: 'route-002',
  route_short_name: '都01',
  route_long_name: '渋谷駅〜新橋駅',
  route_color: '00A850',
};

const tramRoute = {
  ...baseRoute,
  route_id: 'route-003',
  route_short_name: '荒川線',
  route_long_name: '三ノ輪橋〜早稲田',
  route_type: 0 as const,
  route_color: 'E60012',
};

const noColorRoute = {
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
  agency_colors: [{ bg: '#00A850', text: '#FFFFFF' }],
};

/** Create a ContextualTimetableEntry for stories. */
function createEntry(
  overrides: Partial<{
    departureMinutes: number;
    arrivalMinutes: number;
    route: typeof baseRoute;
    headsign: string;
    pickupType: number;
    dropOffType: number;
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
  args: { infoLevel: 'detailed', agencyName: '都営バス', agency },
};

export const Verbose: Story = {
  args: {
    infoLevel: 'verbose',
    agencyName: '都営バス',
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
            showRouteTypeIcon
            onShowTimetable={fn()}
          />
        ))}
      </div>
    );
  },
};
