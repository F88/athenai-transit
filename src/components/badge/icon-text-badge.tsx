import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { BaseLabel, type BaseLabelSize } from '../label/base-label';

interface IconTextBadgeProps {
  /** Icon node rendered in the left half (e.g. a lucide-react icon). */
  icon: ReactNode;
  /**
   * Already-formatted text for the right half. The badge does **not**
   * format this value internally — callers pass the string they want
   * displayed (e.g. `"3.4 MB"`, `"1,234"`, `"★★★☆☆"`, `"ON"`).
   */
  text: string;
  /** Size variant, forwarded to the text half and applied to the icon cell. */
  size: BaseLabelSize;
  /** Background color for the icon half. */
  iconBg?: string;
  /** Foreground (icon) color for the icon half. Sets `color` so an icon using `currentColor` inherits it. */
  iconFg?: string;
  /** Background color for the text half. @default iconFg (inverted) */
  textBg?: string;
  /** Text color for the text half. @default iconBg (inverted) */
  textFg?: string;
  /** Outer frame border color. @default iconBg */
  frameColor?: string;
  /**
   * Accessible label for the whole badge. Recommended — the icon half
   * is `aria-hidden`, so without an explicit aria-label a screen reader
   * announces only the text value with no context for what it represents.
   */
  'aria-label'?: string;
  /** Optional utility classes for the outer frame wrapper. */
  frameClassName?: string;
  /** Optional utility classes for the icon half. */
  iconClassName?: string;
  /** Optional utility classes for the text half. */
  textClassName?: string;
}

/**
 * Per-size styling for the icon cell: matches {@link BaseLabel}'s
 * padding at each size, plus an `[&>svg]:h-* [&>svg]:w-*` rule that
 * sizes a direct SVG child (the typical lucide-react render output) to
 * roughly the same height as the text on the right half.
 */
const iconCellClasses: Record<BaseLabelSize, string> = {
  xs: 'px-0.5 py-0 [&>svg]:h-2 [&>svg]:w-2',
  sm: 'px-1 py-0.5 [&>svg]:h-2.5 [&>svg]:w-2.5',
  md: 'px-1.5 py-1 [&>svg]:h-3 [&>svg]:w-3',
  lg: 'px-2 py-1 [&>svg]:h-3.5 [&>svg]:w-3.5',
  xl: 'px-2 py-1 [&>svg]:h-4 [&>svg]:w-4',
};

/**
 * Display-only badge that pairs an icon with caller-formatted text,
 * rendered as a single framed capsule split into two halves.
 *
 * Visual structure:
 *
 * ```
 * ┌─────┬───────┐
 * │  ◷  │ 3.4MB │
 * └─────┴───────┘
 * ```
 *
 * Similar to `LabelCountBadge` except:
 *   - the left half renders a caller-provided icon (typically a
 *     lucide-react icon component) instead of a text label, and
 *   - the right half displays a pre-formatted string instead of a
 *     numeric count — the badge does **not** apply `toLocaleString` or
 *     any other internal formatting, so the caller is free to pass
 *     non-numeric content like `"3.4 MB"`, `"★★★☆☆"`, or `"ON"`.
 *
 * Because the icon half carries no inherent semantic to a screen
 * reader, the inner span is marked `aria-hidden` and callers are
 * expected to pass `aria-label` on the badge itself to describe what
 * the text represents.
 *
 * The outer frame uses `frameColor` (default: `iconBg`). The left half
 * uses `iconBg` / `iconFg`, the right half defaults to the inverted
 * colors (`iconFg` / `iconBg`) so the text stands out without
 * requiring a separate color decision at the call site.
 *
 * Intended for read-only badges (e.g. icon-led metric or status
 * pills). For interactive filters use `PillButton` instead — the
 * shape here deliberately avoids the pill affordance.
 */
export function IconTextBadge({
  icon,
  text,
  size,
  iconBg,
  iconFg,
  textBg = iconFg,
  textFg = iconBg,
  frameColor = iconBg,
  'aria-label': ariaLabel,
  frameClassName,
  iconClassName,
  textClassName,
}: IconTextBadgeProps) {
  const iconStyle = iconBg ? { background: iconBg, color: iconFg } : undefined;
  const textStyle = textBg ? { background: textBg, color: textFg } : undefined;
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
        value={text}
        className={cn('rounded-none', textClassName)}
        style={textStyle}
      />
    </span>
  );
}
