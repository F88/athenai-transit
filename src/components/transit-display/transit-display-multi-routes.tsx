import { useMemo } from 'react';

import type { TransitDisplayDataWithMetaData } from '@/domain/transit/transit-info-display/build-transit-display-data';
import { cn } from '@/lib/utils';
import { routeTypesEmoji } from '@/utils/route-type-emoji';

import { RouteBadge } from '@/components/badge/route-badge';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { TransitDisplay } from '@/components/transit-display/transit-display';
import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

/**
 * Per-`size` style bundle for {@link TransitDisplayMultiRoutes}: child component
 * sizes and layout utility classes, grouped by concern. Looked up via
 * {@link MULTI_ROUTES_STYLE_BY_SIZE}.
 */
interface MultiRoutesSizeStyle {
  /** Layout for the stacked board panels below the route info row. */
  panel: {
    padding: string;
  };
  /** Layout utility classes for the route info row (the header). */
  info: {
    margin: string;
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
  /** Sizes for the badges in the route info row. */
  badges: {
    /** `RouteBadge` size. */
    routeSize: ExtendedDisplaySize;
  };
}

/**
 * Size-driven style table for {@link TransitDisplayMultiRoutes}. The `size` prop
 * picks one entry; usage will be wired up to the JSX in a follow-up step.
 * The `md` entry mirrors the previously hardcoded values exactly.
 */
const MULTI_ROUTES_STYLE_BY_SIZE: Record<ExtendedDisplaySize, MultiRoutesSizeStyle> = {
  xs: {
    panel: { padding: '' },
    info: {
      margin: 'mb-2',
      padding: 'px-1 py-1',
      gap: 'gap-1',
      borderWidth: 'border',
      borderRadius: 'rounded-sm',
    },
    routeTypeEmoji: { textSize: 'text-xs' },
    badges: { routeSize: 'xs' },
  },
  sm: {
    panel: { padding: '' },
    info: {
      margin: 'mb-4',
      padding: 'px-1.5 py-0.5',
      gap: 'gap-1.5',
      borderWidth: 'border-2',
      borderRadius: 'rounded',
    },
    routeTypeEmoji: { textSize: 'text-sm' },
    badges: { routeSize: 'xs' },
  },
  md: {
    panel: { padding: '' },
    info: {
      margin: 'mb-4',
      padding: 'px-2 py-1',
      gap: 'gap-2',
      borderWidth: 'border-3',
      borderRadius: 'rounded-lg',
    },
    routeTypeEmoji: { textSize: 'text-xl' },
    badges: { routeSize: 'sm' },
  },
  lg: {
    panel: { padding: '' },
    info: {
      margin: 'mb-4',
      padding: 'px-3 py-2',
      gap: 'gap-3',
      borderWidth: 'border-4',
      borderRadius: 'rounded-lg',
    },
    routeTypeEmoji: { textSize: 'text-2xl' },
    badges: { routeSize: 'lg' },
  },
  xl: {
    panel: { padding: '' },
    info: {
      margin: 'mb-4',
      padding: 'px-4 py-3',
      gap: 'gap-3',
      borderWidth: 'border-8',
      borderRadius: 'rounded-xl',
    },
    routeTypeEmoji: { textSize: 'text-4xl' },
    badges: { routeSize: 'xl' },
  },
};

export interface TransitDisplayMultiRoutesProps {
  transitDisplayDataWithMetaData: TransitDisplayDataWithMetaData;
  dataLangs: readonly string[];
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  size: ExtendedDisplaySize;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Renders one multi-route board (a board carrying several routes, e.g. the
 * folded bus / trolleybus / ferry boards) as a card-like section: a header band
 * with the route-type emoji and a `RouteBadge` per route (from `meta.routes`),
 * above the board itself ({@link TransitDisplay}). The multi-route counterpart
 * of {@link TransitDisplayPerRoute}; a seam for future multi-route specific
 * chrome.
 */
export function TransitDisplayMultiRoutes({
  transitDisplayDataWithMetaData,
  dataLangs,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayMultiRoutesProps) {
  const { meta, data: transitDisplayData } = transitDisplayDataWithMetaData;

  const style = MULTI_ROUTES_STYLE_BY_SIZE[size];

  const routeTypeIcon = routeTypesEmoji(meta.routeTypes);

  // Routes shown in the header band, ordered by route_id alphabetical so the
  // badge order is stable across renders and matches sortTransitDisplayDataWithMetaData.
  const sortedRoutes = useMemo(
    () => [...meta.routes].sort((a, b) => a.route_id.localeCompare(b.route_id)),
    [meta.routes],
  );

  const information = (
    <div
      className={cn(
        'flex items-center',
        'overflow-hidden',
        style.info.gap,
        style.info.margin,
        style.info.padding,
        style.info.borderRadius,
        style.info.borderWidth,
        'border-gray-600 dark:border-gray-600',
      )}
      // style={{
      //   borderColor: '#555555',
      // }}
    >
      {/* Left: route info */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={style.routeTypeEmoji.textSize}>{routeTypeIcon}</span>

        <div className="flex flex-wrap items-center gap-1">
          {sortedRoutes.map((route) => {
            // Find the agency that runs this route. board scope may span multiple
            // stops, so flatten all agencies present and match by agency_id.
            const agency = transitDisplayData.data
              .flatMap((c) => c.stop.agencies)
              .find((a) => a.agency_id === route.agency_id);
            const agencyLangs = agency ? [agency.agency_lang] : undefined;
            return (
              <RouteBadge
                key={route.route_id}
                route={route}
                dataLang={dataLangs}
                agencyLangs={agencyLangs}
                infoLevel={infoLevel}
                size={style.badges.routeSize}
                showBorder={true}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <section className="overflow-hidden">
      {/* Info */}
      {infoLevel === 'verbose' && information}

      {/* Panel  */}
      <div className={style.panel.padding}>
        <TransitDisplay
          transitDisplayDataWithMetaData={transitDisplayDataWithMetaData}
          dataLangs={dataLangs}
          now={now}
          mapCenter={mapCenter}
          infoLevel={infoLevel}
          size={size}
          onStopSelected={onStopSelected}
          onInspectTrip={onInspectTrip}
        />
      </div>
    </section>
  );
}
