import type { InfoLevel } from '../../types/app/settings';
import type { RouteDirection } from '../../types/app/transit-composed';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { getHeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import { resolveRouteColors } from '../../domain/transit/route-colors';
import { cn } from '../../lib/utils';
import { BaseLabel, type BaseLabelSize } from './base-label';
import { VerboseHeadsign } from '../verbose/verbose-headsign';

export type HeadsignLabelSize = 'default' | 'sm' | 'xs';

const baseLabelSizes: Record<HeadsignLabelSize, BaseLabelSize> = {
  default: 'md',
  sm: 'sm',
  xs: 'xs',
};

export interface HeadsignLabelProps {
  /** Route direction context containing headsign, translations, and route. */
  routeDirection: RouteDirection;
  /** Current info verbosity level. Verbose shows route_id via IdBadge. */
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Agency languages for subNames sort priority. @default DEFAULT_AGENCY_LANG */
  agencyLang?: readonly string[];
  /** Maximum characters to display. Truncated text is not suffixed. @default undefined (no limit) */
  maxLength?: number;
  /** Size variant. @default 'default' */
  size?: HeadsignLabelSize;
  /** Suppress verbose-only rendering (IdBadge, details dump).
   *  Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Colored label displaying a headsign (destination) name.
 *
 * Internally calls {@link getHeadsignDisplayNames} to resolve the display
 * name and sub-names from headsign translations.
 *
 * Background color uses the route's designated color (`route_color`),
 * falling back to `bg-muted-foreground` when no color is set.
 * In verbose mode, a {@link VerboseHeadsign} dump is shown below the label.
 */
export function HeadsignLabel({
  routeDirection,
  infoLevel,
  dataLang,
  agencyLang = DEFAULT_AGENCY_LANG,
  maxLength,
  size = 'default',
  disableVerbose = false,
  className,
}: HeadsignLabelProps) {
  const { route } = routeDirection;
  const headsignNames = getHeadsignDisplayNames(routeDirection, dataLang, agencyLang, 'stop');

  const { routeColor, routeTextColor } = resolveRouteColors(route, 'css-hex');
  const label =
    maxLength != null && headsignNames.resolved.name.length > maxLength
      ? headsignNames.resolved.name.slice(0, maxLength)
      : headsignNames.resolved.name;
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;

  return (
    <div className="inline-flex flex-col gap-0.5 font-normal">
      <span className="inline-flex items-center gap-0.5">
        <BaseLabel
          value={headsignNames.resolved.name}
          maxLength={maxLength}
          ellipsis={false}
          size={baseLabelSizes[size]}
          className={cn(
            'bg-muted-foreground inline-flex items-center justify-center font-bold whitespace-nowrap text-white',
            'border-app-neutral border',
            className,
          )}
          style={routeColor ? { background: routeColor, color: routeTextColor } : undefined}
        />
      </span>
      {showVerbose && (
        <VerboseHeadsign
          routeDirection={routeDirection}
          names={headsignNames}
          label={label}
          maxLength={maxLength}
        />
      )}
    </div>
  );
}
