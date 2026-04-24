import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import {
  JourneyTimeBar,
  type JourneyTimeBarBorder,
  type JourneyTimeBarFillDirection,
  type JourneyTimeBarMinutesPosition,
  type JourneyTimeBarSize,
} from './journey-time-bar';

const meta = {
  title: 'Departure/JourneyTimeBar',
  component: JourneyTimeBar,
  argTypes: {
    remainingMinutes: { control: { type: 'number' } },
    totalMinutes: { control: { type: 'number' } },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    fillColor: { control: 'color' },
    unfilledColor: { control: 'color' },
    showEmoji: { control: 'boolean' },
    showRMins: { control: 'boolean' },
    showTMins: { control: 'boolean' },
    rTimeLabel: { control: 'text' },
    tMinsLabel: { control: 'text' },
    minsTextColor: { control: 'color' },
    minsBgColor: { control: 'color' },
    minsPosition: {
      control: 'inline-radio',
      options: ['top', 'bottom', 'left', 'right'],
    },
    fillDirection: {
      control: 'inline-radio',
      options: ['ltr', 'rtl'],
    },
    border: { control: 'object' },
    showBorder: { control: 'boolean' },
    borderColor: { control: 'color' },
    maxMinutes: { control: { type: 'number', min: 1 } },
  },
  args: {
    remainingMinutes: 20,
    totalMinutes: 30,
    size: 'sm',
    unfilledColor: 'rgba(148, 163, 184, 0.35)',
    showRMins: false,
    showTMins: false,
    minsPosition: 'bottom',
    fillDirection: 'ltr',
  },
  decorators: [
    (Story) => (
      <div className="w-80 rounded bg-[#f5f7fa] p-3 dark:bg-gray-800">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JourneyTimeBar>;

export default meta;
type Story = StoryObj<typeof meta>;
interface JourneyTimeBarStoryArgs {
  remainingMinutes: number | undefined;
  totalMinutes: number | undefined;
  maxMinutes?: number;
  size?: JourneyTimeBarSize;
  fillColor?: string;
  unfilledColor: string;
  border?: JourneyTimeBarBorder;
  showBorder?: boolean;
  borderColor?: string;
  showRMins?: boolean;
  showTMins?: boolean;
  rTimeLabel?: string;
  tMinsLabel?: string;
  minsPosition?: JourneyTimeBarMinutesPosition;
  fillDirection?: JourneyTimeBarFillDirection;
  minsTextColor?: string;
  minsBgColor?: string;
  showEmoji?: boolean;
}

/** Small helper to label each row in a grouped story. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-gray-500">{label}</div>
      {children}
    </div>
  );
}

/** Default: mid-trip with no labels. Use Controls to tweak any prop. */
export const Default: Story = {};

/**
 * Progress variants — different `remainingMinutes` values against the
 * same 30-min trip, covering origin / mid / near-terminal / terminal.
 */
export const ProgressValues: Story = {
  args: { totalMinutes: 30 },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const samples: { label: string; remaining: number }[] = [
      { label: 'origin (29/30)', remaining: 29 },
      { label: 'middle (15/30)', remaining: 15 },
      { label: 'near terminal (2/30)', remaining: 2 },
      { label: 'terminal (0/30)', remaining: 0 },
    ];
    return (
      <div className="flex flex-col gap-4">
        {samples.map((s) => (
          <Row key={s.label} label={s.label}>
            <JourneyTimeBar {...rest} remainingMinutes={s.remaining} />
          </Row>
        ))}
      </div>
    );
  },
};

/**
 * Duration variants — different `totalMinutes` values to show how the
 * bar width scales against `MAX_BAR_MINUTES` (120) and clamps beyond.
 */
export const Durations: Story = {
  args: {},
  render: (rest: JourneyTimeBarStoryArgs) => {
    const samples: { label: string; remaining: number; total: number }[] = [
      { label: 'short 10min', remaining: 5, total: 10 },
      { label: 'median 29min', remaining: 14, total: 29 },
      { label: 'p90 60min', remaining: 30, total: 60 },
      { label: 'boundary 120min', remaining: 60, total: 120 },
      { label: 'kcbus 140min (clamped)', remaining: 70, total: 140 },
      { label: 'iyt2 730min (clamped)', remaining: 365, total: 730 },
    ];
    return (
      <div className="flex flex-col gap-4">
        {samples.map((s) => (
          <Row key={s.label} label={s.label}>
            <JourneyTimeBar {...rest} remainingMinutes={s.remaining} totalMinutes={s.total} />
          </Row>
        ))}
      </div>
    );
  },
};

/**
 * All `size` variants stacked with both minute labels on so the
 * per-size BaseLabel sizing (internal `LABEL_SIZE_FOR_BAR` mapping) is
 * visible at a glance.
 */
export const Sizes: Story = {
  args: {
    remainingMinutes: 15,
    totalMinutes: 30,
    showRMins: true,
    showTMins: true,
    minsPosition: 'left',
  },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const sizes: JourneyTimeBarSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    return (
      <div className="flex flex-col gap-4">
        {sizes.map((s) => (
          <Row key={s} label={`size=${s}`}>
            <JourneyTimeBar {...rest} size={s} />
          </Row>
        ))}
      </div>
    );
  },
};

/** Default + route color samples for the `fillColor` prop. */
export const Colors: Story = {
  args: { remainingMinutes: 15, totalMinutes: 30 },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const samples: { label: string; fillColor?: string }[] = [
      { label: 'default (primary)' },
      { label: 'Oedo #cf3366', fillColor: '#cf3366' },
      { label: 'Mita #0067b0', fillColor: '#0067b0' },
      { label: 'Asakusa #ff535f', fillColor: '#ff535f' },
    ];
    return (
      <div className="flex flex-col gap-4">
        {samples.map((s) => (
          <Row key={s.label} label={s.label}>
            <JourneyTimeBar {...rest} fillColor={s.fillColor} />
          </Row>
        ))}
      </div>
    );
  },
};

/** Emoji prefix and colored minute pill, matching StopTimeItem usage. */
export const WithEmojiAndColoredLabel: Story = {
  args: {
    remainingMinutes: 15,
    totalMinutes: 30,
    fillColor: '#cf3366',
    unfilledColor: '#cf336650',
    showEmoji: true,
    showRMins: true,
    showTMins: true,
    minsPosition: 'right',
    minsTextColor: '#ffffff',
    minsBgColor: '#cf3366',
  },
};

/** Simple border shortcut via showBorder/borderColor without the full border object. */
export const BorderShortcut: Story = {
  args: {
    remainingMinutes: 15,
    totalMinutes: 30,
    fillColor: '#cf3366',
    unfilledColor: '#cf336650',
    showRMins: true,
    showTMins: true,
    minsPosition: 'right',
    showBorder: true,
    borderColor: '#cf3366',
    minsTextColor: '#ffffff',
    minsBgColor: '#cf3366',
  },
};

/** `border` variants — off / default / custom width / dashed / colored. */
export const Borders: Story = {
  args: {
    remainingMinutes: 15,
    totalMinutes: 30,
    fillColor: '#cf3366',
    unfilledColor: '#cf336650',
  },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const samples: { label: string; border?: JourneyTimeBarBorder }[] = [
      { label: 'none (default)' },
      { label: 'default {}', border: {} },
      { label: 'width=2', border: { width: 2 } },
      { label: 'dashed', border: { style: 'dashed' } },
      { label: 'dotted', border: { style: 'dotted' } },
      { label: 'custom color', border: { color: '#cf3366' } },
    ];
    return (
      <div className="flex flex-col gap-4">
        {samples.map((s) => (
          <Row key={s.label} label={s.label}>
            <JourneyTimeBar {...rest} border={s.border} />
          </Row>
        ))}
      </div>
    );
  },
};

/** `fillDirection` variants — ltr (default) vs rtl. */
export const FillDirections: Story = {
  args: {
    remainingMinutes: 15,
    totalMinutes: 30,
    fillColor: '#cf3366',
    unfilledColor: '#cf336650',
  },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const dirs: JourneyTimeBarFillDirection[] = ['ltr', 'rtl'];
    return (
      <div className="flex flex-col gap-4">
        {dirs.map((d) => (
          <Row key={d} label={`fillDirection=${d}`}>
            <JourneyTimeBar {...rest} fillDirection={d} />
          </Row>
        ))}
      </div>
    );
  },
};

/**
 * `showRMins` × `showTMins` combinations across all four `minsPosition`
 * values. The 4 positions (top / bottom / left / right) are grouped as
 * outer sections, and each section lists the 4 show-flag combinations
 * (none / remaining only / total only / both) so each combo can be
 * compared in every placement at a glance.
 */
export const LabelCombinations: Story = {
  args: { remainingMinutes: 15, totalMinutes: 30 },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const combos: { label: string; r: boolean; t: boolean }[] = [
      { label: 'none', r: false, t: false },
      { label: 'showRMins', r: true, t: false },
      { label: 'showTMins', r: false, t: true },
      { label: 'both', r: true, t: true },
    ];
    const positions: JourneyTimeBarMinutesPosition[] = [
      'right',
      'left',
      //
      'top',
      'bottom',
    ];
    return (
      <div className="flex flex-col gap-6">
        {positions.map((p) => (
          <div key={p}>
            <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
              minsPosition={p}
            </div>
            <div className="flex flex-col gap-3">
              {combos.map((c) => (
                <Row key={c.label} label={c.label}>
                  <JourneyTimeBar {...rest} minsPosition={p} showRMins={c.r} showTMins={c.t} />
                </Row>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

/** `rTimeLabel` / `tMinsLabel` prefix variants. */
export const LabelPrefixes: Story = {
  args: { remainingMinutes: 15, totalMinutes: 30, showRMins: true, showTMins: true },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const samples: { label: string; r?: string; t?: string }[] = [
      { label: 'no prefix' },
      { label: 'Japanese 残り / 全体', r: '残り', t: '全体' },
      { label: 'remaining only (残り)', r: '残り' },
      { label: 'total only (全体)', t: '全体' },
    ];
    return (
      <div className="flex flex-col gap-4">
        {samples.map((s) => (
          <Row key={s.label} label={s.label}>
            <JourneyTimeBar {...rest} rTimeLabel={s.r} tMinsLabel={s.t} />
          </Row>
        ))}
      </div>
    );
  },
};

/** All four `minsPosition` values. */
export const MinutesPositions: Story = {
  args: {
    remainingMinutes: 15,
    totalMinutes: 30,
    showRMins: true,
    showTMins: true,
  },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const positions: JourneyTimeBarMinutesPosition[] = ['top', 'bottom', 'left', 'right'];
    return (
      <div className="flex flex-col gap-4">
        {positions.map((p) => (
          <Row key={p} label={`minsPosition=${p}`}>
            <JourneyTimeBar {...rest} minsPosition={p} />
          </Row>
        ))}
      </div>
    );
  },
};

/** Edge cases — missing / zero values. */
export const MissingData: Story = {
  args: { showRMins: true, showTMins: true },
  render: (rest: JourneyTimeBarStoryArgs) => {
    const samples: {
      label: string;
      remaining: number | undefined;
      total: number | undefined;
    }[] = [
      { label: 'missing total', remaining: 10, total: undefined },
      { label: 'missing remaining', remaining: undefined, total: 30 },
      { label: 'both missing', remaining: undefined, total: undefined },
      { label: 'zero total', remaining: 0, total: 0 },
    ];
    return (
      <div className="flex flex-col gap-4">
        {samples.map((s) => (
          <Row key={s.label} label={s.label}>
            <JourneyTimeBar {...rest} remainingMinutes={s.remaining} totalMinutes={s.total} />
          </Row>
        ))}
      </div>
    );
  },
};

interface DurationSample {
  label: string;
  remaining: number;
  total: number;
}

interface ColorSample {
  label: string;
  fillColor?: string;
}

const durationSamples: DurationSample[] = [
  { label: 'origin, 30min trip', remaining: 29, total: 30 },
  { label: 'mid, 30min trip', remaining: 15, total: 30 },
  { label: 'near terminal, 30min trip', remaining: 2, total: 30 },
  { label: 'short 10min', remaining: 5, total: 10 },
  { label: 'median 29min', remaining: 14, total: 29 },
  { label: 'p90 60min', remaining: 30, total: 60 },
  { label: 'p99 116min', remaining: 58, total: 116 },
  { label: 'kcbus 140min (clamped)', remaining: 70, total: 140 },
  { label: 'iyt2 730min (clamped)', remaining: 365, total: 730 },
];

const colorSamples: ColorSample[] = [
  { label: 'default (primary)' },
  { label: 'Oedo #cf3366', fillColor: '#cf3366' },
  { label: 'Mita #0067b0', fillColor: '#0067b0' },
  { label: 'Asakusa #ff535f', fillColor: '#ff535f' },
];

/**
 * Duration × color grid for the active `size` (driven by Controls).
 * Lets the reader eyeball width scaling, clamp behavior, and color
 * overrides at a glance. Switch size via the Controls panel.
 */
export const KitchenSink: Story = {
  args: {
    remainingMinutes: 15,
    totalMinutes: 30,
    showEmoji: true,
    showRMins: true,
    showTMins: true,
    minsPosition: 'right',
    minsTextColor: '#ffffff',
    minsBgColor: '#cf3366',
    showBorder: true,
    borderColor: '#cf3366',
  },
  render: (args: JourneyTimeBarStoryArgs) => {
    const {
      size,
      fillDirection,
      minsPosition,
      border,
      showRMins,
      showTMins,
      showEmoji,
      minsTextColor,
      minsBgColor,
      showBorder,
      borderColor,
    } = args;

    return (
      <div className="flex flex-col gap-3">
        {colorSamples.map((c) => (
          <div key={c.label}>
            <div className="text-[10px] text-gray-400">{c.label}</div>
            <div className="flex flex-col gap-1">
              {durationSamples.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-48 text-[10px] text-gray-500">{d.label}</span>
                  <div className="w-60">
                    <JourneyTimeBar
                      size={size}
                      fillColor={c.fillColor}
                      unfilledColor={c.fillColor ? `${c.fillColor}50` : 'rgba(148, 163, 184, 0.35)'}
                      remainingMinutes={d.remaining}
                      totalMinutes={d.total}
                      showRMins={showRMins}
                      showTMins={showTMins}
                      minsPosition={minsPosition}
                      fillDirection={fillDirection}
                      border={border}
                      showEmoji={showEmoji}
                      minsTextColor={minsTextColor}
                      minsBgColor={c.fillColor ? minsBgColor : undefined}
                      showBorder={showBorder}
                      borderColor={c.fillColor ? borderColor : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
