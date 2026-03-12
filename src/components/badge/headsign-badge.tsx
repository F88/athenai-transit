import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { cn } from '../../lib/utils';
import { IdBadge } from './id-badge';

const sizeVariants = {
  default: 'text-xs px-2 py-0.5',
  sm: 'text-[10px] px-1',
  xs: 'text-[9px] px-0.5',
} as const;

interface HeadsignBadgeProps {
  /** Headsign (destination) text to display. */
  headsign: string;
  /** The route, used to derive badge colors and verbose route_id. */
  route: Route;
  /** Current info verbosity level. Verbose shows route_id via IdBadge. */
  infoLevel: InfoLevel;
  /** Maximum characters to display. Truncated text is not suffixed. @default undefined (no limit) */
  maxLength?: number;
  /** Size variant. @default 'default' */
  size?: keyof typeof sizeVariants;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Colored badge displaying a headsign (destination) name.
 *
 * Background color uses the route's designated color (`route_color`),
 * falling back to `bg-muted-foreground` when no color is set.
 * In verbose mode, an {@link IdBadge} with the route_id is prepended.
 *
 * @param headsign - Destination text.
 * @param route - Route for color derivation and verbose route_id.
 * @param infoLevel - Controls whether route_id IdBadge is shown.
 * @param maxLength - Truncate headsign to first N characters. No limit when omitted.
 * @param size - Size variant: `'default'`, `'sm'`, or `'xs'`.
 * @param className - Additional CSS classes.
 */
export function HeadsignBadge({
  headsign,
  route,
  infoLevel,
  maxLength,
  size = 'default',
  className,
}: HeadsignBadgeProps) {
  const bg = route.route_color ? `#${route.route_color}` : undefined;
  const fg = route.route_text_color ? `#${route.route_text_color}` : undefined;
  const label =
    maxLength != null && headsign.length > maxLength ? headsign.slice(0, maxLength) : headsign;
  // Show full headsign as tooltip when truncated.
  const title = label !== headsign ? headsign : undefined;

  return (
    <span className="inline-flex items-center gap-0.5">
      {infoLevel === 'verbose' && <IdBadge>{route.route_id}</IdBadge>}
      <span
        className={cn(
          'bg-muted-foreground inline-flex items-center justify-center rounded font-bold whitespace-nowrap text-white',
          sizeVariants[size],
          className,
        )}
        style={bg ? { background: bg, color: fg } : undefined}
        title={title}
      >
        {label}
      </span>
    </span>
  );
}
