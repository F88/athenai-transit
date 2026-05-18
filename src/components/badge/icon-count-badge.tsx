import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BaseLabel, type BaseLabelSize } from '../label/base-label';

interface IconCountBadgeProps {
  /** Icon node rendered in the left half (e.g. a lucide-react icon). */
  icon: ReactNode;
  /** Numeric value for the right (count) half. Rendered with locale-aware formatting. */
  count: number;
  /** Size variant, forwarded to the count half and applied to the icon cell. @default 'sm' */
  size?: BaseLabelSize;
  /** Background color for the icon half. */
  iconBg?: string;
  /** Foreground (icon) color for the icon half. Sets `color` so an icon using `currentColor` inherits it. */
  iconFg?: string;
  /** Background color for the count half. @default iconFg (inverted) */
  countBg?: string;
  /** Text color for the count half. @default iconBg (inverted) */
  countFg?: string;
  /** Outer frame border color. @default iconBg */
  frameColor?: string;
  /**
   * Accessible label for the whole badge. Recommended — the icon half
   * is `aria-hidden`, so without an explicit aria-label a screen reader
   * announces only the count value with no context.
   */
  'aria-label'?: string;
  /** Optional utility classes for the outer frame wrapper. */
  frameClassName?: string;
  /** Optional utility classes for the icon half. */
  iconClassName?: string;
  /** Optional utility classes for the count half. */
  countClassName?: string;
}

/**
 * Per-size styling for the icon cell: matches {@link BaseLabel}'s
 * padding at each size, plus an `[&>svg]:h-* [&>svg]:w-*` rule that
 * sizes a direct SVG child (the typical lucide-react render output) to
 * roughly the same height as the text on the count half.
 */
const iconCellClasses: Record<BaseLabelSize, string> = {
  xs: 'px-0.5 py-0 [&>svg]:h-2 [&>svg]:w-2',
  sm: 'px-1 py-0.5 [&>svg]:h-2.5 [&>svg]:w-2.5',
  md: 'px-1.5 py-1 [&>svg]:h-3 [&>svg]:w-3',
  lg: 'px-2 py-1 [&>svg]:h-3.5 [&>svg]:w-3.5',
  xl: 'px-2 py-1 [&>svg]:h-4 [&>svg]:w-4',
};

/**
 * Display-only badge that pairs an icon with a numeric count, rendered
 * as a single framed capsule split into two halves.
 *
 * Visual structure:
 *
 * ```
 * ┌─────┬─────┐
 * │  ◷  │ 123 │
 * └─────┴─────┘
 * ```
 *
 * Mirror of `LabelCountBadge` except the left half renders a
 * caller-provided icon node (typically a lucide-react icon component)
 * instead of a text label. Because the icon half carries no inherent
 * semantic to a screen reader, the inner span is marked `aria-hidden`
 * and the caller is expected to pass `aria-label` on the badge itself
 * to describe what the count represents.
 *
 * The outer frame uses `frameColor` (default: `iconBg`). The left half
 * uses `iconBg` / `iconFg`, the right half defaults to the inverted
 * colors (`iconFg` / `iconBg`) so the count stands out without
 * requiring a separate color decision at the call site.
 *
 * Intended for read-only badges (e.g. icon-led metric pills). For
 * interactive filters use `PillButton` instead — the shape here
 * deliberately avoids the pill affordance.
 */
export function IconCountBadge({
  icon,
  count,
  size = 'sm',
  iconBg,
  iconFg,
  countBg = iconFg,
  countFg = iconBg,
  frameColor = iconBg,
  'aria-label': ariaLabel,
  frameClassName,
  iconClassName,
  countClassName,
}: IconCountBadgeProps) {
  const { i18n } = useTranslation();
  const iconStyle = iconBg ? { background: iconBg, color: iconFg } : undefined;
  const countStyle = countBg ? { background: countBg, color: countFg } : undefined;
  const frameStyle = frameColor ? { borderColor: frameColor } : undefined;
  const frameStyleProps = frameStyle ? { style: frameStyle } : undefined;
  const iconStyleProps = iconStyle ? { style: iconStyle } : undefined;
  return (
    <span
      className={cn('inline-flex items-stretch overflow-hidden rounded border', frameClassName)}
      aria-label={ariaLabel}
      {...frameStyleProps}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center font-medium',
          iconCellClasses[size],
          iconClassName,
        )}
        {...iconStyleProps}
      >
        {icon}
      </span>
      <BaseLabel
        size={size}
        value={count.toLocaleString(i18n.language)}
        className={cn('rounded-none', countClassName)}
        style={countStyle}
      />
    </span>
  );
}
