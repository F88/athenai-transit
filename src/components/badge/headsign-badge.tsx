import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { resolveRouteColors } from '../../domain/transit/color-resolver/route-colors';
import { getHeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import { useThemeNeutralBorderColor } from '../../hooks/use-is-low-contrast-against-theme';
import type { InfoLevel } from '../../types/app/settings';
import type { RouteDirection } from '../../types/app/transit-composed';
import { VerboseHeadsign } from '../verbose/verbose-headsign';
import { BaseBadge, type BaseBadgeSize } from './base-badge';

export type HeadsignBadgeSize = BaseBadgeSize;

export interface HeadsignBadgeProps {
  /** Route direction context containing headsign, translations, and route. */
  routeDirection: RouteDirection;
  /** Maximum characters to display. Truncated text is not suffixed. @default undefined (no limit) */
  maxLength?: number;
  /** Size variant. */
  size: HeadsignBadgeSize;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Agency languages for subNames sort priority. @default DEFAULT_AGENCY_LANG */
  agencyLang?: readonly string[];
  infoLevel: InfoLevel;
  showBorder?: boolean;
  enableVerboseExtras?: boolean;
  className?: string;
}

/**
 * Colored badge displaying a headsign (destination) name.
 *
 * Internally calls {@link getHeadsignDisplayNames} to resolve the display
 * name and sub-names from headsign translations.
 *
 * Background color uses the route's designated color (`route_color`),
 * falling back to `bg-muted-foreground` when no color is set. The
 * outline uses a theme-aware neutral gray resolved at runtime via
 * {@link useThemeNeutralBorderColor} (rather than the context cascade
 * used by `RouteBadge` / `AgencyBadge`), so the headsign stays legible
 * against every route color and across light/dark themes.
 *
 * Delegates chip + verbose layout to {@link BaseBadge}. In verbose
 * mode a {@link VerboseHeadsign} panel is rendered below the chip; no
 * IdBadge is attached for this domain.
 */
export function HeadsignBadge({
  routeDirection,
  maxLength,
  size,
  dataLang,
  agencyLang = DEFAULT_AGENCY_LANG,
  infoLevel,
  showBorder = false,
  enableVerboseExtras = false,
  className,
}: HeadsignBadgeProps) {
  const headsignNames = getHeadsignDisplayNames(routeDirection, dataLang, agencyLang, 'stop');
  const label =
    maxLength != null && headsignNames.resolved.name.length > maxLength
      ? headsignNames.resolved.name.slice(0, maxLength)
      : headsignNames.resolved.name;

  const { route } = routeDirection;
  const { routeColor, routeTextColor } = resolveRouteColors(route, 'css-hex');
  const borderColor = useThemeNeutralBorderColor();

  return (
    <BaseBadge
      label={headsignNames.resolved.name}
      size={size}
      bgColor={routeColor}
      fgColor={routeTextColor}
      borderColor={borderColor}
      showBorder={showBorder}
      className={className}
      maxLength={maxLength}
      ellipsis={false}
      infoLevel={infoLevel}
      verboseExtras={{
        enabled: enableVerboseExtras,
        slot: (
          <VerboseHeadsign
            routeDirection={routeDirection}
            names={headsignNames}
            label={label}
            maxLength={maxLength}
          />
        ),
      }}
    />
  );
}
