import { useMemo } from 'react';

import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';
import { resolveRouteColors } from '@/domain/transit/color-resolver/route-colors';
import type { TransitDisplayDataWithMetaData } from '@/domain/transit/transit-info-display/build-transit-display-data';
import { useInfoLevel } from '@/hooks/use-info-level';
import { cn } from '@/lib/utils';
import type { Agency, Route } from '@/types/app/transit';
import { routeTypesEmoji } from '@/utils/route-type-emoji';

import { AgencyBadge } from '@/components/badge/agency-badge';
import { RouteBadge } from '@/components/badge/route-badge';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { InlineDisplayNames } from '@/components/shared/inline-display-names';
import {
  TransitDisplay,
  type TransitDisplayProps,
} from '@/components/transit-display/transit-display';
import { VerboseRoutes } from '@/components/verbose/verbose-routes';
import { hasDisplayContent } from '@/domain/transit/name-resolver/get-display-names';
import { getRouteDisplayNames } from '@/domain/transit/name-resolver/get-route-display-names';

/**
 * A group of boards that belong to the same route, paired with the route
 * itself. Produced by upstream grouping in `TransitDisplayDashboard` and consumed by
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
 * Per-`size` style bundle for {@link TransitDisplayPerRoute}: child component
 * sizes and layout utility classes, grouped by concern. Looked up via
 * {@link PER_ROUTE_STYLE_BY_SIZE}.
 */
interface PerRouteSizeStyle {
  /** Layout for the stacked board panels below the route info row. */
  panels: {
    /** Margin utility class between board panels (`mt-*`). */
    gap: string;
  };
  /** Layout utility classes for the route info row (the header). */
  routeInfoRow: {
    /** Padding utility class applied to the row. */
    padding: string;
    /** Gap utility class for the row's flex children. */
    gap: string;
    /** Border thickness utility class (`border` / `border-2` / ...). Color is set via inline style. */
    borderWidth: string;
    /** Border radius utility class (`rounded` / `rounded-md` / ...). */
    borderRadius: string;
  };
  /** Styling for the route-type emoji prefix in the route info row. */
  routeTypeEmoji: {
    /** Text-size utility class applied to the emoji span (`text-*`). */
    textSize: string;
  };
  /** Sizes for the route name display (`InlineDisplayNames`). */
  displayNames: {
    /** Size for the resolved (primary) route name. */
    resolvedNameSize: ExtendedDisplaySize;
    /** Size for the "other" route name (long / short alternative). */
    otherNamesSize: ExtendedDisplaySize;
  };
  /** Sizes for the badges in the route info row. */
  badges: {
    /** `RouteBadge` size. */
    routeSize: ExtendedDisplaySize;
    /** `AgencyBadge` size. */
    agencySize: ExtendedDisplaySize;
  };
}

/**
 * Size-driven style table for {@link TransitDisplayPerRoute}. The `size` prop
 * picks one entry; usage will be wired up to the JSX in a follow-up step.
 * The `md` entry mirrors the previously hardcoded values exactly.
 */
const PER_ROUTE_STYLE_BY_SIZE: Record<ExtendedDisplaySize, PerRouteSizeStyle> = {
  xs: {
    panels: { gap: 'mt-2' },
    routeInfoRow: {
      padding: 'p-1',
      gap: 'gap-1',
      borderWidth: 'border',
      borderRadius: 'rounded-sm',
    },
    routeTypeEmoji: { textSize: 'text-xs' },
    displayNames: { resolvedNameSize: 'xs', otherNamesSize: 'xs' },
    badges: { routeSize: 'xs', agencySize: 'xs' },
  },
  sm: {
    panels: { gap: 'mt-3' },
    routeInfoRow: {
      padding: 'p-1.5',
      gap: 'gap-1.5',
      borderWidth: 'border-2',
      borderRadius: 'rounded',
    },
    routeTypeEmoji: { textSize: 'text-sm' },
    displayNames: { resolvedNameSize: 'sm', otherNamesSize: 'xs' },
    badges: { routeSize: 'xs', agencySize: 'xs' },
  },
  md: {
    panels: { gap: 'mt-4' },
    routeInfoRow: {
      padding: 'p-2',
      gap: 'gap-2',
      borderWidth: 'border-3',
      borderRadius: 'rounded-lg',
    },
    routeTypeEmoji: { textSize: 'text-xl' },
    displayNames: { resolvedNameSize: 'md', otherNamesSize: 'xs' },
    badges: { routeSize: 'sm', agencySize: 'sm' },
  },
  lg: {
    panels: { gap: 'mt-6' },
    routeInfoRow: {
      padding: 'p-3',
      gap: 'gap-3',
      borderWidth: 'border-4',
      borderRadius: 'rounded-lg',
    },
    routeTypeEmoji: { textSize: 'text-2xl' },
    displayNames: { resolvedNameSize: 'lg', otherNamesSize: 'sm' },
    badges: { routeSize: 'lg', agencySize: 'lg' },
  },
  xl: {
    panels: { gap: 'mt-8' },
    routeInfoRow: {
      padding: 'p-3',
      gap: 'gap-3',
      borderWidth: 'border-8',
      borderRadius: 'rounded-xl',
    },
    routeTypeEmoji: { textSize: 'text-4xl' },
    displayNames: { resolvedNameSize: 'xl', otherNamesSize: 'md' },
    badges: { routeSize: 'xl', agencySize: 'xl' },
  },
};

/**
 * Props for {@link TransitDisplayPerRoute}.
 *
 * Reuses {@link TransitDisplayProps} for every prop except the data, which is
 * a {@link TransitDisplayRouteGroup} (route + its boards) rather than a
 * single board. `Omit` ensures any future change to {@link TransitDisplayProps}
 * flows here automatically.
 */
export interface TransitDisplayPerRouteProps extends Omit<
  TransitDisplayProps,
  'transitDisplayDataWithMetaData'
> {
  /** Route + its boards. */
  group: TransitDisplayRouteGroup;
}

/**
 * Renders a group of boards that belong to the same route as one cohesive
 * card-like section. Currently a thin wrapper that stacks {@link TransitDisplay}
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
  const infoLevelFlag = useInfoLevel(infoLevel);
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

  const style = PER_ROUTE_STYLE_BY_SIZE[size];

  const route = group.route;
  const { routeColor } = resolveRouteColors(route, 'css-hex');

  // Route name
  const routeAgencyLangs = routeAgency ? [routeAgency.agency_lang] : DEFAULT_AGENCY_LANG;
  const routeNames = getRouteDisplayNames(route, dataLangs, routeAgencyLangs, 'short');
  const resolvedRouteNames = routeNames.resolved;
  const otherRouteNames =
    routeNames.resolvedSource === 'short' ? routeNames.longName : routeNames.shortName;
  const hasOtherNames = hasDisplayContent(otherRouteNames);

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
        }
      }
    >
      {infoLevelFlag.isVerboseEnabled && (
        <VerboseRoutes
          routes={[route]}
          infoLevel={infoLevel}
          dataLang={dataLangs}
          agencies={routeAgency ? [routeAgency] : []}
        />
      )}

      {/* Route info */}
      <div
        className={cn(
          //
          'flex items-center',
          'my-0 overflow-hidden',
          style.routeInfoRow.gap,
          style.routeInfoRow.padding,
          style.routeInfoRow.borderRadius,
          style.routeInfoRow.borderWidth,
        )}
        style={{ borderColor: routeColor ?? undefined }}
      >
        {' '}
        {/* Left: route info */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={style.routeTypeEmoji.textSize}>
            {routeTypesEmoji([route.route_type])}
          </span>
          <RouteBadge
            route={route}
            dataLang={dataLangs}
            agencyLangs={routeAgencyLangs}
            infoLevel={infoLevel}
            size={style.badges.routeSize}
            showBorder={true}
          />
          {/* Route names */}
          <div className="flex min-w-0 flex-col">
            <div>
              <InlineDisplayNames
                names={resolvedRouteNames}
                size={style.displayNames.resolvedNameSize}
                ellipsis={false}
                showSubNames={infoLevelFlag.isNormalEnabled}
              />
            </div>
            {hasOtherNames && (
              <>
                <hr />
                <div>
                  <InlineDisplayNames
                    names={otherRouteNames}
                    size={style.displayNames.otherNamesSize}
                    ellipsis={false}
                    showSubNames={infoLevelFlag.isNormalEnabled}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        {/* Right: agency */}
        {routeAgency && (
          <div className="ml-auto flex items-center">
            <AgencyBadge
              agency={routeAgency}
              size={style.badges.agencySize}
              infoLevel={infoLevel}
              dataLang={dataLangs}
              showBorder={true}
            />
          </div>
        )}
      </div>

      {/* Panels  */}
      <div>
        {group.data.map((d, i) => (
          <div key={i} className={style.panels.gap}>
            <TransitDisplay
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
