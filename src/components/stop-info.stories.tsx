import type { Meta, StoryObj } from '@storybook/react-vite';
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
import { LANG_COMPARISON_CASES } from '../stories/lang-comparison';
import type { AppRouteTypeValue } from '../types/app/transit';
import { StopInfo } from './stop-info';

// --- Meta ---

const meta = {
  title: 'Stop/StopInfo',
  component: StopInfo,
  args: {
    stop: baseStop,
    showAgencies: true,
    showRouteTypes: true,
    routeTypes: [3] as AppRouteTypeValue[],
    agencies: [agencyTobus],
    distance: 235,
    mapCenter: storyMapCenter,
    infoLevel: 'normal',
    dataLangs: ['ja'],
    stopServiceState: 'boardable',
    routes: [busRoute],
    showRoutes: true,
    agencyBadgeSize: 'sm',
    routeBadgeSize: 'sm',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    stopServiceState: { control: 'radio', options: ['boardable', 'drop-off-only', 'no-service'] },
    agencyBadgeSize: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
    routeBadgeSize: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
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
  args: { stopServiceState: 'drop-off-only' },
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
  args: { routeTypes: [3] as AppRouteTypeValue[] },
};

export const Tram: Story = {
  args: { routeTypes: [0] as AppRouteTypeValue[] },
};

export const MultiType: Story = {
  args: { routeTypes: [0, 3] as AppRouteTypeValue[], agencies: [agencyGx, agencyOretetsu] },
};

export const MultiTypeDropOff: Story = {
  args: {
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyGx, agencyOretetsu],
    stopServiceState: 'drop-off-only',
  },
};

// --- Badge sizes ---

export const CompactBadges: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencyBadgeSize: 'xs',
    routeBadgeSize: 'xs',
  },
};

export const LargeBadges: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencyBadgeSize: 'md',
    routeBadgeSize: 'md',
  },
};

export const BadgeSizeComparison: Story = {
  args: {
    infoLevel: 'detailed',
    agencies: [agencyGx, agencyOretetsu],
    routes: [busRoute, tramRoute],
    routeTypes: [0, 3] as AppRouteTypeValue[],
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <StopInfo {...args} agencyBadgeSize="xs" routeBadgeSize="xs" />
      <StopInfo {...args} agencyBadgeSize="sm" routeBadgeSize="sm" />
      <StopInfo {...args} agencyBadgeSize="md" routeBadgeSize="md" />
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
  args: { stop: longNameStop, stopServiceState: 'drop-off-only' },
};

export const LongNameMultiType: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyGx, agencyOretetsu],
  },
};

export const LangComparison: Story = {
  args: {
    stop: longNameStop,
    routeTypes: [0, 3] as AppRouteTypeValue[],
    agencies: [agencyTobus, agencyOretetsu],
    routes: [busRoute, tramRoute],
    infoLevel: 'detailed',
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {LANG_COMPARISON_CASES.map(({ dataLang, label }) => (
        <div key={label} className="space-y-1">
          <span className="block text-[10px] text-gray-400">{label}</span>
          <StopInfo {...args} dataLangs={dataLang} />
        </div>
      ))}
    </div>
  ),
};

/** Kitchen sink: long name, multi-type, all agencies, drop-off-only, stats, geo, routes — all elements visible. */
const kitchenSinkArgs = {
  stop: longNameStop,
  routeTypes: [0, 3] as AppRouteTypeValue[],
  agencies: allAgencies,
  stopServiceState: 'drop-off-only' as const,
  routes: allRoutes,
  stats: sampleStats,
  geo: sampleGeo,
};

export const KitchenSink: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'detailed' as const },
};
