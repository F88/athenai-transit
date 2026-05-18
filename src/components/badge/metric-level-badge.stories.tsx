import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarDays, Globe, HardDrive, Route, Signpost, Spline } from 'lucide-react';
import type { ReactNode } from 'react';
import { toMetricLevel } from '../../utils/to-metric-level';
import type { BaseLabelSize } from '../label/base-label';
import {
  AQUA_METRIC_BADGE_TONE_SCALE,
  BLUE_METRIC_BADGE_TONE_SCALE,
  FIVE_LEVEL_METRIC_BADGE_TONE_SCALE,
  GOLD_METRIC_BADGE_TONE_SCALE,
  GRAY_METRIC_BADGE_TONE_SCALE,
  GREEN_METRIC_BADGE_TONE_SCALE,
  ORANGE_METRIC_BADGE_TONE_SCALE,
  PURPLE_METRIC_BADGE_TONE_SCALE,
  RED_METRIC_BADGE_TONE_SCALE,
  SILVER_METRIC_BADGE_TONE_SCALE,
  TEAL_METRIC_BADGE_TONE_SCALE,
  type MetricBadgeTone,
  type MetricBadgeTonePalette,
} from './metric-badge-tone-scale';
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
  badgeTonePalette?: MetricBadgeTonePalette;
  badgeToneScale?: ReadonlyArray<MetricBadgeTone>;
}

function Wrapper(args: WrapperArgs) {
  return (
    <MetricLevelBadge
      icon={ICON_MAP[args.iconName]}
      text={args.text}
      level={args.level}
      size={args.size}
      aria-label={args.ariaLabel}
      badgeTonePalette={args.badgeTonePalette}
      badgeToneScale={args.badgeToneScale}
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

const WARM_TONE_SCALE: ReadonlyArray<MetricBadgeTone> = [
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
    badgeTonePalette: 'default',
  },
  argTypes: {
    iconName: { control: 'select', options: ICON_OPTIONS },
    text: { control: 'text' },
    level: { control: 'number' },
    size: { control: 'inline-radio', options: SIZE_OPTIONS },
    ariaLabel: { control: 'text' },
    badgeTonePalette: {
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
    badgeToneScale: { control: false },
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

export const ThresholdDirectionComparison: Story = {
  args: {
    iconName: 'Route',
    text: '24',
    size: 'sm',
    badgeTonePalette: 'blue',
    ariaLabel: 'Routes: 24',
  },
  render: (args) => {
    const samples = [
      {
        label: 'Routes',
        iconName: 'Route' as const,
        value: 24,
        text: '24',
        thresholds: [0, 5, 20, 100, 300],
      },
      {
        label: 'Stops',
        iconName: 'Signpost' as const,
        value: 142,
        text: '142',
        thresholds: [0, 20, 100, 500, 2000],
      },
      {
        label: 'Trips/day',
        iconName: 'CalendarDays' as const,
        value: 687,
        text: '687/d',
        thresholds: [0, 100, 500, 2000, 8000],
      },
    ];

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="w-24 shrink-0">metric</span>
          <span className="w-32 shrink-0">ascending</span>
          <span className="w-32 shrink-0">descending</span>
        </div>
        {samples.map((sample) => {
          const ascendingLevel = toMetricLevel(sample.value, sample.thresholds, {
            direction: 'ascending',
          });
          const descendingLevel = toMetricLevel(sample.value, sample.thresholds, {
            direction: 'descending',
          });

          return (
            <div key={sample.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-gray-500">{sample.label}</span>
              <div className="flex w-32 shrink-0 items-center gap-2">
                <Wrapper
                  {...args}
                  iconName={sample.iconName}
                  text={sample.text}
                  level={ascendingLevel}
                  ariaLabel={`${sample.label}: ${sample.text}, ascending, level ${ascendingLevel}`}
                />
                <span className="text-xs text-gray-400">L{ascendingLevel}</span>
              </div>
              <div className="flex w-32 shrink-0 items-center gap-2">
                <Wrapper
                  {...args}
                  iconName={sample.iconName}
                  text={sample.text}
                  level={descendingLevel}
                  ariaLabel={`${sample.label}: ${sample.text}, descending, level ${descendingLevel}`}
                />
                <span className="text-xs text-gray-400">L{descendingLevel}</span>
              </div>
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
          <Wrapper {...args} badgeTonePalette={palette} badgeToneScale={undefined} />
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
    const palettes: ReadonlyArray<MetricBadgeTonePalette> = [
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
                  badgeTonePalette={palette}
                  badgeToneScale={undefined}
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
    badgeTonePalette: 'default',
    badgeToneScale: WARM_TONE_SCALE,
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
        <Wrapper {...args} badgeToneScale={FIVE_LEVEL_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Red</span>
        <Wrapper {...args} badgeToneScale={RED_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Blue</span>
        <Wrapper {...args} badgeToneScale={BLUE_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Teal</span>
        <Wrapper {...args} badgeToneScale={TEAL_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Green</span>
        <Wrapper {...args} badgeToneScale={GREEN_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Aqua</span>
        <Wrapper {...args} badgeToneScale={AQUA_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Orange</span>
        <Wrapper {...args} badgeToneScale={ORANGE_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Purple</span>
        <Wrapper {...args} badgeToneScale={PURPLE_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Gray</span>
        <Wrapper {...args} badgeToneScale={GRAY_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Gold</span>
        <Wrapper {...args} badgeToneScale={GOLD_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Silver</span>
        <Wrapper {...args} badgeToneScale={SILVER_METRIC_BADGE_TONE_SCALE} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-xs text-gray-500">Custom</span>
        <Wrapper {...args} badgeToneScale={WARM_TONE_SCALE} />
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
