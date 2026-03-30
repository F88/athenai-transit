import type { Meta, StoryObj } from '@storybook/react-vite';
import { sampleGeo, sampleStats } from '../stories/fixtures';
import { StopMetrics } from './stop-metrics';

const meta = {
  title: 'StopInfo/StopMetrics',
  component: StopMetrics,
  args: {
    stats: sampleStats,
    geo: sampleGeo,
    infoLevel: 'normal',
  },
  argTypes: {
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
  },
} satisfies Meta<typeof StopMetrics>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const StatsOnly: Story = {
  args: { geo: undefined },
};

export const GeoOnly: Story = {
  args: { stats: undefined },
};

export const NoData: Story = {
  args: { stats: undefined, geo: undefined },
};

// --- Geo variants ---

export const WithWalkablePortal: Story = {
  args: { geo: { nearestRoute: 0.12, walkablePortal: 0.35 } },
};

export const WithoutWalkablePortal: Story = {
  args: { geo: { nearestRoute: 0.12 } },
};

export const WithoutConnectivity: Story = {
  args: { geo: { nearestRoute: 0.12 } },
};

export const HighConnectivity: Story = {
  args: {
    geo: {
      nearestRoute: 0.03,
      walkablePortal: 0.15,
      connectivity: {
        ho: { routeCount: 31, freq: 1168, stopCount: 24 },
      },
    },
  },
};

export const LowConnectivity: Story = {
  args: {
    geo: {
      nearestRoute: 2.5,
      connectivity: {
        ho: { routeCount: 1, freq: 8, stopCount: 1 },
      },
    },
  },
};

// --- Info levels ---

export const Simple: Story = {
  args: { infoLevel: 'simple' },
};

export const Normal: Story = {
  args: { infoLevel: 'normal' },
};

export const Detailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const Verbose: Story = {
  args: { infoLevel: 'verbose' },
};

// --- Kitchen sink: all info levels ---

export const KitchenSinkInfoLevelSimple: Story = {
  args: { infoLevel: 'simple' },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { infoLevel: 'normal' },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { infoLevel: 'verbose' },
};
