import type { Meta, StoryObj } from '@storybook/react-vite';
import { AbsoluteStopTime } from './absolute-stop-time';

const meta = {
  title: 'StopTime/AbsoluteStopTime',
  component: AbsoluteStopTime,
  args: {
    timeText: '14:30',
    size: 'md',
    weight: 'bold',
    showArrivalMarker: false,
    showDepartureMarker: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    weight: { control: 'inline-radio', options: ['normal', 'bold'] },
    textColor: { control: 'color' },
    showArrivalMarker: { control: 'boolean' },
    showDepartureMarker: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AbsoluteStopTime>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

/** Default: plain absolute time with no marker. */
export const Default: Story = {};

/** Departure row: the time carries the departure marker suffix. */
export const WithDepartureMarker: Story = {
  args: { showDepartureMarker: true },
};

/** Arrival row: the time carries the arrival marker suffix. */
export const WithArrivalMarker: Story = {
  args: { showArrivalMarker: true },
};

/**
 * Overnight time past midnight (service-day minutes >= 1440 render as 24:00+),
 * so the widest realistic time text is exercised.
 */
export const OvernightTime: Story = {
  args: { timeText: '27:45', showDepartureMarker: true },
};

// --- Variants ---

/** Route-colored time text via `textColor`. */
export const Colored: Story = {
  args: { textColor: '#0d9488', showDepartureMarker: true },
};

/** Normal (non-bold) weight. */
export const NormalWeight: Story = {
  args: { weight: 'normal' },
};

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/**
 * The same time at every display size, smallest to largest. A departure marker is
 * shown so the marker suffix scaling (it tracks the size) is visible too.
 */
export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {SIZES.map((size) => (
        <div key={size} className="flex items-center gap-3">
          <span className="w-12 text-right text-xs text-gray-500">{size}</span>
          <AbsoluteStopTime {...args} size={size} showDepartureMarker />
        </div>
      ))}
    </div>
  ),
};

/** Side-by-side of the no-marker / arrival / departure variants. */
export const MarkerComparison: Story = {
  render: (args) => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-gray-500">none</span>
        <AbsoluteStopTime {...args} showArrivalMarker={false} showDepartureMarker={false} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-gray-500">arrival</span>
        <AbsoluteStopTime {...args} showArrivalMarker showDepartureMarker={false} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-gray-500">departure</span>
        <AbsoluteStopTime {...args} showArrivalMarker={false} showDepartureMarker />
      </div>
    </div>
  ),
};

// --- Kitchen sink ---

/**
 * Maximum-content scenario: overnight time text, both markers rendered, colored,
 * at the largest size.
 */
export const KitchenSink: Story = {
  args: {
    timeText: '27:45',
    size: 'xl',
    weight: 'bold',
    textColor: '#0d9488',
    showArrivalMarker: true,
    showDepartureMarker: true,
  },
};
