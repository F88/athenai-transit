import type { ReactNode } from 'react';
import type { BaseLabelSize } from '../label/base-label';
import {
  getMetricToneScale,
  type MetricLevelTone,
  type MetricTonePalette,
} from './metric-level-badge-scale';
import { IconTextBadge } from './icon-text-badge';

interface MetricLevelBadgeProps {
  icon: ReactNode;
  text: string;
  level: number;
  size: BaseLabelSize;
  'aria-label'?: string;
  palette?: MetricTonePalette;
  toneScale?: ReadonlyArray<MetricLevelTone>;
  frameClassName?: string;
  iconClassName?: string;
  textClassName?: string;
}

/**
 * Display-only badge for metrics that are shown as a formatted value plus
 * a discrete intensity level. Internally it uses `IconTextBadge` and maps
 * the level to a preset tone scale chosen by `palette` unless the caller
 * provides a custom `toneScale`, which takes precedence.
 */
export function MetricLevelBadge({
  icon,
  text,
  level,
  size,
  'aria-label': ariaLabel,
  palette = 'default',
  toneScale,
  frameClassName,
  iconClassName,
  textClassName,
}: MetricLevelBadgeProps) {
  const scale = toneScale ?? getMetricToneScale(palette);
  const clampedLevel = Math.max(0, Math.min(level, scale.length - 1));
  const tone = scale[clampedLevel];

  return (
    <IconTextBadge
      icon={icon}
      text={text}
      size={size}
      aria-label={ariaLabel}
      frameClassName={frameClassName}
      iconClassName={iconClassName}
      textClassName={textClassName}
      {...tone}
    />
  );
}
