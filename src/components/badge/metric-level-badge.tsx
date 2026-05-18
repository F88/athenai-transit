import type { ReactNode } from 'react';
import type { BaseLabelSize } from '../label/base-label';
import {
  getMetricBadgeToneScale,
  type MetricBadgeTone,
  type MetricBadgeTonePalette,
} from './metric-badge-tone-scale';
import { IconTextBadge } from './icon-text-badge';

interface MetricLevelBadgeProps {
  icon: ReactNode;
  text: string;
  level: number;
  size: BaseLabelSize;
  frameClassName?: string;
  iconClassName?: string;
  textClassName?: string;
  'aria-label'?: string;
  badgeTonePalette?: MetricBadgeTonePalette;
  badgeToneScale?: ReadonlyArray<MetricBadgeTone>;
}

/**
 * Display-only badge for metrics that are shown as a formatted value plus
 * a discrete intensity level. Internally it uses `IconTextBadge` and maps
 * the level to a preset tone scale chosen by `badgeTonePalette` unless the
 * caller provides a custom `badgeToneScale`, which takes precedence.
 */
export function MetricLevelBadge({
  icon,
  text,
  level,
  size,
  frameClassName,
  iconClassName,
  textClassName,
  'aria-label': ariaLabel,
  badgeTonePalette = 'default',
  badgeToneScale,
}: MetricLevelBadgeProps) {
  const scale = badgeToneScale ?? getMetricBadgeToneScale(badgeTonePalette);
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
