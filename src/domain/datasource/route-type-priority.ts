import type { AppRouteTypeValue } from '../../types/app/transit';
import { ROUTE_TYPE_DISPLAY_ORDER } from '../transit/route-type-display-order';

/**
 * Display-order priority of GTFS route_type values used by the data-source
 * settings dialog section order.
 *
 * Derived from the app-wide {@link ROUTE_TYPE_DISPLAY_ORDER} SSOT, excluding the
 * `-1` (unknown) sentinel: the dialog routes groups with no recognised
 * route_type into the dedicated {@link ROUTE_TYPE_OTHER} bucket rather than a
 * `-1` section, so `-1` is intentionally not a priority entry.
 *
 * The dialog renders one section per entry (in this order), listing every
 * source group whose
 * {@link import('../../types/app/source-group').SourceGroup.routeTypes routeTypes}
 * field contains that value. Groups with multiple route_types appear in every
 * matching section.
 */
export const ROUTE_TYPE_PRIORITY: readonly AppRouteTypeValue[] = ROUTE_TYPE_DISPLAY_ORDER.filter(
  (routeType) => routeType !== -1,
);

/**
 * Sentinel section key used when a source group has no route_type that
 * appears in {@link ROUTE_TYPE_PRIORITY}. The dialog renders an "other"
 * bucket at the end so such groups remain visible.
 */
export const ROUTE_TYPE_OTHER = 'other' as const;

/**
 * Section key for the data-source settings dialog. Either one of the
 * priority-ranked GTFS values, or the {@link ROUTE_TYPE_OTHER} sentinel.
 */
export type RouteTypeSectionKey = AppRouteTypeValue | typeof ROUTE_TYPE_OTHER;
