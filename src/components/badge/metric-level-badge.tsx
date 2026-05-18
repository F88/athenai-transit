import type { ReactNode } from 'react';
import type { BaseLabelSize } from '../label/base-label';
import { FIVE_LEVEL_METRIC_TONE_SCALE, type MetricLevelTone } from './metric-level-badge-scale';
import { IconTextBadge } from './icon-text-badge';

interface MetricLevelBadgeProps {
  icon: ReactNode;
  text: string;
  level: number;
  size: BaseLabelSize;
  'aria-label'?: string;
  toneScale?: ReadonlyArray<MetricLevelTone>;
  frameClassName?: string;
  iconClassName?: string;
  textClassName?: string;
}

/**
 * Display-only badge for metrics that are shown as a formatted value plus
 * a discrete intensity level. Internally it uses `IconTextBadge` and maps
 * the level to a fixed 5-step tone scale unless the caller provides a
 * custom `toneScale`.
 */
export function MetricLevelBadge({
  icon,
  text,
  level,
  size,
  'aria-label': ariaLabel,
  toneScale,
  frameClassName,
  iconClassName,
  textClassName,
}: MetricLevelBadgeProps) {
  const scale = toneScale ?? FIVE_LEVEL_METRIC_TONE_SCALE;
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
