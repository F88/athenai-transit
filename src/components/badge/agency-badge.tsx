import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { getAgencyDisplayNames } from '../../domain/transit/get-agency-display-name';
import { cn } from '../../lib/utils';
import { IdBadge } from './id-badge';

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
export function AgencyBadge({ agency, infoLevel, size = 'xs', className }: AgencyBadgeProps) {
  const { name: label } = getAgencyDisplayNames(agency, infoLevel);
  const primary = agency.agency_colors[0];
  const bg = primary ? `#${primary.bg}` : undefined;
  const fg = primary ? `#${primary.text}` : undefined;

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {infoLevel === 'verbose' && <IdBadge>{agency.agency_id}</IdBadge>}
      <span
        className={cn(
          'bg-muted-foreground inline-flex items-center justify-center rounded font-bold whitespace-nowrap text-white',
          sizeVariants[size],
        )}
        style={bg ? { background: bg, color: fg } : undefined}
      >
        {label}
      </span>
    </span>
  );
}
