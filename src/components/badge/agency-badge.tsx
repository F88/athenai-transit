import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { getAgencyDisplayNames } from '../../domain/transit/get-agency-display-name';
import { cn } from '../../lib/utils';
import { IdBadge } from './id-badge';
import { VerboseAgency } from '../verbose/verbose-agency';
import { VerboseAgencyDisplayNames } from '../verbose/verbose-agency-display-names';

const sizeVariants = {
  default: 'text-xs px-2 py-0.5',
  sm: 'text-[10px] px-1',
  xs: 'text-[9px] px-0.5',
} as const;

interface AgencyBadgeProps {
  /** The agency to display. */
  agency: Agency;
  /** Current info verbosity level. Verbose shows agency_id via IdBadge. */
  infoLevel: InfoLevel;
  /** Size variant. @default 'xs' */
  size?: keyof typeof sizeVariants;
  /** Suppress verbose-only rendering (IdBadge, details dump).
   *  Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Colored badge displaying an agency's short name.
 *
 * Uses the agency's primary brand color (`agency_colors[0]`),
 * falling back to `bg-muted-foreground text-white` when no color is set.
 * Label shows `agency_short_name`, falling back to `agency_name`.
 * In verbose mode, an {@link IdBadge} with the agency_id is prepended.
 */
export function AgencyBadge({
  agency,
  infoLevel,
  size = 'xs',
  disableVerbose = false,
  className,
}: AgencyBadgeProps) {
  const agencyNames = getAgencyDisplayNames(agency, infoLevel);
  const primary = agency.agency_colors[0];
  const bg = primary ? `#${primary.bg}` : undefined;
  const fg = primary ? `#${primary.text}` : undefined;
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
          {agencyNames.name}
        </span>
        {showVerbose && <IdBadge>{agency.agency_id}</IdBadge>}
      </span>
      {showVerbose && (
        <details className="inline text-[9px] text-[#999] dark:text-gray-500">
          <summary className="cursor-pointer select-none">[Agency]</summary>
          <div className="mt-0.5 space-y-0.5">
            <VerboseAgency agency={agency} />
            <VerboseAgencyDisplayNames names={agencyNames} />
          </div>
        </details>
      )}
    </div>
  );
}
