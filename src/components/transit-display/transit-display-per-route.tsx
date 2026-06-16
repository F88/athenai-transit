import { useMemo } from 'react';

import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';
import { resolveRouteColors } from '@/domain/transit/color-resolver/route-colors';
import type { TransitDisplayDataWithMetaData } from '@/domain/transit/transit-info-display/build-transit-display-data';
import type { Agency, Route } from '@/types/app/transit';

import { RouteBadge } from '../badge/route-badge';
import { TransitDisplay2, type TransitDisplay2Props } from './transit-displays-2';
import { AgencyBadge } from '../badge/agency-badge';
import { cn } from '@/lib/utils';
import { resolveAgencyColors } from '@/domain/transit/color-resolver/agency-colors';

/**
 * A group of boards that belong to the same route, paired with the route
 * itself. Produced by upstream grouping in `TransitDisplays2` and consumed by
 * {@link TransitDisplayPerRoute}. The caller is responsible for the
 * shared-route invariant (all `data[i].meta.routes[0]` equal `route`); this
 * shape does not re-check it.
 */
export interface TransitDisplayRouteGroup {
  /** The route every board in `data` belongs to. */
  route: Route;
  /** Boards for this route (typically the cluster's dep / arr boards across both directions). */
  data: readonly TransitDisplayDataWithMetaData[];
}

/**
 * Props for {@link TransitDisplayPerRoute}.
 *
 * Reuses {@link TransitDisplay2Props} for every prop except the data, which is
 * a {@link TransitDisplayRouteGroup} (route + its boards) rather than a
 * single board. `Omit` ensures any future change to {@link TransitDisplay2Props}
 * flows here automatically.
 */
export interface TransitDisplayPerRouteProps extends Omit<
  TransitDisplay2Props,
  'transitDisplayDataWithMetaData'
> {
  /** Route + its boards. */
  group: TransitDisplayRouteGroup;
}

/**
 * Renders a group of boards that belong to the same route as one cohesive
 * card-like section. Currently a thin wrapper that stacks {@link TransitDisplay2}
 * for each board; a dedicated Route header (using `group.route`) and an outer
 * card frame can be layered on later without touching the call sites.
 */
export function TransitDisplayPerRoute({
  group,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayPerRouteProps) {
  const routeAgency: Agency | undefined = useMemo(() => {
    for (const board of group.data) {
      for (const candidate of board.data.data) {
        const found = candidate.stop.agencies.find((a) => a.agency_id === group.route.agency_id);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }, [group.data, group.route.agency_id]);

  if (group.data.length < 1) {
    return null;
  }

  const { agencyColor } =
    routeAgency !== undefined
      ? resolveAgencyColors(routeAgency, 'css-hex')
      : { agencyColor: undefined };

  const route = group.route;
  const routeAgencyLangs = routeAgency ? [routeAgency.agency_lang] : DEFAULT_AGENCY_LANG;
  const { routeColor } = resolveRouteColors(route, 'css-hex');

  return (
    <section
      className={cn(
        //
        'overflow-hidden',
        // 'rounded border-2',
      )}
      style={
        //
        {
          // borderColor: routeColor ?? undefined,
          borderColor: agencyColor ?? undefined,
        }
      }
    >
      {/* Route info */}
      <div
        className={cn(
          //
          'my-0 overflow-hidden p-2',
          'rounded border-2',
        )}
        style={
          //
          {
            borderColor: routeColor ?? undefined,
            // borderColor: agencyColor ?? undefined,
          }
        }
      >
        <span
          className="truncate"
          // style={{ color: routeTextColor ?? undefined }}
        >
          {route.route_long_name}
        </span>
        <RouteBadge
          route={route}
          dataLang={dataLangs}
          agencyLangs={routeAgencyLangs}
          infoLevel={infoLevel}
          size="sm"
          showBorder={true}
        />
        {routeAgency && (
          <AgencyBadge
            agency={routeAgency}
            size="sm"
            infoLevel={infoLevel}
            dataLang={dataLangs}
            showBorder={true}
          />
        )}
      </div>

      {/* Panels  */}
      <div>
        {group.data.map((d, i) => (
          <div key={i} className="mt-4">
            <TransitDisplay2
              transitDisplayDataWithMetaData={d}
              dataLangs={dataLangs}
              now={now}
              mapCenter={mapCenter}
              infoLevel={infoLevel}
              size={size}
              onStopSelected={onStopSelected}
              onInspectTrip={onInspectTrip}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
