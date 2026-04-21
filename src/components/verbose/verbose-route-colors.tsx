import { resolveRouteColors } from '@/domain/transit/color-resolver/route-colors';
import {
  LOW_CONTRAST_BADGE_MIN_RATIO,
  LOW_CONTRAST_TEXT_MIN_RATIO,
  NORMALIZED_COLOR_PAIR_MIN_RATIO,
} from '@/domain/transit/color-resolver/contrast-thresholds';
import { useThemeContrastEvaluation } from '@/hooks/use-is-low-contrast-against-theme';
import type { Route } from '@/types/app/transit';
import { contrastRatio, type ContrastEvaluation } from '@/utils/color/color-contrast';
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

function RouteColorPairContrastDetails({
  routeColor,
  routeTextColor,
}: {
  routeColor: string;
  routeTextColor: string;
}) {
  const ratio = contrastRatio(routeTextColor, routeColor)?.ratio ?? null;
  const isLowContrast = ratio !== null && ratio < NORMALIZED_COLOR_PAIR_MIN_RATIO;

  return (
    <>
      [RouteColorPair] {routeColor} / {routeTextColor} |
      <ContrastFlagBadge isLowContrast={isLowContrast} /> | min:
      {NORMALIZED_COLOR_PAIR_MIN_RATIO.toFixed(2)} | ratio:
      {ratio === null ? '(null)' : ratio.toFixed(2)}
    </>
  );
}

function ThemeContrastDetails({
  label,
  evaluation,
}: {
  label: string;
  evaluation: ContrastEvaluation;
}) {
  return (
    <>
      [{label}] fg=
      <BaseLabel
        size="xs"
        value={evaluation.foreground}
        style={{ background: evaluation.foreground }}
      />{' '}
      bg=
      <BaseLabel
        size="xs"
        value={evaluation.background}
        style={{ background: evaluation.background }}
      />{' '}
      | ratio:
      {evaluation.ratio === null ? '(null)' : evaluation.ratio.toFixed(2)} / min:
      {evaluation.minRatio.toFixed(2)} |
      <ContrastFlagBadge isLowContrast={evaluation.isLowContrast} />
    </>
  );
}

/**
 * Debug dump of route colors and their contrast metrics.
 */
export function VerboseRouteColors({ route }: { route: Route }) {
  const { routeColor, routeTextColor } = resolveRouteColors(route, 'css-hex');
  const routeColorEvaluation = useThemeContrastEvaluation(routeColor, LOW_CONTRAST_BADGE_MIN_RATIO);
  const routeTextColorEvaluation = useThemeContrastEvaluation(
    routeTextColor,
    LOW_CONTRAST_TEXT_MIN_RATIO,
  );

  return (
    <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 text-[9px] whitespace-nowrap text-[#999] dark:text-gray-500">
      <span className="block">
        <RouteColorPairContrastDetails routeColor={routeColor} routeTextColor={routeTextColor} />
      </span>
      <span className="block">
        <ThemeContrastDetails label="RouteColor vs Theme" evaluation={routeColorEvaluation} />
      </span>
      <span className="block">
        <ThemeContrastDetails
          label="RouteTextColor vs Theme"
          evaluation={routeTextColorEvaluation}
        />
      </span>
    </span>
  );
}
