export interface MetricLevelTone {
  iconBg: string;
  iconFg: string;
  textBg: string;
  textFg: string;
  frameColor: string;
}

export type MetricTonePalette =
  | 'default'
  | 'red'
  | 'blue'
  | 'teal'
  | 'green'
  | 'aqua'
  | 'orange'
  | 'purple'
  | 'gray'
  | 'gold'
  | 'silver';

const NEUTRAL_LEVEL_TONE: MetricLevelTone = {
  iconBg: 'var(--metric-tone-0-icon-bg)',
  iconFg: 'var(--metric-tone-0-icon-fg)',
  textBg: 'var(--metric-tone-0-text-bg)',
  textFg: 'var(--metric-tone-0-text-fg)',
  frameColor: 'var(--metric-tone-0-frame)',
};

function createSingleHueMetricToneScale(accent: string): ReadonlyArray<MetricLevelTone> {
  const frameSteps = [20, 40, 60, 80, 100];
  const textBgSteps = [5, 10, 15, 20, 25];
  const iconBgSteps = [10, 20, 40, 60, 80];
  const iconFgSteps = [100, 90, 80, 50, 30];
  const textFgSteps = [90, 80, 70, 60, 50];

  return [
    NEUTRAL_LEVEL_TONE,
    ...iconBgSteps.map((iconBgMix, index) => ({
      iconBg: `color-mix(in oklab, ${accent} ${iconBgMix}%, var(--background))`,
      iconFg: `color-mix(in oklab, ${accent} ${iconFgSteps[index]}%, var(--foreground))`,
      textBg: `color-mix(in oklab, ${accent} ${textBgSteps[index]}%, var(--background))`,
      textFg: `color-mix(in oklab, ${accent} ${textFgSteps[index]}%, var(--foreground))`,
      frameColor: `color-mix(in oklab, ${accent} ${frameSteps[index]}%, var(--border))`,
    })),
  ];
}

export const FIVE_LEVEL_METRIC_TONE_SCALE: ReadonlyArray<MetricLevelTone> = [
  NEUTRAL_LEVEL_TONE,
  {
    iconBg: 'var(--metric-tone-1-icon-bg)',
    iconFg: 'var(--metric-tone-1-icon-fg)',
    textBg: 'var(--metric-tone-1-text-bg)',
    textFg: 'var(--metric-tone-1-text-fg)',
    frameColor: 'var(--metric-tone-1-frame)',
  },
  {
    iconBg: 'var(--metric-tone-2-icon-bg)',
    iconFg: 'var(--metric-tone-2-icon-fg)',
    textBg: 'var(--metric-tone-2-text-bg)',
    textFg: 'var(--metric-tone-2-text-fg)',
    frameColor: 'var(--metric-tone-2-frame)',
  },
  {
    iconBg: 'var(--metric-tone-3-icon-bg)',
    iconFg: 'var(--metric-tone-3-icon-fg)',
    textBg: 'var(--metric-tone-3-text-bg)',
    textFg: 'var(--metric-tone-3-text-fg)',
    frameColor: 'var(--metric-tone-3-frame)',
  },
  {
    iconBg: 'var(--metric-tone-4-icon-bg)',
    iconFg: 'var(--metric-tone-4-icon-fg)',
    textBg: 'var(--metric-tone-4-text-bg)',
    textFg: 'var(--metric-tone-4-text-fg)',
    frameColor: 'var(--metric-tone-4-frame)',
  },
  {
    iconBg: 'var(--metric-tone-5-icon-bg)',
    iconFg: 'var(--metric-tone-5-icon-fg)',
    textBg: 'var(--metric-tone-5-text-bg)',
    textFg: 'var(--metric-tone-5-text-fg)',
    frameColor: 'var(--metric-tone-5-frame)',
  },
];

export const RED_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.62 0.2 24)');
export const ORANGE_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.72 0.18 58)');

export const TEAL_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.64 0.13 205)');
export const GREEN_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.64 0.18 145)');

export const BLUE_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.58 0.19 255)');
export const AQUA_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.84 0.1 220)');

export const PURPLE_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.58 0.19 315)');

export const GRAY_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.62 0 0)');

export const GOLD_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.78 0.14 92)');
export const SILVER_METRIC_TONE_SCALE = createSingleHueMetricToneScale('oklch(0.74 0.02 250)');

export const METRIC_TONE_SCALES: Readonly<
  Record<MetricTonePalette, ReadonlyArray<MetricLevelTone>>
> = {
  default: FIVE_LEVEL_METRIC_TONE_SCALE,
  red: RED_METRIC_TONE_SCALE,
  blue: BLUE_METRIC_TONE_SCALE,
  teal: TEAL_METRIC_TONE_SCALE,
  green: GREEN_METRIC_TONE_SCALE,
  aqua: AQUA_METRIC_TONE_SCALE,
  orange: ORANGE_METRIC_TONE_SCALE,
  purple: PURPLE_METRIC_TONE_SCALE,
  gray: GRAY_METRIC_TONE_SCALE,
  gold: GOLD_METRIC_TONE_SCALE,
  silver: SILVER_METRIC_TONE_SCALE,
};

export function getMetricToneScale(palette: MetricTonePalette = 'default') {
  return METRIC_TONE_SCALES[palette];
}

export function toMetricLevel(value: number, thresholds: ReadonlyArray<number>): number {
  let level = 0;
  for (const threshold of thresholds) {
    if (value >= threshold) {
      level++;
      continue;
    }
    break;
  }
  return Math.min(level, thresholds.length);
}
