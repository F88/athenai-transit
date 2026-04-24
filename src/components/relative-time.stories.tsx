import type { Meta, StoryObj } from '@storybook/react-vite';
import { RELATIVE_TIME_BANDS } from '../utils/time-style';
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
    time: dep(5),
    now,
    size: 'md',
    showPastTime: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    showPastTime: { control: 'boolean' },
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
  args: { time: dep(0) },
};

export const PastHidden: Story = {
  args: { time: dep(-1) },
  render: (args) => (
    <div className="flex items-center gap-4">
      <span className="w-16 text-right text-xs text-gray-500">1分前</span>
      <div className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500">
        <RelativeTime {...args} />
        <span>hidden</span>
      </div>
    </div>
  ),
};

export const PastVisible: Story = {
  args: { time: dep(-3), showPastTime: true },
};

export const PastComparison: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
      <div className="flex items-center gap-4">
        <span className="w-20 text-right text-xs text-gray-500">3分前 hidden</span>
        <div className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500">
          <RelativeTime {...args} time={dep(-3)} showPastTime={false} />
          <span>hidden</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="w-20 text-right text-xs text-gray-500">3分前 visible</span>
        <RelativeTime {...args} time={dep(-3)} showPastTime={true} />
      </div>
    </div>
  ),
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
  args: { time: dep(0), size: 'sm' },
};

export const NormalImminent: Story = {
  args: { time: dep(0) },
};

export const LgImminent: Story = {
  args: { time: dep(0), size: 'lg' },
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
            <RelativeTime time={dep(min)} now={now} size={args.size} />
          </div>
        ))}
      </div>
    );
  },
};

export const StateComparison: Story = {
  render: (args) => {
    const samples = [
      { label: '1分前', time: dep(-1), showPastTime: false },
      { label: '1分前 visible', time: dep(-1), showPastTime: true },
      { label: '0分後', time: dep(0) },
      { label: '5分後', time: dep(5) },
      { label: '100分後', time: dep(100) },
    ];

    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        {samples.map((sample) => (
          <div key={sample.label} className="flex items-center gap-4">
            <span className="w-16 text-right text-xs text-gray-500">{sample.label}</span>
            <div className="min-h-5 min-w-24">
              <RelativeTime
                {...args}
                time={sample.time}
                now={now}
                size="md"
                showPastTime={sample.showPastTime ?? args.showPastTime}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

export const TimeComparison: Story = {
  render: (args) => {
    const samples = [
      { label: '<= -601s', seconds: -601, showPastTime: true },
      { label: '-600s..-1s', seconds: -60, showPastTime: true },
      { label: '0s..180s', seconds: 60 },
      { label: '181s..600s', seconds: 400 },
      { label: '601s..900s', seconds: 700 },
      { label: '901s..1800s', seconds: 1200 },
      { label: '1801s..3600s', seconds: 2400 },
      { label: '3601s..inf', seconds: 5000 },
    ];

    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <div className="text-xs text-gray-500">bands: {RELATIVE_TIME_BANDS.length}</div>
        {samples.map((sample) => (
          <div key={sample.label} className="flex items-center gap-4">
            <span className="w-28 text-right text-xs text-gray-500">{sample.label}</span>
            <RelativeTime
              {...args}
              now={now}
              time={new Date(now.getTime() + sample.seconds * 1000)}
              showPastTime={sample.showPastTime ?? false}
            />
          </div>
        ))}
      </div>
    );
  },
};
