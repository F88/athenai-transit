import type { Meta, StoryObj } from '@storybook/react-vite';
import { RelativeTime } from './relative-time';

/** Base time: 14:25 */
const now = new Date('2026-03-30T14:25:00');

/** Create a departure time N minutes from now. */
function dep(minutes: number): Date {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

const meta = {
  title: 'Departure/RelativeTime',
  component: RelativeTime,
  args: {
    departureTime: dep(5),
    now,
    size: 'default',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    isTerminal: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RelativeTime>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Imminent: Story = {
  args: { departureTime: dep(0) },
};

export const Terminal: Story = {
  args: { departureTime: dep(5), isTerminal: true },
};

// --- Size variants ---

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeLg: Story = {
  args: { size: 'lg' },
};

// --- Size x state combinations ---

export const SmImminent: Story = {
  args: { departureTime: dep(0), size: 'sm' },
};

export const SmTerminal: Story = {
  args: { departureTime: dep(3), size: 'sm', isTerminal: true },
};

export const NormalImminent: Story = {
  args: { departureTime: dep(0) },
};

export const NormalTerminal: Story = {
  args: { departureTime: dep(3), isTerminal: true },
};

export const LgImminent: Story = {
  args: { departureTime: dep(0), size: 'lg' },
};

export const LgTerminal: Story = {
  args: { departureTime: dep(3), size: 'lg', isTerminal: true },
};

// --- Time bands (all colors) ---

export const AllTimeBands: Story = {
  render: (args) => {
    const times = [0, 0.5, 1, 2, 3, 4, 5, 9, 10, 11, 15, 16, 29, 30, 59, 60, 61];
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        {times.map((min) => (
          <div key={min} className="flex items-center gap-4">
            <span className="w-16 text-right text-xs text-gray-500">{min}分後</span>
            <RelativeTime
              departureTime={dep(min)}
              now={now}
              size={args.size}
              isTerminal={args.isTerminal}
            />
          </div>
        ))}
      </div>
    );
  },
};

/** All time bands with terminal suffix. */
export const AllTimeBandsTerminal: Story = {
  args: { isTerminal: true },
  render: (args) => {
    const times = [0, 0.5, 1, 2, 3, 4, 5, 9, 10, 11, 15, 16, 29, 30, 59, 60, 61];
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        {times.map((min) => (
          <div key={min} className="flex items-center gap-4">
            <span className="w-16 text-right text-xs text-gray-500">{min}分後</span>
            <RelativeTime
              departureTime={dep(min)}
              now={now}
              size={args.size}
              isTerminal={args.isTerminal}
            />
          </div>
        ))}
      </div>
    );
  },
};
