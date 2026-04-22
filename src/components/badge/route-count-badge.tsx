import { resolveAgencyLang } from '../../config/transit-defaults';
import { resolveContextBorderColor } from '../../domain/transit/color-resolver/context-border-color';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import { resolveRouteColors } from '../../domain/transit/color-resolver/route-colors';
import { useThemeContrastBackgroundColor } from '../../hooks/use-is-low-contrast-against-theme';
import type { BaseLabelSize } from '../label/base-label';
import type { Agency, Route } from '../../types/app/transit';
import { LabelCountBadge } from './label-count-badge';

interface RouteCountBadgeProps {
  route: Route;
  count: number;
  dataLang: readonly string[];
  agencies: Agency[];
  size?: BaseLabelSize;
}

/**
 * Domain adapter that resolves a route's display name and colors and
 * delegates rendering to {@link LabelCountBadge}.
 *
 * Keeps GTFS-specific resolution (translations, agency language chain)
 * out of the presentation primitive so that `LabelCountBadge` can stay
 * reusable across other domain types (agency, stop, headsign, etc.).
 * The outline uses the context cascade
 * (`route_color` → `route_text_color`) resolved by
 * {@link resolveContextBorderColor}.
 */
export function RouteCountBadge({
  route,
  count,
  dataLang,
  agencies,
  size = 'sm',
}: RouteCountBadgeProps) {
  const routeNames = getRouteDisplayNames(
    route,
    dataLang,
    resolveAgencyLang(agencies, route.agency_id),
    'short',
  );
  const label = routeNames.resolved.name || route.route_id;

  const { routeColor, routeTextColor } = resolveRouteColors(route, 'css-hex');
  const themeBackground = useThemeContrastBackgroundColor();
  const frameColor = resolveContextBorderColor(
    routeColor ?? '',
    routeTextColor ?? '',
    themeBackground,
  );

  return (
    <LabelCountBadge
      label={label}
      count={count}
      size={size}
      labelBg={routeColor}
      labelFg={routeTextColor}
      frameColor={frameColor}
    />
  );
}
