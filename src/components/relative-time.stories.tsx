import type { Meta, StoryObj } from '@storybook/react-vite';
import { RELATIVE_TIME_BANDS } from '../utils/time-style';
import { storyNow } from '../stories/fixtures';
import { RelativeTime } from './relative-time';

/** Base time for all stories. */
const now = storyNow;

/** Create a departure time N seconds from now. */
function depSeconds(seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000);
}

/** Create a departure time N minutes from now. */
function depMinutes(minutes: number): Date {
  return depSeconds(minutes * 60);
}

function outputFrame(content: React.ReactNode) {
  return (
    <div className="min-h-5 min-w-24 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500">
      {content ?? 'hidden'}
    </div>
  );
}

const meta = {
  title: 'Departure/RelativeTime',
  component: RelativeTime,
  args: {
    time: depMinutes(5),
    now,
    size: 'md',
    align: 'right',
    showPastTime: false,
    hidePrefix: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    align: { control: 'inline-radio', options: ['left', 'center', 'right'] },
    showPastTime: { control: 'boolean' },
    hidePrefix: { control: 'boolean' },
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

export const SoonNow: Story = {
  args: { time: depSeconds(0) },
  name: 'Output: 0s -> まもなく',
};

export const SoonSubMinute: Story = {
  args: { time: depSeconds(59) },
  name: 'Output: +59s -> まもなく',
};

export const FutureBoundary: Story = {
  args: { time: depSeconds(60) },
  name: 'Output: +60s -> あと1分',
};

export const PastComparison: Story = {
  name: 'Output: Past Cases',
  render: (args) => (
    <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
      <div className="text-xs text-gray-500">
        Output check: past times stay hidden unless showPastTime=true and the difference is at least
        1 minute.
      </div>
      <div className="grid grid-cols-[96px_128px_96px] gap-x-3 text-xs text-gray-500">
        <span className="text-right">time diff</span>
        <span className="text-right">showPastTime</span>
        <span>output</span>
      </div>
      <div className="grid grid-cols-[96px_128px_96px] items-center gap-x-3">
        <span className="text-right text-xs text-gray-500">-59s</span>
        <span className="text-right text-xs text-gray-500">false</span>
        <div className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500">
          hidden
        </div>
      </div>
      <div className="grid grid-cols-[96px_128px_96px] items-center gap-x-3">
        <span className="text-right text-xs text-gray-500">-59s</span>
        <span className="text-right text-xs text-gray-500">true</span>
        <div className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500">
          hidden
        </div>
      </div>
      <div className="grid grid-cols-[96px_128px_96px] items-center gap-x-3">
        <span className="text-right text-xs text-gray-500">-3m</span>
        <span className="text-right text-xs text-gray-500">false</span>
        <div className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500">
          hidden
        </div>
      </div>
      <div className="grid grid-cols-[96px_128px_96px] items-center gap-x-3">
        <span className="text-right text-xs text-gray-500">-3m</span>
        <span className="text-right text-xs text-gray-500">true</span>
        <div className="w-24">
          <RelativeTime {...args} className="w-full" time={depMinutes(-3)} showPastTime={true} />
        </div>
      </div>
    </div>
  ),
};

export const HidePrefix: Story = {
  args: { time: depMinutes(5), hidePrefix: true },
  name: 'Output: hidePrefix=true',
};

// --- Variants ---

export const AlignComparison: Story = {
  name: 'Style: Align Comparison',
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['left', 'center', 'right'] as const).map((align) => (
        <div key={align} className="flex items-center gap-3">
          <span className="w-16 text-right text-xs text-gray-500">{align}</span>
          <div className="w-32 border border-dashed border-gray-300 px-2 py-1">
            <RelativeTime {...args} align={align} time={depMinutes(5)} />
          </div>
        </div>
      ))}
    </div>
  ),
};

export const SizeComparison: Story = {
  name: 'Style: Size Comparison',
  render: (args) => (
    <div className="flex flex-col gap-2">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex items-center gap-3">
          <span className="w-12 text-right text-xs text-gray-500">{size}</span>
          <RelativeTime {...args} size={size} time={depMinutes(5)} />
        </div>
      ))}
    </div>
  ),
};

// --- Boundaries ---

export const BoundaryMatrix: Story = {
  name: 'Output: Boundary Matrix',
  render: (args) => {
    const samples = [
      { label: '-61s / showPastTime=true', expected: '-1分', seconds: -61, showPastTime: true },
      { label: '-60s / showPastTime=true', expected: '-1分', seconds: -60, showPastTime: true },
      { label: '-59s / showPastTime=false', expected: 'hidden', seconds: -59, showPastTime: false },
      { label: '-59s / showPastTime=true', expected: 'hidden', seconds: -59, showPastTime: true },
      { label: '0s', expected: 'まもなく', seconds: 0, showPastTime: false },
      { label: '+1s', expected: 'まもなく', seconds: 1, showPastTime: false },
      { label: '+59s', expected: 'まもなく', seconds: 59, showPastTime: false },
      { label: '+60s', expected: 'あと1分', seconds: 60, showPastTime: false },
      { label: '+61s', expected: 'あと1分', seconds: 61, showPastTime: false },
    ];

    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <div className="text-xs text-gray-500">
          Output check: compare current UI output against the expected boundary string.
        </div>
        <div className="grid grid-cols-[176px_88px_96px] gap-x-3 text-xs text-gray-500">
          <span className="text-right">condition</span>
          <span className="text-right">expected</span>
          <span>output</span>
        </div>
        {samples.map((sample) => (
          <div key={sample.label} className="grid grid-cols-[176px_88px_96px] items-center gap-x-3">
            <span className="text-right text-xs text-gray-500">{sample.label}</span>
            <span className="text-right text-xs text-gray-500">{sample.expected}</span>
            {sample.expected === 'hidden'
              ? outputFrame(null)
              : outputFrame(
                  <RelativeTime
                    {...args}
                    now={now}
                    time={depSeconds(sample.seconds)}
                    showPastTime={sample.showPastTime}
                  />,
                )}
          </div>
        ))}
      </div>
    );
  },
};

// --- Style bands ---

export const TimeBandComparison: Story = {
  name: 'Style: Time Bands',
  render: (args) => {
    const samples = [
      { label: '<= -601s', seconds: -601, showPastTime: true },
      { label: '<= -601s (-15m)', seconds: -900, showPastTime: true },
      { label: '-600s..-60s (-5m)', seconds: -300, showPastTime: true },
      { label: '-600s..-60s (-3m)', seconds: -180, showPastTime: true },
      { label: '-600s..-60s', seconds: -60, showPastTime: true },
      { label: '-59s..-1s (-30s)', seconds: -30, showPastTime: true },
      { label: '0s..59s (+30s)', seconds: 30 },
      { label: '0s..180s (1m)', seconds: 60 },
      { label: '0s..180s (2m)', seconds: 120 },
      { label: '0s..180s (3m)', seconds: 180 },
      { label: '181s..600s (4m)', seconds: 240 },
      { label: '181s..600s (5m)', seconds: 300 },
      { label: '181s..600s (6m)', seconds: 360 },
      { label: '181s..600s (7m)', seconds: 420 },
      { label: '181s..600s (8m)', seconds: 480 },
      { label: '181s..600s (9m)', seconds: 540 },
      { label: '181s..600s (10m)', seconds: 600 },
      { label: '601s..900s (11m)', seconds: 660 },
      { label: '601s..900s (12m)', seconds: 720 },
      { label: '601s..900s (13m)', seconds: 780 },
      { label: '601s..900s (14m)', seconds: 840 },
      { label: '601s..900s (15m)', seconds: 900 },
      { label: '901s..1800s', seconds: 1_200 },
      { label: '1801s..3600s', seconds: 2_400 },
      { label: '3601s..inf', seconds: 5_000 },
    ];

    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
        <div className="text-xs text-gray-500">
          Style check: confirm color and opacity changes across the {RELATIVE_TIME_BANDS.length}{' '}
          time bands.
        </div>
        {samples.map((sample) => (
          <div key={sample.label} className="flex items-center gap-4">
            <span className="w-28 text-right text-xs text-gray-500">{sample.label}</span>
            <div className="w-20">
              <RelativeTime
                {...args}
                now={now}
                time={depSeconds(sample.seconds)}
                showPastTime={sample.showPastTime ?? args.showPastTime}
                className="w-full"
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  name: 'Style: Kitchen Sink',
  args: {
    time: depMinutes(5),
    now,
    size: 'xl',
    align: 'right',
    showPastTime: true,
    hidePrefix: false,
  },
  render: (args) => (
    <div className="flex flex-col gap-3 rounded-lg bg-[#f5f7fa] p-4 dark:bg-gray-800">
      <RelativeTime {...args} time={depSeconds(-59)} />
      <RelativeTime {...args} time={depSeconds(59)} />
      <RelativeTime {...args} time={depMinutes(15)} />
    </div>
  ),
};
