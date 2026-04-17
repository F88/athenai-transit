import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { resolveAgencyColors } from '../../domain/transit/agency-colors';
import { getAgencyDisplayNames } from '../../domain/transit/get-agency-display-name';
import { cn } from '../../lib/utils';
import { IdBadge } from './id-badge';
import { VerboseAgency } from '../verbose/verbose-agency';

export type AgencyBadgeSize = 'default' | 'sm' | 'xs';

const sizeVariants: Record<AgencyBadgeSize, string> = {
  default: 'text-xs px-2 py-0.5',
  sm: 'text-[10px] px-1',
  xs: 'text-[9px] px-0.5',
};

interface AgencyBadgeProps {
  /** The agency to display. */
  agency: Agency;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Agency languages for subNames sort priority. @default DEFAULT_AGENCY_LANG */
  agencyLangs?: readonly string[];
  /** Current info verbosity level. Verbose shows agency_id via IdBadge. */
  infoLevel: InfoLevel;
  /** Size variant. @default 'xs' */
  size?: AgencyBadgeSize;
  /** Suppress verbose-only rendering (IdBadge, details dump).
   *  Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Colored badge displaying an agency's primary display name.
 *
 * Uses the agency's primary brand color (`agency_colors[0]`),
 * falling back to `bg-muted-foreground text-white` when no color is set.
 * Label shows `agency_short_name` by default, falling back to
 * `agency_long_name`, then `agency_name`.
 * In verbose mode, an {@link IdBadge} with the agency_id is shown after the label.
 */
export function AgencyBadge({
  agency,
  dataLang,
  agencyLangs = DEFAULT_AGENCY_LANG,
  infoLevel,
  size = 'xs',
  disableVerbose = false,
  className,
}: AgencyBadgeProps) {
  const agencyNames = getAgencyDisplayNames(agency, dataLang, agencyLangs, 'short');
  const resolvedName = agencyNames.resolved.name || agency.agency_id;

  const { agencyColor: bg, agencyTextColor: fg } = resolveAgencyColors(agency, 'css-hex');
  const showVerbose = infoLevel === 'verbose' && !disableVerbose;

  return (
    <div className={cn('inline-flex flex-col gap-0.5 font-normal', className)}>
      <span className="inline-flex items-center gap-0.5">
        <span
          className={cn(
            'bg-muted-foreground inline-flex items-center justify-center rounded font-bold whitespace-nowrap text-white',
            sizeVariants[size],
          )}
          style={bg ? { background: bg, color: fg } : undefined}
        >
          {resolvedName || '?'}
        </span>
        {showVerbose && <IdBadge>{agency.agency_id}</IdBadge>}
      </span>
      {showVerbose && <VerboseAgency agency={agency} names={agencyNames} />}
    </div>
  );
}
