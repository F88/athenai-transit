import { useTranslation } from 'react-i18next';
import { distanceStyle } from '../../utils/distance-style';
import { formatDistance } from '../../domain/transit/distance';
import type { ExtendedDisplaySize } from '../shared/display-size';

interface DistanceBadgeProps {
  /** Distance in metres. Callers should pre-round to an integer. */
  meters: number;
  /** Geographic bearing in degrees (0 = north, 90 = east). */
  bearingDeg?: number | null;
  /** Whether to display the direction arrow. Defaults to false. */
  showDirection?: boolean;
  /**
   * Chip size — drives the Tailwind font-size class. The direction arrow
   * scales with the font (it uses `em`-relative dimensions), so size also
   * controls the arrow's rendered pixel width.
   */
  size: ExtendedDisplaySize;
}

/**
 * Tailwind text-size class per {@link ExtendedDisplaySize}.
 *
 * The badge has historically rendered at `text-xl` (20px); `'xl'` preserves
 * that default visual. Smaller sizes are useful when the badge sits inline
 * with denser chip rows (search result items, edge marker tooltips).
 */
const SIZE_TO_TEXT_CLASS: Record<ExtendedDisplaySize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

/**
 * Displays a formatted distance with a color matching the map's concentric
 * distance rings, and an optional direction arrow.
 *
 * Callers are responsible for rounding and filtering out zero/negative values
 * before rendering this component.
 *
 * @param meters - Distance from map center in metres (pre-rounded integer).
 * @param bearingDeg - Geographic bearing in degrees. Optional.
 */
export function DistanceBadge({
  meters,
  bearingDeg,
  showDirection = false,
  size,
}: DistanceBadgeProps) {
  const { i18n } = useTranslation();
  const style = distanceStyle(meters);
  return (
    <span
      className={`inline-flex items-center gap-0.5 align-middle ${SIZE_TO_TEXT_CLASS[size]} font-bold whitespace-nowrap`}
      style={{
        color: style.color,
      }}
    >
      {showDirection && bearingDeg != null && (
        <span
          className="inline-block h-[0.8em] w-[0.8em] bg-current [clip-path:polygon(50%_10%,30%_70%,70%_70%)]"
          style={{ transform: `rotate(${bearingDeg}deg)` }}
          aria-hidden="true"
        />
      )}
      {formatDistance(meters, i18n.language)}
    </span>
  );
}
