import { distanceColor } from '../../utils/distance-style';
import { formatDistance } from '../../domain/transit/distance';

interface DistanceBadgeProps {
  /** Distance in metres. Callers should pre-round to an integer. */
  meters: number;
  /** Geographic bearing in degrees (0 = north, 90 = east). */
  bearingDeg?: number | null;
  /** Whether to display the direction arrow. Defaults to false. */
  showDirection?: boolean;
}

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
export function DistanceBadge({ meters, bearingDeg, showDirection = false }: DistanceBadgeProps) {
  return (
    <span
      className="ml-2 inline-flex items-center gap-0.5 text-xl font-bold whitespace-nowrap"
      style={{ color: distanceColor(meters) }}
    >
      {showDirection && bearingDeg != null && (
        <span
          className="inline-block h-[0.8em] w-[0.8em] bg-current [clip-path:polygon(50%_10%,30%_70%,70%_70%)]"
          style={{ transform: `rotate(${bearingDeg}deg)` }}
          aria-label={`Direction: ${Math.round(bearingDeg)} degrees`}
        />
      )}
      {formatDistance(meters)}
    </span>
  );
}
