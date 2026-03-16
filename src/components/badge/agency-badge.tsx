import type { Agency } from '../../types/app/transit';
import { cn } from '../../lib/utils';

const sizeVariants = {
  default: 'text-xs px-2 py-0.5',
  sm: 'text-[10px] px-1',
  xs: 'text-[9px] px-0.5',
} as const;

interface AgencyBadgeProps {
  /** The agency to display. */
  agency: Agency;
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
 */
export function AgencyBadge({ agency, size = 'xs', className }: AgencyBadgeProps) {
  const label = agency.agency_short_name || agency.agency_name;
  const primary = agency.agency_colors[0];
  const bg = primary ? `#${primary.bg}` : undefined;
  const fg = primary ? `#${primary.text}` : undefined;

  return (
    <span
      className={cn(
        'bg-muted-foreground inline-flex items-center justify-center rounded font-bold whitespace-nowrap text-white',
        sizeVariants[size],
        className,
      )}
      style={bg ? { background: bg, color: fg } : undefined}
    >
      {label}
    </span>
  );
}
