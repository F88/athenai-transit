import type { InfoLevel } from '../../types/app/settings';
import type { RouteDirection } from '../../types/app/transit-composed';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { cn } from '../../lib/utils';
import { getHeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import { VerboseHeadsign } from '../verbose/verbose-headsign';

const sizeVariants = {
  default: 'text-xs px-2 py-0.5',
  sm: 'text-[10px] px-1',
  xs: 'text-[9px] px-0.5',
} as const;

interface HeadsignBadgeProps {
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
  size?: keyof typeof sizeVariants;
  /** Suppress verbose-only rendering (IdBadge, details dump).
   *  Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Colored badge displaying a headsign (destination) name.
 *
 * Internally calls {@link getHeadsignDisplayNames} to resolve the display
 * name and sub-names from headsign translations, following the same
 * resolver pattern as {@link RouteBadge} and {@link AgencyBadge}.
 *
 * Background color uses the route's designated color (`route_color`),
 * falling back to `bg-muted-foreground` when no color is set.
 * In verbose mode, a {@link VerboseHeadsign} dump is shown below the badge.
 */
export function HeadsignBadge({
  routeDirection,
  infoLevel,
  dataLang,
  agencyLang = DEFAULT_AGENCY_LANG,
  maxLength,
  size = 'default',
  disableVerbose = false,
  className,
}: HeadsignBadgeProps) {
  const { route } = routeDirection;
  const headsignNames = getHeadsignDisplayNames(routeDirection, 'stop', dataLang, agencyLang);

  const bg = route.route_color ? `#${route.route_color}` : undefined;
  const fg = route.route_text_color ? `#${route.route_text_color}` : undefined;
  const label =
    maxLength != null && headsignNames.resolved.name.length > maxLength
      ? headsignNames.resolved.name.slice(0, maxLength)
      : headsignNames.resolved.name;
  // Show full headsign as tooltip when truncated.
  const title = label !== headsignNames.resolved.name ? headsignNames.resolved.name : undefined;
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;

  return (
    <div className="inline-flex flex-col gap-0.5 font-normal">
      <span className="inline-flex items-center gap-0.5">
        <span
          className={cn(
            'bg-muted-foreground inline-flex items-center justify-center rounded font-bold whitespace-nowrap text-white',
            sizeVariants[size],
            className,
          )}
          style={bg ? { background: bg, color: fg } : undefined}
          title={title}
        >
          {label}
        </span>
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
