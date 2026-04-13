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
 * Visually composed of two joined segments:
 *  - left: route name with `route_color` / `route_text_color`
 *  - right: count with inverted colors (background = text color of
 *    the left segment, text = background color of the left segment)
 *
 * Uses two {@link BaseLabel} instances inside a flex wrapper with the
 * inner corners flattened so the pair reads as a single pill split
 * into two halves.
 */
export function RouteLabel({ route, count, dataLang, agencies, size = 'sm' }: RouteLabelProps) {
  const { i18n } = useTranslation();
  const name =
    getRouteDisplayNames(route, dataLang, resolveAgencyLang(agencies, route.agency_id)).resolved
      .name || route.route_id;
  const bg = route.route_color ? `#${route.route_color}` : undefined;
  const fg = route.route_text_color ? `#${route.route_text_color}` : undefined;
  const nameStyle = bg ? { background: bg, color: fg } : undefined;
  const countStyle = bg ? { background: fg, color: bg } : undefined;
  const frameStyle = bg ? { borderColor: bg } : undefined;
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded border" style={frameStyle}>
      <BaseLabel size={size} value={name} className="rounded-none" style={nameStyle} />
      <BaseLabel
        size={size}
        value={count.toLocaleString(i18n.language)}
        className="rounded-none"
        style={countStyle}
      />
    </span>
  );
}
