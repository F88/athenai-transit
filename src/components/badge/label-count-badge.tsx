import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BaseLabel, type BaseLabelSize } from '../label/base-label';

interface LabelCountBadgeProps {
  /** Text for the left (label) half. */
  label: string;
  /** Numeric value for the right (count) half. Rendered with locale-aware formatting. */
  count: number;
  /** Size variant, forwarded to both inner BaseLabel instances. @default 'sm' */
  size?: BaseLabelSize;
  /** Background color for the label half (runtime hex, e.g. GTFS route_color). */
  labelBg?: string;
  /** Text color for the label half. */
  labelFg?: string;
  /** Background color for the count half. @default labelFg (inverted) */
  countBg?: string;
  /** Text color for the count half. @default labelBg (inverted) */
  countFg?: string;
  /** Outer frame border color. @default labelBg */
  frameColor?: string;
  /** Optional utility classes for the outer frame wrapper. */
  frameClassName?: string;
  /** Optional utility classes for the label half. */
  labelClassName?: string;
  /** Optional utility classes for the count half. */
  countClassName?: string;
}

/**
 * Display-only badge that pairs a text label with a numeric count,
 * rendered as a single framed capsule split into two halves.
 *
 * Visual structure:
 *
 * ```
 * ┌─────────────────────┬─────┐
 * │        label        │ count│
 * └─────────────────────┴─────┘
 * ```
 *
 * The outer frame uses `frameColor` (default: `labelBg`). The left
 * half uses `labelBg` / `labelFg`, the right half defaults to the
 * inverted colors (`labelFg` / `labelBg`) so the count stands out
 * without needing a separate color decision at the call site.
 *
 * Intended for read-only badges (e.g. route breakdown in timetable
 * metadata). For interactive filters use `PillButton` instead — the
 * shape here deliberately avoids the pill affordance.
 *
 * Uses two {@link BaseLabel} instances wrapped in a flex container;
 * their inner corners are flattened (`rounded-none`) and the outer
 * span's `rounded` + `overflow-hidden` creates the single-capsule
 * appearance.
 */
export function LabelCountBadge({
  label,
  count,
  size = 'sm',
  labelBg,
  labelFg,
  countBg = labelFg,
  countFg = labelBg,
  frameColor = labelBg,
  frameClassName,
  labelClassName,
  countClassName,
}: LabelCountBadgeProps) {
  const { i18n } = useTranslation();
  const labelStyle = labelBg ? { background: labelBg, color: labelFg } : undefined;
  const countStyle = countBg ? { background: countBg, color: countFg } : undefined;
  const frameStyle = frameColor ? { borderColor: frameColor } : undefined;
  return (
    <span
      className={cn('inline-flex items-stretch overflow-hidden rounded border', frameClassName)}
      style={frameStyle}
    >
      <BaseLabel
        size={size}
        value={label}
        className={cn('rounded-none', labelClassName)}
        style={labelStyle}
      />
      <BaseLabel
        size={size}
        value={count.toLocaleString(i18n.language)}
        className={cn('rounded-none', countClassName)}
        style={countStyle}
      />
    </span>
  );
}
