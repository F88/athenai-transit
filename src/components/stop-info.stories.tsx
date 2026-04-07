import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RouteType } from '../types/app/transit';
import {
  agencyGx,
  agencyOretetsu,
  agencyTobus,
  allAgencies,
  allRoutes,
  baseStop,
  busRoute,
  longNameStop,
  sampleGeo,
  sampleStats,
  storyMapCenter,
  tramRoute,
} from '../stories/fixtures';
import { StopInfo } from './stop-info';

// --- Meta ---

const meta = {
  title: 'Stop/StopInfo',
  component: StopInfo,
  args: {
    stop: baseStop,
    routeTypes: [3] as RouteType[],
    agencies: [agencyTobus],
    distance: 235,
    mapCenter: storyMapCenter,
    infoLevel: 'normal',
    dataLang: ['ja'],
    isDropOffOnly: false,
    routes: [busRoute],
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    isDropOffOnly: { control: 'boolean' },
    agencyBadgeSize: { control: 'inline-radio', options: ['xs', 'sm', 'default'] },
    routeBadgeSize: { control: 'inline-radio', options: ['xs', 'sm', 'default'] },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] px-3 pt-2.5 pb-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const DropOffOnly: Story = {
  args: { isDropOffOnly: true },
};

// --- Distance & direction ---

export const Near: Story = {
  args: { mapCenter: { lat: 35.6955, lng: 139.8134 } },
};

export const Far: Story = {
  args: { mapCenter: { lat: 35.691, lng: 139.805 } },
};

export const NoMapCenter: Story = {
  args: { mapCenter: null },
};

// --- Route types ---

export const Bus: Story = {
  args: { routeTypes: [3] as RouteType[] },
};

export const Tram: Story = {
  args: { routeTypes: [0] as RouteType[] },
};

export const MultiType: Story = {
  args: { routeTypes: [0, 3] as RouteType[], agencies: [agencyGx, agencyOretetsu] },
};

export const MultiTypeDropOff: Story = {
  args: {
    routeTypes: [0, 3] as RouteType[],
    agencies: [agencyGx, agencyOretetsu],
    isDropOffOnly: true,
  },
};

// --- Badge sizes ---

export const CompactBadges: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as RouteType[],
    agencyBadgeSize: 'xs',
    routeBadgeSize: 'xs',
  },
};

export const LargeBadges: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as RouteType[],
    agencyBadgeSize: 'default',
    routeBadgeSize: 'default',
  },
};

export const BadgeSizeComparison: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as RouteType[],
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <StopInfo {...args} agencyBadgeSize="xs" routeBadgeSize="xs" />
      <StopInfo {...args} agencyBadgeSize="sm" routeBadgeSize="sm" />
      <StopInfo {...args} agencyBadgeSize="default" routeBadgeSize="default" />
    </div>
  ),
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Platform code ---

export const PlatformCode: Story = {
  args: { stop: { ...baseStop, platform_code: '2' } },
};

export const PlatformCodeAlpha: Story = {
  args: { stop: { ...baseStop, platform_code: 'G' } },
};

// --- Wheelchair boarding ---

export const WheelchairAccessible: Story = {
  args: { stop: { ...baseStop, wheelchair_boarding: 1 } },
};

export const WheelchairNotAccessible: Story = {
  args: { stop: { ...baseStop, wheelchair_boarding: 2 } },
};

export const WheelchairUnknown: Story = {
  args: { stop: { ...baseStop, wheelchair_boarding: 0 } },
};

// --- Long name ---

export const LongName: Story = {
  args: { stop: longNameStop },
};

export const LongNameDropOff: Story = {
  args: { stop: longNameStop, isDropOffOnly: true },
};

export const LongNameMultiType: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as RouteType[],
    agencies: [agencyGx, agencyOretetsu],
  },
};

/** Kitchen sink: long name, multi-type, all agencies, drop-off-only, stats, geo, routes — all elements visible. */
const kitchenSinkArgs = {
  stop: longNameStop,
  routeTypes: [0, 3] as RouteType[],
  agencies: allAgencies,
  isDropOffOnly: true,
  routes: allRoutes,
  stats: sampleStats,
  geo: sampleGeo,
};

export const KitchenSink: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'detailed' as const },
};
