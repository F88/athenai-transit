export interface MetricLevelTone {
  iconBg: string;
  iconFg: string;
  textBg: string;
  textFg: string;
  frameColor: string;
}

export const FIVE_LEVEL_METRIC_TONE_SCALE: ReadonlyArray<MetricLevelTone> = [
  {
    iconBg: '#E5E7EB',
    iconFg: '#4B5563',
    textBg: '#F9FAFB',
    textFg: '#374151',
    frameColor: '#CBD5E1',
  },
  {
    iconBg: '#E0F2FE',
    iconFg: '#0369A1',
    textBg: '#F0F9FF',
    textFg: '#0C4A6E',
    frameColor: '#7DD3FC',
  },
  {
    iconBg: '#DBEAFE',
    iconFg: '#1D4ED8',
    textBg: '#EFF6FF',
    textFg: '#1E3A8A',
    frameColor: '#93C5FD',
  },
  {
    iconBg: '#CCFBF1',
    iconFg: '#0F766E',
    textBg: '#F0FDFA',
    textFg: '#115E59',
    frameColor: '#5EEAD4',
  },
  {
    iconBg: '#D1FAE5',
    iconFg: '#047857',
    textBg: '#ECFDF5',
    textFg: '#065F46',
    frameColor: '#6EE7B7',
  },
  {
    iconBg: '#DCFCE7',
    iconFg: '#15803D',
    textBg: '#F0FDF4',
    textFg: '#166534',
    frameColor: '#86EFAC',
  },
];

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
