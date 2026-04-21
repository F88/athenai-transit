import { getContrastAssessment } from '../../../utils/color/color-contrast';
import { LOW_CONTRAST_BADGE_MIN_RATIO } from './contrast-thresholds';

/**
 * Resolve an outline color from a route's color pair using the
 * context cascade.
 *
 * Cascade:
 *
 * 1. `routeColor` when it has sufficient contrast against the current
 *    theme background — the outline blends with the fill and keeps
 *    the element visually anchored to the route's own color.
 * 2. `routeTextColor` otherwise — the paired accent color, trusted to
 *    be an appropriate outline since the color resolver already
 *    normalizes GTFS values into a usable pair.
 *
 * A `routeColor` that can't be parsed (e.g. empty string) is treated
 * as cascade failure for the first step and falls through to
 * `routeTextColor`.
 *
 * @param routeColor - Primary fill color, typically GTFS `route_color`.
 * @param routeTextColor - Paired accent color, typically GTFS
 *   `route_text_color`.
 * @param themeBackground - Current theme background color used as the
 *   contrast reference.
 * @param minRatio - WCAG contrast threshold. Defaults to
 *   {@link LOW_CONTRAST_BADGE_MIN_RATIO}.
 * @returns A CSS color string — `routeColor` when the first step
 *   succeeds, otherwise `routeTextColor`.
 */
export function resolveContextBorderColor(
  routeColor: string,
  routeTextColor: string,
  themeBackground: string,
  minRatio: number = LOW_CONTRAST_BADGE_MIN_RATIO,
): string {
  const routeColorAssessment = getContrastAssessment(routeColor, themeBackground, minRatio);
  if (routeColorAssessment.ratio != null && !routeColorAssessment.isLowContrast) {
    return routeColor;
  }
  return routeTextColor;
}
