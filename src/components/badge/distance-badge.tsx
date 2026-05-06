import { useTranslation } from 'react-i18next';
import { distanceStyle } from '../../utils/distance-style';
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
 * The badge fades with distance using the band's `opacity`, mirroring the
 * map's concentric ring rendering and the edge marker badges so that "far
 * stops" recede visually in every surface that shows them.
 *
 * Callers are responsible for rounding and filtering out zero/negative values
 * before rendering this component.
 *
 * @param meters - Distance from map center in metres (pre-rounded integer).
 * @param bearingDeg - Geographic bearing in degrees. Optional.
 */
export function DistanceBadge({ meters, bearingDeg, showDirection = false }: DistanceBadgeProps) {
  const { i18n } = useTranslation();
  const style = distanceStyle(meters);
  return (
    <span
      className="ml-2 inline-flex items-center gap-0.5 align-middle text-xl font-bold whitespace-nowrap"
      style={{
        color: style.color,
        // opacity: style.opacity,
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
