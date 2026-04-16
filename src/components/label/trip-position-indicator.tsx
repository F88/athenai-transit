import type { CSSProperties, ReactElement } from 'react';
import type { InfoLevel } from '../../types/app/settings';
import { createInfoLevel } from '../../utils/create-info-level';

export type TripPositionIndicatorSize = 'xs' | 'sm' | 'md';

export interface TripPositionIndicatorProps {
  /** 0-based index of the current stop in the trip pattern. */
  stopIndex: number;
  /** Total number of stops in the trip pattern. */
  totalStops: number;
  /** Size variant. Default `'sm'`. */
  size?: TripPositionIndicatorSize;
  /**
   * Current info verbosity level. When provided and equal to `'simple'`,
   * the indicator is hidden (returns `null`). When omitted, the indicator
   * is always rendered.
   */
  infoLevel?: InfoLevel;
  /**
   * Whether to draw the horizontal track line behind the dots. Default `true`.
   * Set to `false` when the surrounding context already provides a separator
   * or when a cleaner dots-only look is desired.
   */
  showTrack?: boolean;
  /**
   * Background color for the current (highlighted) dot, as a CSS color
   * string (e.g., GTFS `route_color` hex like `'#1976D2'`). When omitted,
   * falls back to the default blue Tailwind class.
   */
  currentColor?: string;
  /**
   * Background color for the non-current dots, as a CSS color string.
   * When omitted, falls back to the default gray Tailwind class.
   */
  dotColor?: string;
  /**
   * Background color for the horizontal track line, as a CSS color string.
   * When omitted, falls back to the default gray Tailwind class.
   * Applied via a CSS variable because the track is a `::before` pseudo-element.
   */
  trackColor?: string;
}

const SIZE_CLASSES: Record<
  TripPositionIndicatorSize,
  { dot: string; current: string; height: string; track: string; pad: string }
> = {
  xs: { dot: 'h-1 w-1', current: 'h-1.5 w-1.5', height: 'h-2', track: 'before:h-px', pad: '' },
  sm: { dot: 'h-1.5 w-1.5', current: 'h-3 w-3', height: 'h-3', track: 'before:h-1', pad: '' },
  md: { dot: 'h-1 w-1', current: 'h-2 w-2', height: 'h-4', track: 'before:h-3', pad: 'px-2' },
};

/**
 * Hard cap on rendered dots. Real trip patterns top out around
 * 80 stops in the current dataset (都営梅70, 京都市バス11), so 300
 * leaves a comfortable safety margin for future long-haul routes
 * while still protecting the browser from a data bug (NaN /
 * Infinity / corrupted value) that would otherwise render thousands
 * of DOM nodes.
 */
const MAX_STOPS = 300;

/**
 * Slider-style "you are here" indicator showing where a stop sits within
 * the full sequence of stops in a trip pattern.
 *
 * Renders a thin horizontal track that fills the parent's width, with one
 * dot per stop evenly distributed along the track. The current stop is
 * highlighted as a larger colored dot. Useful for quickly spotting
 * structural anomalies like 6-shape and circular routes where the same
 * `stop_id` appears at multiple positions (Issue #47), and for giving any
 * stop time entry a sense of "where am I in this trip?".
 *
 * Visual example for a 5-stop pattern with current stopIndex=2:
 *
 * ```text
 *   ●───●───◉───●───●
 * ```
 *
 * The container takes the full width of its parent (`w-full`), so place
 * it inside a width-constrained block.
 */
export function TripPositionIndicator({
  stopIndex,
  totalStops,
  size = 'sm',
  infoLevel,
  showTrack = true,
  currentColor,
  dotColor,
  trackColor,
}: TripPositionIndicatorProps): ReactElement | null {
  // Reject non-finite (NaN / Infinity / -Infinity) and degenerate
  // counts up front. `totalStops <= 1` covers 0/negative (invalid)
  // and 1 (single-stop pattern, no position context to convey so
  // the indicator has nothing to show). Infinity would otherwise
  // spin the dot loop forever.
  if (!Number.isFinite(totalStops) || totalStops <= 1) {
    return null;
  }
  // Hide at the simplest verbosity level (= keep UI uncluttered).
  if (infoLevel !== undefined && !createInfoLevel(infoLevel).isNormalEnabled) {
    return null;
  }
  // Clamp absurdly large counts to MAX_STOPS. Real GTFS patterns
  // top out around 80 stops, so a value beyond 300 signals a data
  // bug that must not be allowed to freeze the browser.
  const safeTotalStops = Math.min(Math.floor(totalStops), MAX_STOPS);
  const sizeCls = SIZE_CLASSES[size];
  // When a color prop is provided, omit the default Tailwind bg class so the
  // inline style override wins without specificity conflicts.
  const currentBgCls = currentColor ? '' : 'bg-blue-500 dark:bg-blue-400';
  const dotBgCls = dotColor ? '' : 'bg-gray-400 dark:bg-gray-500';
  const currentStyle = currentColor ? { backgroundColor: currentColor } : undefined;
  const dotStyle = dotColor ? { backgroundColor: dotColor } : undefined;
  const dots: ReactElement[] = [];
  for (let i = 0; i < safeTotalStops; i++) {
    const isCurrent = i === stopIndex;
    dots.push(
      <span
        key={i}
        className={`relative z-10 rounded-full ${
          isCurrent ? `${sizeCls.current} ${currentBgCls}` : `${sizeCls.dot} ${dotBgCls}`
        }`}
        style={isCurrent ? currentStyle : dotStyle}
      />,
    );
  }
  // Track color: when trackColor is provided, use a CSS variable so the
  // ::before pseudo-element can resolve it at runtime. When omitted, fall
  // back to the default gray Tailwind classes (with dark mode variant).
  const trackBgCls = trackColor
    ? 'before:bg-[var(--tpi-track-color)]'
    : 'before:bg-gray-300 dark:before:bg-gray-600';
  const trackCls = showTrack
    ? `before:pointer-events-none before:absolute before:inset-x-0 before:top-1/2 ${sizeCls.track} before:-translate-y-1/2 before:rounded-full ${trackBgCls}`
    : '';
  const containerStyle: CSSProperties | undefined = trackColor
    ? ({ '--tpi-track-color': trackColor } as CSSProperties)
    : undefined;
  const positionLabel = `Stop ${stopIndex + 1} of ${safeTotalStops}`;
  return (
    <span
      className="inline-flex w-full items-center gap-1"
      aria-label={positionLabel}
      title={positionLabel}
    >
      {infoLevel === 'verbose' && (
        <span aria-hidden="true" className="shrink-0">
          🚏
        </span>
      )}
      <span
        className={`relative inline-flex min-w-0 flex-1 items-center justify-between ${sizeCls.height} ${sizeCls.pad} ${trackCls}`}
        style={containerStyle}
      >
        {dots}
      </span>
    </span>
  );
}
