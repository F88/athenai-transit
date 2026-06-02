import type { Meta, StoryObj } from '@storybook/react-vite';
import type { InfoLevel } from '../types/app/settings';
import type { StopsCounts } from '../types/app/stop';
import { StopsSummary } from './stops-summary';

const defaultTotalCount: StopsCounts = {
  total: 60,
  nonEmpty: 42,
  originCount: 8,
  boardableCount: 36,
};

const emptyCount: StopsCounts = {
  total: 0,
  nonEmpty: 0,
  originCount: 0,
  boardableCount: 0,
};

const noOperatingCount: StopsCounts = {
  total: 24,
  nonEmpty: 0,
  originCount: 0,
  boardableCount: 0,
};

const meta = {
  title: 'StopBrowser/StopsSummary',
  component: StopsSummary,
  args: {
    label: 'nearby stops',
    totalCount: defaultTotalCount,
    filteredCount: 60,
    nearbyRadius: 1_000,
    omitEmptyStops: false,
    hasLoaded: true,
    infoLevel: 'normal',
    size: 'md',
  },
  argTypes: {
    hasLoaded: { control: 'boolean' },
    omitEmptyStops: { control: 'boolean' },
    filteredCount: { control: { type: 'number', min: 0 } },
    nearbyRadius: { control: { type: 'number', min: 0, step: 100 } },
    infoLevel: { control: 'inline-radio', options: ['simple', 'normal', 'detailed', 'verbose'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-lg bg-white p-4 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StopsSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Loading: Story = {
  args: {
    hasLoaded: false,
    totalCount: emptyCount,
    filteredCount: 0,
  },
};

export const NoStops: Story = {
  args: {
    totalCount: emptyCount,
    filteredCount: 0,
    omitEmptyStops: false,
  },
};

export const NoOperatingStops: Story = {
  args: {
    totalCount: noOperatingCount,
    filteredCount: 0,
    omitEmptyStops: true,
  },
};

// --- Radius formatting ---

export const RadiusMeters: Story = {
  args: {
    nearbyRadius: 500,
    filteredCount: 18,
  },
};

export const RadiusKilometers: Story = {
  args: {
    nearbyRadius: 2_000,
    filteredCount: 128,
  },
};

// --- Sizes ---

export const MobileStandardSize: Story = {
  args: { size: 'md' },
};

export const DesktopSize: Story = {
  args: { size: 'lg' },
};

export const ExtraLargeSize: Story = {
  args: { size: 'xl' },
};

export const SizeComparison: Story = {
  args: { infoLevel: 'verbose' },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">size=md</span>
        <StopsSummary {...args} size="md" />
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">size=lg</span>
        <StopsSummary {...args} size="lg" />
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] text-gray-400">size=xl</span>
        <StopsSummary {...args} size="xl" />
      </div>
    </div>
  ),
};

// --- Info levels ---

export const InfoLevelSimple: Story = {
  args: { infoLevel: 'simple' },
};

export const InfoLevelNormal: Story = {
  args: { infoLevel: 'normal' },
};

export const InfoLevelDetailed: Story = {
  args: { infoLevel: 'detailed' },
};

export const InfoLevelVerbose: Story = {
  args: { infoLevel: 'verbose' },
};

export const InfoLevelComparison: Story = {
  render: (args) => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    return (
      <div className="flex flex-col gap-3">
        {levels.map((level) => (
          <div className="space-y-1" key={level}>
            <span className="block text-[10px] text-gray-400">infoLevel={level}</span>
            <StopsSummary {...args} infoLevel={level} />
          </div>
        ))}
      </div>
    );
  },
};

// --- Kitchen sink ---

const kitchenSinkArgs = {
  label: 'operating stops only',
  totalCount: {
    total: 1_234,
    nonEmpty: 987,
    originCount: 321,
    boardableCount: 876,
  },
  filteredCount: 987,
  nearbyRadius: 2_000,
  omitEmptyStops: true,
  hasLoaded: true,
};

export const KitchenSinkInfoLevelSimple: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'simple' as const, size: 'lg' as const },
};

export const KitchenSinkInfoLevelNormal: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'normal' as const, size: 'lg' as const },
};

export const KitchenSinkInfoLevelDetailed: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'detailed' as const, size: 'lg' as const },
};

export const KitchenSinkInfoLevelVerbose: Story = {
  args: { ...kitchenSinkArgs, infoLevel: 'verbose' as const, size: 'lg' as const },
};
