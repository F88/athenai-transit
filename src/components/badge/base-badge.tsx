import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import type { InfoLevel } from '../../types/app/settings';
import { BaseLabel, type BaseLabelSize } from '../label/base-label';
import { IdBadge } from './id-badge';

export type BaseBadgeSize = BaseLabelSize;

/**
 * Verbose-only extras grouped as a single prop so the related flag,
 * id chip, and detail panel travel together.
 */
export interface BaseBadgeVerboseExtras {
  /** Whether to render the IdBadge + detail panel when
   *  `infoLevel === 'verbose'`. Production callers default to off so
   *  the badge stays compact; dev/inspection contexts opt in.
   *  @default false */
  enabled?: boolean;
  /** Identifier rendered as an {@link IdBadge} alongside the chip.
   *  Leave unset to skip the IdBadge entirely (e.g. HeadsignBadge). */
  idLabel?: string;
  /** Detail panel rendered below the chip. Typically a domain-specific
   *  `VerboseXXX` component. */
  slot?: ReactNode;
}

export interface BaseBadgeProps {
  /** Size variant forwarded to the inner {@link BaseLabel}. */
  size: BaseBadgeSize;
  /** Text content for the chip. */
  label: string;
  /** Background color (typically a GTFS route/agency color). Falls back to `bg-muted-foreground` when unset. */
  bgColor?: string;
  /** Foreground (text) color paired with `bgColor`. Falls back to `text-white` when unset. */
  fgColor?: string;
  /** Inline outline color. When unset, any `border-*` Tailwind class in `className` decides the color instead. */
  borderColor?: string;
  /** Apply the `border` class. Use with `borderColor` for caller-controlled inline color, or
   *  pair with a `border-*` Tailwind class in `className` for a class-driven color. */
  showBorder?: boolean;
  /** Truncate label to this many characters. Forwarded to {@link BaseLabel}. */
  maxLength?: number;
  /** Append "…" when truncated. @default true */
  ellipsis?: boolean;
  /** Additional CSS classes applied to the chip. */
  className?: string;
  /** Current info verbosity level. Gates the verbose-only extras. */
  infoLevel: InfoLevel;
  /** Verbose-only extras (enable flag, IdBadge identifier, detail panel).
   *  All are inactive unless `infoLevel === 'verbose'` AND `enabled` is true. */
  verboseExtras?: BaseBadgeVerboseExtras;
}

/**
 * Domain-agnostic badge primitive composing a colored chip with
 * optional verbose extras.
 *
 * Layout:
 *
 * ```text
 * ┌────────────────────────────────────┐
 * │ [chip] [IdBadge (verbose only)]    │  ← inner row
 * │ [verbose slot (verbose only)]      │  ← detail below
 * └────────────────────────────────────┘
 * ```
 *
 * Shared by `RouteBadge`, `AgencyBadge`, and `HeadsignBadge` so the
 * outer flex container, chip styling, and verbose gating stay aligned
 * across domains. Callers resolve their own domain data (name, color
 * pair, verbose component) and hand already-resolved values to this
 * primitive.
 *
 * Border split:
 *
 * - `showBorder` toggles the `border` class (width).
 * - `borderColor`, when set, applies an inline `borderColor` that wins
 *   over Tailwind classes. Callers that want a class-driven outline
 *   (e.g. `border-app-neutral`) pass `borderColor={undefined}` and add
 *   the relevant class via `className`.
 */
export function BaseBadge({
  size,
  label,
  bgColor,
  fgColor,
  borderColor,
  showBorder,
  maxLength,
  ellipsis,
  className,
  infoLevel,
  verboseExtras,
}: BaseBadgeProps) {
  const { enabled = false, idLabel, slot } = verboseExtras ?? {};
  const showVerbose = infoLevel === 'verbose' && enabled;

  return (
    <div className="inline-flex flex-col gap-0.5 font-normal">
      <span className="inline-flex items-center gap-0.5">
        <BaseLabel
          value={label}
          size={size}
          maxLength={maxLength}
          ellipsis={ellipsis}
          className={cn(
            'bg-muted-foreground inline-flex items-center justify-center font-bold whitespace-nowrap text-white',
            showBorder && 'border',
            className,
          )}
          style={bgColor ? { background: bgColor, color: fgColor, borderColor } : undefined}
        />
        {showVerbose && idLabel && <IdBadge>{idLabel}</IdBadge>}
      </span>
      {showVerbose && slot}
    </div>
  );
}
