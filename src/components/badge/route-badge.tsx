import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { resolveContextBorderColor } from '../../domain/transit/color-resolver/context-border-color';
import { resolveRouteColors } from '../../domain/transit/color-resolver/route-colors';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { useThemeContrastBackgroundColor } from '../../hooks/use-is-low-contrast-against-theme';
import type { InfoLevel } from '../../types/app/settings';
import type { Route } from '../../types/app/transit';
import { VerboseRoute } from '../verbose/verbose-route';
import { BaseBadge, type BaseBadgeSize } from './base-badge';

export type RouteBadgeSize = BaseBadgeSize;

interface RouteBadgeProps {
  route: Route;
  size: RouteBadgeSize;
  dataLang: readonly string[];
  agencyLangs?: readonly string[];
  infoLevel: InfoLevel;
  showBorder: boolean;
  enableVerboseExtras?: boolean;
  className?: string;
}

/**
 * Colored badge displaying a route's display name.
 *
 * Background color uses the route's designated color (`route_color`),
 * falling back to `bg-muted-foreground` when no color is set.
 * When `showBorder` is enabled, the outline uses the context cascade
 * (`route_color` first, then `route_text_color` when the fill has
 * low contrast against the theme) resolved by
 * {@link resolveContextBorderColor}.
 *
 * The badge always shows only the resolved primary route name.
 * Alternative subNames are not rendered in this compact badge, regardless of info level.
 * In verbose mode, an IdBadge with the route_id is shown alongside
 * the chip and a {@link VerboseRoute} panel is rendered below.
 *
 * @param route - The route to display.
 * @param infoLevel - Controls verbose-only extras; the badge text remains compact.
 * @param size - Size variant: `'md'`, `'sm'`, or `'xs'`.
 * @param className - Additional CSS classes for further overrides.
 */
export function RouteBadge({
  route,
  size,
  dataLang,
  agencyLangs = DEFAULT_AGENCY_LANG,
  infoLevel,
  showBorder = false,
  enableVerboseExtras = false,
  className,
}: RouteBadgeProps) {
  const routeNames = getRouteDisplayNames(route, dataLang, agencyLangs, 'short');

  const { routeColor, routeTextColor } = resolveRouteColors(route, 'css-hex');
  const themeBackground = useThemeContrastBackgroundColor();
  const borderColor = resolveContextBorderColor(
    routeColor ?? '',
    routeTextColor ?? '',
    themeBackground,
  );

  return (
    <BaseBadge
      label={routeNames.resolved.name || '?'}
      size={size}
      bgColor={routeColor}
      fgColor={routeTextColor}
      borderColor={borderColor}
      showBorder={showBorder}
      className={className}
      infoLevel={infoLevel}
      verboseExtras={{
        enabled: enableVerboseExtras,
        idLabel: route.route_id,
        slot: <VerboseRoute route={route} names={routeNames} infoLevel={infoLevel} />,
      }}
    />
  );
}
