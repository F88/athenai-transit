import {
  getAdjustedRouteColors,
  normalizeResolvedRouteColors,
} from '@/domain/transit/color-resolver/route-colors';
import { LOW_CONTRAST_TEXT_MIN_RATIO } from '@/domain/transit/color-resolver/contrast-thresholds';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import type { Route } from '@/types/app/transit';
import { BaseLabel } from '../label/base-label';

function ContrastFlagBadge({ isLowContrast }: { isLowContrast: boolean }) {
  return (
    <BaseLabel
      size="xs"
      value={isLowContrast ? 'Low' : 'Fine'}
      className={isLowContrast ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}
    />
  );
}

function AdjustedRouteTextColorDetails({
  label,
  color,
  minRatio,
}: {
  label: string;
  color: string;
  minRatio: number;
}) {
  const colorAssessment = useThemeContrastAssessment(color, minRatio);
  return (
    <>
      [{label}] {color} <ContrastFlagBadge isLowContrast={colorAssessment.isLowContrast} /> |
      contrast.ratio:
      {colorAssessment.ratio === null ? '(null)' : colorAssessment.ratio.toFixed(2)} &lt; {minRatio}
    </>
  );
}

/**
 * Debug dump of route color fields and theme-aware color adjustment.
 */
export function VerboseRouteColors({ route }: { route: Route }) {
  const minRatio = LOW_CONTRAST_TEXT_MIN_RATIO;
  const { routeColor, routeTextColor } = normalizeResolvedRouteColors(route, 'css-hex');
  // Assess contrast for original colors
  const routeColorAssessment = useThemeContrastAssessment(routeColor, minRatio);
  // const routeTextColorAssessment = useThemeContrastAssessment(routeTextColor, minRatio);
  const adjustedRouteColors = getAdjustedRouteColors(
    route,
    routeColorAssessment.isLowContrast,
    'css-hex',
  );

  return (
    <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 text-[9px] whitespace-nowrap text-[#999] dark:text-gray-500">
      <span className="block">
        <AdjustedRouteTextColorDetails label="RouteColor" color={routeColor} minRatio={minRatio} />
      </span>
      <span className="block">
        <AdjustedRouteTextColorDetails
          label="RouteTextColor"
          color={routeTextColor}
          minRatio={minRatio}
        />
      </span>
      <span className="block">
        <AdjustedRouteTextColorDetails
          label="AdjustredRouteColor"
          color={adjustedRouteColors.color}
          minRatio={minRatio}
        />
      </span>
      <span className="block">
        <AdjustedRouteTextColorDetails
          label="AdjustredRouteTextColor"
          color={adjustedRouteColors.textColor}
          minRatio={minRatio}
        />
      </span>
    </span>
  );
}
