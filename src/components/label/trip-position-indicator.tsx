import type { CSSProperties, ReactElement } from 'react';
import { BaseLabel } from './base-label';

export type TripPositionIndicatorSize = 'xs' | 'sm' | 'md';

export interface TripPositionIndicatorProps {
  /** 0-based index of the current stop in the trip pattern. */
  stopIndex: number;
  /** Total number of stops in the trip pattern. */
  totalStops: number;
  /** Size variant. Default `'sm'`. */
  size?: TripPositionIndicatorSize;
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
  /**
   * Ring (outline) color for the horizontal track, as a CSS color string.
   * Typically the GTFS `route_color` (at full opacity) so the track
   * gains a visible outline that still carries the route's identity,
   * even when `trackColor` (a translucent variant of the same hue) is
   * near the theme background.
   * When omitted, falls back to a theme-appropriate neutral
   * (black at 10% on light, white at 15% on dark).
   * Only applied when {@link showTrackBorder} is `true`.
   */
  trackBorderColor?: string;
  /**
   * Whether to draw a 1px outline ring around the horizontal track.
   * Useful when `trackColor` may be near the theme background
   * (e.g. white `route_color` on light theme) and the track needs
   * a visible boundary. Default `false`.
   */
  showTrackBorder?: boolean;
  /**
   * Whether to render a compact `current / total` label next to the
   * indicator. Default `false`.
   */
  showPositionLabel?: boolean;
  /** Whether to render the stop-position emoji prefix. Default `false`. */
  showEmoji?: boolean;
  /**
   * Text color for the optional position label, as a CSS color string.
   * When omitted, the label falls back to white text.
   */
  labelTextColor?: string;
  /**
   * Background color for the optional position label, as a CSS color string.
   * When omitted, the label falls back to the neutral gray badge style.
   */
  labelBgColor?: string;
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
  showTrack = true,
  currentColor,
  dotColor,
  trackColor,
  trackBorderColor,
  showTrackBorder = false,
  showPositionLabel = false,
  showEmoji = false,
  labelTextColor,
  labelBgColor,
}: TripPositionIndicatorProps): ReactElement | null {
  // Reject non-finite (NaN / Infinity / -Infinity) and degenerate
  // counts up front. `totalStops <= 1` covers 0/negative (invalid)
  // and 1 (single-stop pattern, no position context to convey so
  // the indicator has nothing to show). Infinity would otherwise
  // spin the dot loop forever.
  if (!Number.isFinite(totalStops) || totalStops <= 1) {
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
  // Outer ring on the track pseudo-element (opt-in via
  // `showTrackBorder`) gives the bar a visible outline when
  // `trackColor` is a near-background hue (e.g. route_color #FFFFFF
  // on light theme, #000000 on dark theme). The ring color resolves
  // from `--tpi-track-border-color` — set to `trackBorderColor` (typically GTFS
  // route_color at full opacity) when available, or the theme-default
  // black/10 or white/15 provided on the container below.
  const trackBorderCls = showTrackBorder
    ? 'before:ring-1 before:ring-[var(--tpi-track-border-color)]'
    : '';
  const trackCls = showTrack
    ? `before:pointer-events-none before:absolute before:inset-x-0 before:top-1/2 ${sizeCls.track} before:-translate-y-1/2 before:rounded-full ${trackBorderCls} ${trackBgCls}`
    : '';
  const cssVars: Record<string, string> = {};
  if (trackColor) {
    cssVars['--tpi-track-color'] = trackColor;
  }
  if (trackBorderColor) {
    cssVars['--tpi-track-border-color'] = trackBorderColor;
  }
  const containerStyle: CSSProperties | undefined =
    Object.keys(cssVars).length > 0 ? (cssVars as CSSProperties) : undefined;
  const positionLabelStyle: CSSProperties | undefined =
    labelTextColor || labelBgColor
      ? {
          ...(labelTextColor ? { color: labelTextColor } : {}),
          ...(labelBgColor ? { backgroundColor: labelBgColor } : {}),
        }
      : undefined;
  const positionLabel = `Stop ${stopIndex + 1} of ${safeTotalStops}`;
  return (
    <span
      className="inline-flex w-full items-center gap-1 [--tpi-track-border-color:rgb(0_0_0/0.1)] dark:[--tpi-track-border-color:rgb(255_255_255/0.15)]"
      aria-label={positionLabel}
      title={positionLabel}
    >
      {showEmoji && (
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
      {showPositionLabel && (
        <BaseLabel
          size={'xs'}
          value={`${stopIndex + 1} / ${safeTotalStops}`}
          className="shrink-0 bg-gray-500 whitespace-nowrap text-white"
          style={positionLabelStyle}
        />
      )}
    </span>
  );
}
