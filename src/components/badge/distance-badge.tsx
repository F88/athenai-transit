import { distanceColor } from '../../utils/distance-style';
import { formatDistance } from '../../domain/transit/distance';

interface DistanceBadgeProps {
  /** Distance in metres. Callers should pre-round to an integer. */
  meters: number;
}

/**
 * Displays a formatted distance with a color matching the map's concentric
 * distance rings.
 *
 * Callers are responsible for rounding and filtering out zero/negative values
 * before rendering this component.
 *
 * @param meters - Distance from map center in metres (pre-rounded integer).
 */
export function DistanceBadge({ meters }: DistanceBadgeProps) {
  return (
    <span
      className="ml-2 text-xl font-bold whitespace-nowrap"
      style={{ color: distanceColor(meters) }}
    >
      {formatDistance(meters)}
    </span>
  );
}
