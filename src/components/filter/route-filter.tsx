import { useMemo } from 'react';

import { resolveAgencyLang } from '@/config/transit-defaults';
import { LOW_CONTRAST_BADGE_MIN_RATIO } from '@/domain/transit/color-resolver/contrast-thresholds';
import { resolveRouteColors } from '@/domain/transit/color-resolver/route-colors';
import { getRouteDisplayNames } from '@/domain/transit/name-resolver/get-route-display-names';
import { useThemeContrastBackgroundColor } from '@/hooks/use-is-low-contrast-against-theme';
import { cn } from '@/lib/utils';
import type { Agency, Route } from '@/types/app/transit';
import { getContrastAssessment } from '@/utils/color/color-contrast';

import { PillButton } from '@/components/button/pill-button';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';

/**
 * Per-`size` style bundle for {@link RouteFilter}: wrapper layout and the
 * downscaled PillButton size. Looked up via {@link ROUTE_FILTER_STYLE_BY_SIZE}.
 */
interface RouteFilterSizeStyle {
  /** Wrapper row layout utility classes. */
  wrapper: {
    /** Gap utility class between pills (`gap-*`). */
    gap: string;
    /** Padding utility class applied to the wrapper (`p-*`). */
    padding: string;
    /** Margin utility class applied to the wrapper (`m-*`). */
    margin: string;
  };
  /** PillButton rendering. */
  pill: {
    /**
     * Rendered PillButton size -- typically one notch smaller than the
     * surrounding board size so the filter row stays subordinate to the
     * boards. md / sm / xs all collapse to `xs` (the minimum), lg / xl
     * step down by one.
     */
    size: ExtendedDisplaySize;
  };
}

/**
 * Size-driven style table for {@link RouteFilter}. The `md` entry mirrors the
 * previously hardcoded wrapper values; other entries are starter values that
 * may be tuned independently.
 */
const ROUTE_FILTER_STYLE_BY_SIZE: Record<ExtendedDisplaySize, RouteFilterSizeStyle> = {
  xs: {
    wrapper: { gap: 'gap-px', padding: 'p-0', margin: 'm-0' },
    pill: { size: 'xs' },
  },
  sm: {
    wrapper: { gap: 'gap-0.5', padding: 'p-0', margin: 'm-0' },
    pill: { size: 'xs' },
  },
  md: {
    wrapper: { gap: 'gap-0.5', padding: 'p-0', margin: 'm-0' },
    pill: { size: 'xs' },
  },
  lg: {
    wrapper: { gap: 'gap-1', padding: 'p-0', margin: 'm-0' },
    pill: { size: 'sm' },
  },
  xl: {
    wrapper: { gap: 'gap-2', padding: 'p-0', margin: 'm-0' },
    pill: { size: 'md' },
  },
};

/**
 * Props for {@link RouteFilter}.
 */
export interface RouteFilterProps {
  /** Routes that have a board in the current view, deduped and sorted. */
  routes: readonly Route[];
  /** Currently active filter set, keyed by `route_id`. Empty = no filter (all shown). */
  activeFilters: Set<string>;
  /** Toggle a single route's membership in the active filter set. */
  onToggleFilter: (routeId: string) => void;
  /** Display language chain used to resolve each route's display name. */
  dataLangs: readonly string[];
  /** Agencies referenced by `routes`; used to resolve the route's agency language. */
  agencies: readonly Agency[];
  /** Pill size variant. */
  size: ExtendedDisplaySize;
}

/**
 * Filter row: one PillButton per route present in the current view. Mirrors
 * the Timetable dialog's `TimetableHeadsignFilter` -- color pills using the
 * route's brand color, with a low-contrast aware inactive border.
 *
 * The filter is additive: clicking pills marks them active; when no pill is
 * active the filter is considered off and every board passes through.
 *
 * @param props - Filter rendering inputs.
 * @returns The rendered route filter controls, or `null` when there are no routes.
 */
export function RouteFilter({
  routes,
  activeFilters,
  onToggleFilter,
  dataLangs,
  agencies,
  size,
}: RouteFilterProps) {
  const themeContrastBackgroundColor = useThemeContrastBackgroundColor();

  // Precompute the per-pill data that does not depend on the filter state
  // (color / contrast / translated label). Recomputed only when one of the
  // structural inputs changes, so toggling `activeFilters` does not re-run
  // the route name translation (the heavy part).
  const pillItems = useMemo(() => {
    return routes.map((route) => {
      const { routeColor, routeTextColor } = resolveRouteColors(route, 'css-hex');
      const routeColorAssessment = getContrastAssessment(
        routeColor,
        themeContrastBackgroundColor,
        LOW_CONTRAST_BADGE_MIN_RATIO,
      );
      const inactiveBorderColor = routeColorAssessment.isLowContrast ? routeTextColor : routeColor;
      const label =
        getRouteDisplayNames(
          route,
          dataLangs,
          resolveAgencyLang(agencies, route.agency_id),
          'short',
        ).resolved.name || route.route_id;
      return { route, routeColor, routeTextColor, inactiveBorderColor, label };
    });
  }, [routes, dataLangs, agencies, themeContrastBackgroundColor]);

  const noFilter = activeFilters.size === 0;
  const style = ROUTE_FILTER_STYLE_BY_SIZE[size];

  if (routes.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap',
        style.wrapper.gap,
        style.wrapper.padding,
        style.wrapper.margin,
      )}
    >
      {pillItems.map(({ route, routeColor, routeTextColor, inactiveBorderColor, label }) => {
        const isActive = noFilter || activeFilters.has(route.route_id);
        return (
          <PillButton
            key={route.route_id}
            size={style.pill.size}
            active={isActive}
            activeBg={routeColor}
            activeFg={routeTextColor}
            activeBorder={routeColor}
            inactiveBorder={inactiveBorderColor}
            onClick={() => onToggleFilter(route.route_id)}
          >
            {label}
          </PillButton>
        );
      })}
    </div>
  );
}
