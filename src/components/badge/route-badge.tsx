import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { convertGtfsColor } from '../../domain/transit/gtfs-color';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { useIsLowContrastAgainstTheme } from '../../hooks/use-is-low-contrast-against-theme';
import { cn } from '../../lib/utils';
import { BaseLabel, type BaseLabelSize } from '../label/base-label';
import { IdBadge } from './id-badge';
import { VerboseRoute } from '../verbose/verbose-route';

export type RouteBadgeSize = 'default' | 'sm' | 'xs';

const baseLabelSizes: Record<RouteBadgeSize, BaseLabelSize> = {
  default: 'md',
  sm: 'sm',
  xs: 'xs',
};

interface RouteBadgeProps {
  /** The route to display. */
  route: Route;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Agency languages for subNames sort priority. @default DEFAULT_AGENCY_LANG */
  agencyLangs?: readonly string[];
  /**
   * Current info verbosity level.
   * The compact badge label itself stays on the resolved primary name;
   * only verbose-only extras such as debug details are gated by this prop.
   */
  infoLevel: InfoLevel;
  /** Size variant. @default 'default' */
  size?: RouteBadgeSize;
  /** Whether to render a border around the badge. @default false */
  showBorder?: boolean;
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
 * The badge always shows only the resolved primary route name.
 * Alternative subNames are not rendered in this compact badge, regardless of info level.
 * In verbose mode, an {@link IdBadge} with the route_id is shown after the label.
 *
 * @param route - The route to display.
 * @param infoLevel - Controls verbose-only extras; the badge text remains compact.
 * @param size - Size variant: `'default'`, `'sm'`, or `'xs'`.
 * @param className - Additional CSS classes for further overrides.
 */
export function RouteBadge({
  route,
  dataLang,
  agencyLangs = DEFAULT_AGENCY_LANG,
  infoLevel,
  size = 'default',
  showBorder = false,
  disableVerbose = false,
  className,
}: RouteBadgeProps) {
  const routeNames = getRouteDisplayNames(route, dataLang, agencyLangs, 'short');
  const bg = convertGtfsColor(route.route_color, 'css-hex');
  const fg = convertGtfsColor(route.route_text_color, 'css-hex');
  const routeColorIsLowContrast = useIsLowContrastAgainstTheme(bg);
  const frameColor = !showBorder || !routeColorIsLowContrast ? undefined : (fg ?? '#000000');
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;

  return (
    <div className={cn('inline-flex flex-col gap-0.5 font-normal', className)}>
      <span className="inline-flex items-center gap-0.5">
        <BaseLabel
          value={routeNames.resolved.name || '?'}
          size={baseLabelSizes[size]}
          className={cn(
            'bg-muted-foreground inline-flex items-center justify-center font-bold whitespace-nowrap text-white',
            showBorder && 'border-app-neutral border',
          )}
          style={
            bg
              ? {
                  background: bg,
                  color: fg,
                  borderColor: frameColor,
                }
              : undefined
          }
        />
        {showVerbose && <IdBadge>{route.route_id}</IdBadge>}
      </span>
      {showVerbose && <VerboseRoute route={route} names={routeNames} infoLevel={infoLevel} />}
    </div>
  );
}
