import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RouteType } from '../types/app/transit';
import {
  agencyGx,
  agencyOretetsu,
  agencyTobus,
  allAgencies,
  baseStop,
  busRoute,
  busRoute2,
  longNameStop,
  sampleGeo,
  sampleStats,
  storyMapCenter,
  tramRoute,
} from '../stories/fixtures';
import { StopInfo } from './stop-info';

// --- Meta ---

const meta = {
  title: 'StopInfo/StopInfo',
  component: StopInfo,
  args: {
    stop: baseStop,
    routeTypes: [3] as RouteType[],
    agencies: [agencyTobus],
    distance: 235,
    mapCenter: storyMapCenter,
    infoLevel: 'normal',
    isDropOffOnly: false,
    routes: [busRoute],
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    isDropOffOnly: { control: 'boolean' },
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
  routes: [busRoute, busRoute2, tramRoute],
  stats: sampleStats,
  geo: sampleGeo,
};

export const KitchenSinkInfoLevelSimple: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'simple' as const },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'normal' as const },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'detailed' as const },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'verbose' as const },
};
