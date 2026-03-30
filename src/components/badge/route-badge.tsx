import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { formatRouteLabel } from '../../domain/transit/format-route-label';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { cn } from '../../lib/utils';
import { IdBadge } from './id-badge';
import { VerboseRoute } from '../verbose/verbose-route';
import { VerboseRouteDisplayNames } from '../verbose/verbose-route-display-names';

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
  /** Suppress verbose-only rendering (IdBadge, details dump).
   *  Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Additional CSS classes for further overrides. */
  className?: string;
}

/**
 * Colored badge displaying a route's display name.
 *
 * Background color uses the route's designated color (`route_color`),
 * falling back to `bg-muted-foreground` when no color is set.
 * The label is formatted via {@link formatRouteLabel} based on infoLevel.
 * In verbose mode, an {@link IdBadge} with the route_id is shown after the label.
 *
 * @param route - The route to display.
 * @param infoLevel - Controls label verbosity.
 * @param size - Size variant: `'default'`, `'sm'`, or `'xs'`.
 * @param className - Additional CSS classes for further overrides.
 */
export function RouteBadge({
  route,
  infoLevel,
  size = 'default',
  disableVerbose = false,
  className,
}: RouteBadgeProps) {
  const routeNames = getRouteDisplayNames(route, infoLevel);
  const bg = route.route_color ? `#${route.route_color}` : undefined;
  const fg = route.route_text_color ? `#${route.route_text_color}` : undefined;
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;

  return (
    <div className={cn('inline-flex flex-col gap-0.5 font-normal', className)}>
      <span className="inline-flex items-center gap-0.5">
        <span
          className={cn(
            'bg-muted-foreground inline-flex items-center justify-center rounded font-bold whitespace-nowrap text-white',
            sizeVariants[size],
          )}
          style={bg ? { background: bg, color: fg } : undefined}
        >
          {formatRouteLabel(routeNames, infoLevel)}
        </span>
        {showVerbose && <IdBadge>{route.route_id}</IdBadge>}
      </span>
      {showVerbose && (
        <details className="inline text-[9px] text-[#999] dark:text-gray-500">
          <summary className="cursor-pointer select-none">[Route]</summary>
          <div className="mt-0.5 space-y-0.5">
            <VerboseRoute route={route} infoLevel={infoLevel} />
            <VerboseRouteDisplayNames names={routeNames} />
          </div>
        </details>
      )}
    </div>
  );
}
