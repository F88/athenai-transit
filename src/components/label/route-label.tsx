import { useTranslation } from 'react-i18next';
import { resolveAgencyLang } from '../../config/transit-defaults';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import type { Agency, Route } from '../../types/app/transit';
import { BaseLabel, type BaseLabelSize } from './base-label';

interface RouteLabelProps {
  route: Route;
  count: number;
  dataLang: readonly string[];
  agencies: Agency[];
  size?: BaseLabelSize;
}

/**
 * Display-only label for a route with its entry count.
 *
 * Wraps {@link BaseLabel} and applies the route's own `route_color` /
 * `route_text_color` via inline style, so the coloring matches other
 * route-badge surfaces (RouteBadge, PillButton) without needing filter
 * affordances.
 */
export function RouteLabel({ route, count, dataLang, agencies, size = 'sm' }: RouteLabelProps) {
  const { i18n } = useTranslation();
  const name =
    getRouteDisplayNames(route, dataLang, resolveAgencyLang(agencies, route.agency_id)).resolved
      .name || route.route_id;
  const value = `${name}: ${count.toLocaleString(i18n.language)}`;
  const bg = route.route_color ? `#${route.route_color}` : undefined;
  const fg = route.route_text_color ? `#${route.route_text_color}` : undefined;
  return (
    <BaseLabel size={size} value={value} style={bg ? { background: bg, color: fg } : undefined} />
  );
}
