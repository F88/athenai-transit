import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { formatRouteLabel } from '../../domain/transit/format-route-label';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { cn } from '../../lib/utils';
import { IdBadge } from './id-badge';

const sizeVariants = {
  default: 'text-xs px-2 py-0.5',
  sm: 'text-[10px] px-1',
  xs: 'text-[9px] px-0.5',
} as const;

interface RouteBadgeProps {
  /** The route to display. */
  route: Route;
  /** Current info verbosity level for label formatting. */
  infoLevel: InfoLevel;
  /** Size variant. @default 'default' */
  size?: keyof typeof sizeVariants;
  /** Additional CSS classes for further overrides. */
  className?: string;
}

/**
 * Colored badge displaying a route's display name.
 *
 * Background color uses the route's designated color (`route_color`),
 * falling back to `bg-muted-foreground` when no color is set.
 * The label is formatted via {@link formatRouteLabel} based on infoLevel.
 * In verbose mode, an {@link IdBadge} with the route_id is prepended.
 *
 * @param route - The route to display.
 * @param infoLevel - Controls label verbosity.
 * @param size - Size variant: `'default'`, `'sm'`, or `'xs'`.
 * @param className - Additional CSS classes for further overrides.
 */
export function RouteBadge({ route, infoLevel, size = 'default', className }: RouteBadgeProps) {
  const routeNames = getRouteDisplayNames(route, infoLevel);
  const bg = route.route_color ? `#${route.route_color}` : undefined;
  const fg = route.route_text_color ? `#${route.route_text_color}` : undefined;

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
      >
        {formatRouteLabel(routeNames, infoLevel)}
      </span>
    </span>
  );
}
