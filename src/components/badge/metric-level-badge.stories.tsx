import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarDays, Globe, HardDrive, Route, Signpost, Spline } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BaseLabelSize } from '../label/base-label';
import {
  BLUE_METRIC_TONE_SCALE,
  AQUA_METRIC_TONE_SCALE,
  FIVE_LEVEL_METRIC_TONE_SCALE,
  GOLD_METRIC_TONE_SCALE,
  GRAY_METRIC_TONE_SCALE,
  GREEN_METRIC_TONE_SCALE,
  ORANGE_METRIC_TONE_SCALE,
  PURPLE_METRIC_TONE_SCALE,
  RED_METRIC_TONE_SCALE,
  SILVER_METRIC_TONE_SCALE,
  TEAL_METRIC_TONE_SCALE,
  type MetricLevelTone,
  type MetricTonePalette,
  toMetricLevel,
} from './metric-level-badge-scale';
import { MetricLevelBadge } from './metric-level-badge';

const ICON_MAP = {
  CalendarDays: <CalendarDays />,
  Globe: <Globe />,
  HardDrive: <HardDrive />,
  Route: <Route />,
  Signpost: <Signpost />,
  Spline: <Spline />,
} as const satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICON_MAP;

interface WrapperArgs {
  iconName: IconName;
  text: string;
  level: number;
  size: BaseLabelSize;
  ariaLabel?: string;
  palette?: MetricTonePalette;
  toneScale?: ReadonlyArray<MetricLevelTone>;
}

function Wrapper(args: WrapperArgs) {
  return (
    <MetricLevelBadge
      icon={ICON_MAP[args.iconName]}
      text={args.text}
      level={args.level}
      size={args.size}
      aria-label={args.ariaLabel}
      palette={args.palette}
      toneScale={args.toneScale}
    />
  );
}

const SIZE_OPTIONS: ReadonlyArray<BaseLabelSize> = ['xs', 'sm', 'md', 'lg', 'xl'];
const ICON_OPTIONS: ReadonlyArray<IconName> = [
  'CalendarDays',
  'Globe',
  'HardDrive',
  'Route',
  'Signpost',
  'Spline',
];

const WARM_TONE_SCALE: ReadonlyArray<MetricLevelTone> = [
  {
    iconBg: '#E5E7EB',
    iconFg: '#4B5563',
    textBg: '#F9FAFB',
    textFg: '#374151',
    frameColor: '#CBD5E1',
  },
  {
    iconBg: '#FEF3C7',
    iconFg: '#B45309',
    textBg: '#FFFBEB',
    textFg: '#92400E',
    frameColor: '#FCD34D',
  },
  {
    iconBg: '#FDE68A',
    iconFg: '#92400E',
    textBg: '#FFFBEB',
    textFg: '#78350F',
    frameColor: '#FBBF24',
  },
  {
    iconBg: '#FDBA74',
    iconFg: '#9A3412',
    textBg: '#FFF7ED',
    textFg: '#9A3412',
    frameColor: '#FB923C',
  },
  {
    iconBg: '#FDBA74',
    iconFg: '#9F1239',
    textBg: '#FFF1F2',
    textFg: '#9F1239',
    frameColor: '#FB7185',
  },
  {
    iconBg: '#FDA4AF',
    iconFg: '#9F1239',
    textBg: '#FFF1F2',
    textFg: '#881337',
    frameColor: '#FB7185',
  },
];

const meta = {
  title: 'Badge/MetricLevelBadge',
  component: Wrapper,
  args: {
    iconName: 'HardDrive',
    text: '3.4 MB',
    level: 3,
    size: 'sm',
    ariaLabel: 'Bundle size: 3.4 MB',
    palette: 'default',
  },
  argTypes: {
    iconName: { control: 'select', options: ICON_OPTIONS },
    text: { control: 'text' },
    level: { control: 'number' },
    size: { control: 'inline-radio', options: SIZE_OPTIONS },
    ariaLabel: { control: 'text' },
    palette: {
      control: 'inline-radio',
      options: [
        'default',
        'red',
        'blue',
        'aqua',
        'teal',
        'green',
        'orange',
        'purple',
        'gray',
        'gold',
        'silver',
      ],
    },
    toneScale: { control: false },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- Basic ---

export const Default: Story = {};

export const Level0: Story = {
  args: { level: 0 },
};

export const Level5: Story = {
  args: { level: 5 },
};

// --- Size variants ---

export const SizeComparison: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-2">
      <Wrapper {...args} size="xs" />
      <Wrapper {...args} size="sm" />
      <Wrapper {...args} size="md" />
      <Wrapper {...args} size="lg" />
      <Wrapper {...args} size="xl" />
    </div>
  ),
};

export const SizeCompasision: Story = {
  ...SizeComparison,
};

// --- Level behavior ---

export const LevelComparison: Story = {
  args: {
    iconName: 'Route',
    text: '24',
    size: 'sm',
    ariaLabel: 'Routes: 24',
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex items-center gap-2">
          <span className="w-12 text-xs text-gray-500">L{level}</span>
          <Wrapper {...args} level={level} />
        </div>
      ))}
    </div>
  ),
};

export const LevelComparision: Story = {
  ...LevelComparison,
};

export const ThresholdExamples: Story = {
  render: (args) => {
    const samples = [
      { label: 'Size', iconName: 'HardDrive' as const, value: 3_400_000, text: '3.4 MB' },
      { label: 'Translations', iconName: 'Globe' as const, value: 3, text: '3' },
      { label: 'Routes', iconName: 'Route' as const, value: 24, text: '24' },
      { label: 'Stops', iconName: 'Signpost' as const, value: 142, text: '142' },
      { label: 'Trips/day', iconName: 'CalendarDays' as const, value: 687, text: '687/d' },
      { label: 'Route shapes', iconName: 'Spline' as const, value: 31, text: '31' },
    ];
    const thresholdsByLabel: Record<string, ReadonlyArray<number>> = {
      Size: [0, 100 * 1024, 1024 * 1024, 5 * 1024 * 1024, 15 * 1024 * 1024],
      Translations: [1, 2, 4],
      Routes: [0, 5, 20, 100, 300],
      Stops: [0, 20, 100, 500, 2000],
      'Trips/day': [0, 100, 500, 2000, 8000],
      'Route shapes': [0, 10, 30, 100, 300],
    };

    return (
      <div className="flex flex-col gap-2">
        {samples.map((sample) => {
          const level = toMetricLevel(sample.value, thresholdsByLabel[sample.label]);
          return (
            <div key={sample.label} className="flex items-center gap-3">
              <span className="w-24 text-xs text-gray-500">{sample.label}</span>
              <Wrapper
                {...args}
                iconName={sample.iconName}
                text={sample.text}
                level={level}
                ariaLabel={`${sample.label}: ${sample.text}`}
              />
              <span className="text-xs text-gray-400">level {level}</span>
            </div>
          );
        })}
      </div>
    );
  },
};

// --- Tone scale variants ---

export const PaletteComparison: Story = {
  args: {
    iconName: 'Signpost',
    text: '142',
    size: 'sm',
    level: 3,
    ariaLabel: 'Stops: 142',
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      {(
        [
          'default',
          'red',
          'blue',
          'aqua',
          'teal',
          'green',
          'orange',
          'purple',
          'gray',
          'gold',
          'silver',
        ] as const
      ).map((palette) => (
        <div key={palette} className="flex items-center gap-2">
          <span className="w-24 text-xs text-gray-500">{palette}</span>
          <Wrapper {...args} palette={palette} toneScale={undefined} />
        </div>
      ))}
    </div>
  ),
};

export const PresetPaletteLevelMatrix: Story = {
  args: {
    iconName: 'Signpost',
    text: '142',
    size: 'sm',
    ariaLabel: 'Stops: 142',
  },
  render: (args) => {
    const palettes: ReadonlyArray<MetricTonePalette> = [
      'default',
      'red',
      'orange',
      'blue',
      'aqua',
      'teal',
      'green',
      'purple',
      'gray',
      'gold',
      'silver',
    ];
    const levels = [0, 1, 2, 3, 4, 5];

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-24 shrink-0">palette</span>
          {levels.map((level) => (
            <span key={level} className="w-14 text-center">
              L{level}
            </span>
          ))}
        </div>
        {palettes.map((palette) => (
          <div key={palette} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-gray-500">{palette}</span>
            <div className="flex flex-wrap items-center gap-2">
              {levels.map((level) => (
                <Wrapper
                  key={`${palette}-${level}`}
                  {...args}
                  palette={palette}
                  toneScale={undefined}
                  level={level}
                  ariaLabel={`Stops: 142, ${palette} palette, level ${level}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

export const CustomToneScale: Story = {
  args: {
    iconName: 'CalendarDays',
    text: '687/d',
    level: 3,
    ariaLabel: 'Trips per day: 687',
    palette: 'default',
    toneScale: WARM_TONE_SCALE,
  },
};

export const ToneScaleComparison: Story = {
  args: {
    iconName: 'CalendarDays',
    text: '687/d',
    size: 'sm',
    level: 3,
    ariaLabel: 'Trips per day: 687',
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Default</span>
        <Wrapper {...args} toneScale={FIVE_LEVEL_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Red</span>
        <Wrapper {...args} toneScale={RED_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Blue</span>
        <Wrapper {...args} toneScale={BLUE_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Teal</span>
        <Wrapper {...args} toneScale={TEAL_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Green</span>
        <Wrapper {...args} toneScale={GREEN_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Aqua</span>
        <Wrapper {...args} toneScale={AQUA_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Orange</span>
        <Wrapper {...args} toneScale={ORANGE_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Purple</span>
        <Wrapper {...args} toneScale={PURPLE_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Gray</span>
        <Wrapper {...args} toneScale={GRAY_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Gold</span>
        <Wrapper {...args} toneScale={GOLD_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Silver</span>
        <Wrapper {...args} toneScale={SILVER_METRIC_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Custom</span>
        <Wrapper {...args} toneScale={WARM_TONE_SCALE} />
      </div>
    </div>
  ),
};

// --- Kitchen sink ---

export const KitchenSink: Story = {
  args: { size: 'sm' },
  render: (args) => {
    const rows = [
      { label: 'Data size', iconName: 'HardDrive' as const, text: '18 MB' },
      { label: 'Translations', iconName: 'Globe' as const, text: '12' },
      { label: 'Routes', iconName: 'Route' as const, text: '312' },
      { label: 'Stops', iconName: 'Signpost' as const, text: '2,842' },
      { label: 'Trips/day', iconName: 'CalendarDays' as const, text: '8,720/d' },
      { label: 'Route shapes', iconName: 'Spline' as const, text: '341' },
    ];

    return (
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-24 text-xs text-gray-500">{row.label}</span>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <Wrapper
                  key={`${row.label}-${level}`}
                  {...args}
                  iconName={row.iconName}
                  text={row.text}
                  level={level}
                  ariaLabel={`${row.label}: ${row.text}, level ${level}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
