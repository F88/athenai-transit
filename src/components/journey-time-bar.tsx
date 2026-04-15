import type { CSSProperties } from 'react';
import { computeJourneyTime } from '../domain/transit/journey-time';
import { BaseLabel, type BaseLabelSize } from './label/base-label';
import { Progress } from './ui/progress';

export type JourneyTimeBarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type JourneyTimeBarMinutesPosition = 'top' | 'bottom' | 'left' | 'right';
export type JourneyTimeBarFillDirection = 'ltr' | 'rtl';
export type JourneyTimeBarBorderStyle = 'solid' | 'dashed' | 'dotted';

export interface JourneyTimeBarBorder {
  /** Border width in pixels. Default `1`. */
  width?: number;
  /** Border color as a CSS color string. Default subtle gray. */
  color?: string;
  /** Border line style. Default `'solid'`. */
  style?: JourneyTimeBarBorderStyle;
}

const DEFAULT_BORDER_WIDTH = 1;
const DEFAULT_BORDER_COLOR = 'rgba(156, 163, 175, 0.5)';
const DEFAULT_BORDER_STYLE: JourneyTimeBarBorderStyle = 'solid';

interface JourneyTimeBarProps {
  /** Remaining minutes from the current stop to the terminal. */
  remainingMinutes: number | undefined;
  /** Total minutes of the full trip pattern. */
  totalMinutes: number | undefined;
  /**
   * Total minutes that map to a full-width bar. Trips longer than this
   * are clamped (bar stays at 100% width). Defaults to
   * {@link DEFAULT_MAX_BAR_MINUTES} (`120`). Non-positive / non-finite
   * values fall back to the default.
   */
  maxMinutes?: number;
  /** Size variant. Default `'sm'`. */
  size?: JourneyTimeBarSize;
  /**
   * Fill color for the traveled portion, as a CSS color string (e.g., a
   * GTFS `route_color` hex like `'#1976D2'`). When omitted, falls back to
   * the shadcn primary color.
   */
  color?: string;
  /**
   * Optional outline drawn around the bar. Omit for no border (default);
   * pass `{}` for the default subtle gray outline or provide any subset
   * of `width` / `color` / `style` to override individual fields.
   */
  border?: JourneyTimeBarBorder;
  /** Whether to render the remaining-minutes label. Default `false`. */
  showRMins?: boolean;
  /** Whether to render the total-minutes label. Default `false`. */
  showTMins?: boolean;
  /**
   * Optional prefix rendered before the remaining-minutes value
   * (e.g., `'残り'` → `'残り5'`). Ignored when `showRMins` is `false`.
   */
  rTimeLabel?: string;
  /**
   * Optional prefix rendered before the total-minutes value
   * (e.g., `'全体'` → `'全体25'`). Ignored when `showTMins` is `false`.
   */
  tMinsLabel?: string;
  /**
   * Where to place the minutes label relative to the bar.
   * `'top'` / `'bottom'` stack vertically; `'left'` / `'right'` flow
   * inline alongside the bar. Default `'bottom'`.
   */
  minsPosition?: JourneyTimeBarMinutesPosition;
  /**
   * Fill direction. `'ltr'` fills from the left edge growing right
   * (default — emphasizes "you can ride this far"). `'rtl'` fills from
   * the right edge growing left, so the colored section sits next to
   * the terminal end of the bar ("remaining until arrival").
   */
  fillDirection?: JourneyTimeBarFillDirection;

  showEmoji?: boolean;
}

/** Total minutes that map to a full-width bar; longer trips are clamped. */
const DEFAULT_MAX_BAR_MINUTES = 120;

const SIZE_HEIGHT_CLS: Record<JourneyTimeBarSize, string> = {
  xs: 'h-0.5',
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
  xl: 'h-3',
};

type JourneyTimeBarStyle = CSSProperties & {
  '--jtb-fill-color'?: string;
  '--jtb-track-color'?: string;
};

/**
 * A progress bar visualizing journey time.
 *
 * The bar's width scales with `totalMinutes` (capped at
 * `DEFAULT_MAX_BAR_MINUTES`, overridable via the `maxMinutes` prop),
 * so longer trips get visually longer bars. The filled portion
 * represents the remaining ratio (`remaining / total`), so the bar
 * empties as the trip progresses.
 *
 * The caller decides which numeric labels to show via `showRMins` /
 * `showTMins` and where to place them via `minsPosition`. When both
 * flags are on, the combined form `"r / t"` is rendered.
 *
 * ## `color` prop format requirement
 *
 * When `color` is provided, the indicator uses it verbatim and the
 * track is derived as `${color}33` — i.e. the same color with a
 * `33` (≈ 20%) alpha hex suffix. **`color` therefore must be a
 * 6-digit hex string starting with `#` (`#RRGGBB`)** so the
 * concatenation produces a valid 8-hex CSS color (`#RRGGBBAA`).
 * Production callers (`FlatDepartureItem`) always pass
 * `#${route.route_color}`, which is guaranteed by the GTFS
 * `routes.txt` spec to be 6 hex chars. Named CSS colors, `rgb(...)`,
 * and `hsl(...)` strings are NOT supported.
 */
export function JourneyTimeBar({
  remainingMinutes,
  totalMinutes,
  maxMinutes,
  size = 'sm',
  color,
  border,
  showRMins = false,
  showTMins = false,
  rTimeLabel,
  tMinsLabel,
  minsPosition: minutesPosition = 'bottom',
  fillDirection = 'ltr',
  showEmoji = false,
}: JourneyTimeBarProps) {
  // Delegate all time math (sanitize, clamp, progress ratio, label
  // rounding) to the domain layer. The Result type lets us bail out
  // early when there is no usable total to render against.
  const timeResult = computeJourneyTime({ remainingMinutes, totalMinutes });
  if (!timeResult.ok) {
    return null;
  }
  const { safeTotalMinutes, progressValue, displayTotalMinutes, displayRemainingMinutes } =
    timeResult.value;

  // Width scaling is a UI concern — it depends on the visual
  // convention of "this is the full-width threshold", not on the time
  // data itself. Kept local to the component so the domain helper
  // stays pure time math.
  const safeMaxMinutes =
    maxMinutes != null && Number.isFinite(maxMinutes) && maxMinutes > 0
      ? maxMinutes
      : DEFAULT_MAX_BAR_MINUTES;
  const widthPercent = Math.min((safeTotalMinutes / safeMaxMinutes) * 100, 100);

  // When a color prop is provided, override both the track (lighter) and
  // the indicator (solid) via CSS variables + arbitrary child selector, so
  // the route color flows through without modifying shadcn upstream code.
  const colorClass = color
    ? 'bg-[var(--jtb-track-color)] [&>[data-slot=progress-indicator]]:bg-[var(--jtb-fill-color)]'
    : '';
  // Right-aligned fill is implemented by mirroring the whole bar via
  // `scaleX(-1)`. Both track and indicator use `rounded-full`, so the
  // mirror is visually indistinguishable from a truly right-anchored
  // fill and avoids reimplementing shadcn Progress.
  const borderStyle: CSSProperties = border
    ? {
        borderWidth: `${border.width ?? DEFAULT_BORDER_WIDTH}px`,
        borderColor: border.color ?? DEFAULT_BORDER_COLOR,
        borderStyle: border.style ?? DEFAULT_BORDER_STYLE,
      }
    : {};
  const barStyle: JourneyTimeBarStyle = {
    width: `${widthPercent}%`,
    ...(fillDirection === 'rtl' ? { transform: 'scaleX(-1)' } : {}),
    ...(color
      ? {
          '--jtb-fill-color': color,
          '--jtb-track-color': `${color}33`,
        }
      : {}),
    ...borderStyle,
  };

  const showLabel = showRMins || showTMins;
  // `displayTotalMinutes` is always present in a successful result;
  // `displayRemainingMinutes` is `null` only when the upstream
  // remaining value is missing / invalid (shown as `-`).
  const r = displayRemainingMinutes ?? '-';
  const t = displayTotalMinutes;
  const rText = `${rTimeLabel ?? ''}${r}`;
  const tText = `${tMinsLabel ?? ''}${t}`;
  const labelText =
    showRMins && showTMins ? `${rText} / ${tText}` : showRMins ? rText : showTMins ? tText : '';

  // Label size is intentionally fixed to 'xs' across every bar size.
  // Visual review showed that even the largest bar (xl, h-3) reads
  // best with an xs pill — the label is subordinate to the bar and
  // shouldn't grow with it. The switch is retained as scaffolding so
  // a future variant can opt into a different mapping per `size`
  // without re-introducing the branching structure.
  let labelSize: BaseLabelSize = 'md';
  switch (size) {
    case 'xs':
      labelSize = 'xs';
      break;
    case 'sm':
      labelSize = 'xs';
      break;
    case 'md':
      labelSize = 'xs';
      break;
    case 'lg':
      labelSize = 'xs';
      break;
    case 'xl':
      labelSize = 'xs';
      break;
  }
  const label = showLabel ? (
    <BaseLabel
      size={labelSize}
      value={labelText}
      className={`whitespace-nowrap text-white ${color ? '' : 'bg-gray-500'}`}
      style={color ? { backgroundColor: color } : undefined}
    />
  ) : null;

  // Accessibility: Radix `Progress.Root` already sets `role="progressbar"`,
  // `aria-valuemin=0`, `aria-valuemax=100`, and `aria-valuenow={value}`.
  // We add a journey-time-specific `aria-label` so screen readers surface
  // the meaning of the bar (remaining vs total) rather than just a bare
  // percentage. Falls back to "?" when the remaining value is missing.
  const ariaLabel = `Journey time: ${displayRemainingMinutes ?? '?'} of ${displayTotalMinutes} minutes remaining`;
  const bar = (
    <Progress
      value={progressValue}
      aria-label={ariaLabel}
      className={`${SIZE_HEIGHT_CLS[size]} ${colorClass}`.trim()}
      style={barStyle}
    />
  );

  const isHorizontal = minutesPosition === 'left' || minutesPosition === 'right';
  const labelFirst = minutesPosition === 'left' || minutesPosition === 'top';
  const wrapperClassName = isHorizontal
    ? 'flex w-full items-center gap-1'
    : 'flex w-full flex-col items-start gap-0.5';

  return (
    <div className={wrapperClassName}>
      {labelFirst && label}
      {showEmoji && '⏳'}
      {bar}
      {!labelFirst && label}
    </div>
  );
}
