import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { LOW_CONTRAST_BADGE_MIN_RATIO } from '../../domain/transit/color-resolver/contrast-thresholds';
import { resolveRouteColors } from '../../domain/transit/color-resolver/route-colors';
import { useThemeContrastAssessment } from '../../hooks/use-is-low-contrast-against-theme';
import { cn } from '../../lib/utils';
import { BaseLabel, type BaseLabelSize } from '../label/base-label';
import { IdBadge } from './id-badge';
import { VerboseRoute } from '../verbose/verbose-route';

export type RouteBadgeSize = 'md' | 'sm' | 'xs';
export type RouteBadgeBorderStyle = 'neutral' | 'context';

const baseLabelSizes: Record<RouteBadgeSize, BaseLabelSize> = {
  md: 'md',
  sm: 'sm',
  xs: 'xs',
};

interface RouteBadgeProps {
  /** The route to display. */
  route: Route;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /**
   * Current info verbosity level.
   * The compact badge label itself stays on the resolved primary name;
   * only verbose-only extras such as debug details are gated by this prop.
   */
  infoLevel: InfoLevel;
  /** Size variant. */
  size: RouteBadgeSize;
  /** Whether to render a border around the badge. */
  showBorder: boolean;
  /** Border color style when showBorder is enabled. */
  borderStyle: RouteBadgeBorderStyle;
  /** Agency languages for subNames sort priority. @default DEFAULT_AGENCY_LANG */
  agencyLangs?: readonly string[];
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
 * @param size - Size variant: `'md'`, `'sm'`, or `'xs'`.
 * @param className - Additional CSS classes for further overrides.
 */
export function RouteBadge({
  route,
  dataLang,
  infoLevel,
  size,
  showBorder,
  borderStyle,
  agencyLangs = DEFAULT_AGENCY_LANG,
  disableVerbose = false,
  className,
}: RouteBadgeProps) {
  const routeNames = getRouteDisplayNames(route, dataLang, agencyLangs, 'short');
  const { routeColor, routeTextColor } = resolveRouteColors(route, 'css-hex');
  const routeColorAssessment = useThemeContrastAssessment(
    routeColor ?? '',
    LOW_CONTRAST_BADGE_MIN_RATIO,
  );
  const frameColor =
    !showBorder || borderStyle !== 'context'
      ? undefined
      : routeColorAssessment.isLowContrast
        ? routeTextColor
        : routeColor;
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;

  return (
    <div className={cn('inline-flex flex-col gap-0.5 font-normal', className)}>
      <span className="inline-flex items-center gap-0.5">
        <BaseLabel
          value={routeNames.resolved.name || '?'}
          size={baseLabelSizes[size]}
          className={cn(
            'bg-muted-foreground inline-flex items-center justify-center font-bold whitespace-nowrap text-white',
            showBorder && 'border',
            showBorder && borderStyle === 'neutral' && 'border-app-neutral',
          )}
          style={
            routeColor
              ? {
                  background: routeColor,
                  color: routeTextColor,
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
