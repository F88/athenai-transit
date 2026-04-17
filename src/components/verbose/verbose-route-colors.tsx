import { getAdjustedRouteColors } from '@/domain/transit/color-resolver/route-colors';
import { convertGtfsColor } from '@/domain/transit/gtfs-color';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import type { Route } from '@/types/app/transit';
import { LOW_CONTRAST_TEXT_MIN_RATIO } from '@/utils/color-contrast';
import { BaseLabel } from '../label/base-label';

function ContrastFlagBadge({ isLowContrast }: { isLowContrast: boolean }) {
  return (
    <BaseLabel
      size="xs"
      value={isLowContrast ? 'yes' : 'no'}
      className={isLowContrast ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}
    />
  );
}

/**
 * Debug dump of route color fields and theme-aware color adjustment.
 */
export function VerboseRouteColors({ route }: { route: Route }) {
  const minRatio = LOW_CONTRAST_TEXT_MIN_RATIO;
  const routeColor = convertGtfsColor(route.route_color, 'css-hex');
  const routeTextColor = convertGtfsColor(route.route_text_color, 'css-hex');
  // Assess contrast for original colors
  const routeColorAssessment = useThemeContrastAssessment(routeColor, minRatio);
  const routeTextColorAssessment = useThemeContrastAssessment(routeTextColor, minRatio);
  const adjustedRouteColors = getAdjustedRouteColors(
    route,
    routeColorAssessment.isLowContrast,
    'css-hex',
  );
  const adjustedColorAssessment = useThemeContrastAssessment(adjustedRouteColors.color, minRatio);
  const adjustedTextColorAssessment = useThemeContrastAssessment(
    adjustedRouteColors.textColor,
    minRatio,
  );

  return (
    <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 text-[9px] whitespace-nowrap text-[#999] dark:text-gray-500">
      <span className="block">
        [RouteColors] raw.color={route.route_color || '(none)'} raw.text=
        {route.route_text_color || '(none)'}
      </span>
      <span className="block">
        [RouteColor] low= <ContrastFlagBadge isLowContrast={routeColorAssessment.isLowContrast} /> |
        contrast.ratio:
        {routeColorAssessment.ratio === null
          ? '(null)'
          : routeColorAssessment.ratio.toFixed(2)}{' '}
        &lt; {minRatio}
      </span>
      <span className="block">
        [RouteTextColor] low=
        <ContrastFlagBadge isLowContrast={routeTextColorAssessment.isLowContrast} /> |
        contrast.ratio:
        {routeTextColorAssessment.ratio === null
          ? '(null)'
          : routeTextColorAssessment.ratio.toFixed(2)}{' '}
        &lt; {minRatio}
      </span>
      <span className="block">
        adjusted.color={adjustedRouteColors.color} adjusted.text={adjustedRouteColors.textColor}
      </span>
      <span className="block">
        [AdjustredRouteColor] low={' '}
        <ContrastFlagBadge isLowContrast={adjustedColorAssessment.isLowContrast} /> |
        contrast.ratio:
        {adjustedColorAssessment.ratio === null
          ? '(null)'
          : adjustedColorAssessment.ratio.toFixed(2)}{' '}
        &lt; {minRatio}
      </span>
      <span className="block">
        [AdjustredRouteTextColor] low=
        <ContrastFlagBadge isLowContrast={adjustedTextColorAssessment.isLowContrast} /> |
        contrast.ratio:
        {adjustedTextColorAssessment.ratio === null
          ? '(null)'
          : adjustedTextColorAssessment.ratio.toFixed(2)}{' '}
        &lt; {minRatio}
      </span>
    </span>
  );
}
