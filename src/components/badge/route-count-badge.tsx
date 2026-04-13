import { resolveAgencyLang } from '../../config/transit-defaults';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
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
 */
export function RouteCountBadge({
  route,
  count,
  dataLang,
  agencies,
  size = 'sm',
}: RouteCountBadgeProps) {
  const label =
    getRouteDisplayNames(route, dataLang, resolveAgencyLang(agencies, route.agency_id), 'short')
      .resolved.name || route.route_id;
  const labelBg = route.route_color ? `#${route.route_color}` : undefined;
  const labelFg = route.route_text_color ? `#${route.route_text_color}` : undefined;
  return (
    <LabelCountBadge label={label} count={count} size={size} labelBg={labelBg} labelFg={labelFg} />
  );
}
