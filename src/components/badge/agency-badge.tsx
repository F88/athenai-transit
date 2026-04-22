import { resolveContextBorderColor } from '../../domain/transit/color-resolver/context-border-color';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { resolveAgencyColors } from '../../domain/transit/color-resolver/agency-colors';
import { getAgencyDisplayNames } from '../../domain/transit/get-agency-display-name';
import { useThemeContrastBackgroundColor } from '../../hooks/use-is-low-contrast-against-theme';
import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { VerboseAgency } from '../verbose/verbose-agency';
import { BaseBadge, type BaseBadgeSize } from './base-badge';

export type AgencyBadgeSize = BaseBadgeSize;

interface AgencyBadgeProps {
  agency: Agency;
  size: AgencyBadgeSize;
  dataLang: readonly string[];
  agencyLangs?: readonly string[];
  infoLevel: InfoLevel;
  showBorder?: boolean;
  enableVerboseExtras?: boolean;
  className?: string;
}

/**
 * Colored badge displaying an agency's primary display name.
 *
 * Uses the agency's primary brand color (`agency_colors[0]`),
 * falling back to `bg-muted-foreground text-white` when no color is set.
 * Label shows `agency_short_name` by default, falling back to
 * `agency_long_name`, then `agency_name`.
 *
 * The outline color is resolved at runtime from the agency colors and the
 * current theme background using {@link useThemeContrastBackgroundColor}
 * and {@link resolveContextBorderColor}, so the badge stays distinguishable
 * from the surrounding surface within the current visual context.
 *
 * Delegates chip + verbose layout to {@link BaseBadge}. In verbose mode
 * an IdBadge with the `agency_id` appears alongside the chip and a
 * {@link VerboseAgency} panel is rendered below.
 */
export function AgencyBadge({
  agency,
  size,
  dataLang,
  agencyLangs = DEFAULT_AGENCY_LANG,
  infoLevel,
  showBorder = false,
  enableVerboseExtras = false,
  className,
}: AgencyBadgeProps) {
  const agencyNames = getAgencyDisplayNames(agency, dataLang, agencyLangs, 'short');
  const resolvedName = agencyNames.resolved.name || agency.agency_id;

  const { agencyColor, agencyTextColor } = resolveAgencyColors(agency, 'css-hex');
  const themeBackground = useThemeContrastBackgroundColor();
  const borderColor = resolveContextBorderColor(
    agencyColor ?? '',
    agencyTextColor ?? '',
    themeBackground,
  );

  return (
    <BaseBadge
      label={resolvedName || '?'}
      size={size}
      bgColor={agencyColor}
      fgColor={agencyTextColor}
      borderColor={borderColor}
      showBorder={showBorder}
      className={className}
      infoLevel={infoLevel}
      verboseExtras={{
        enabled: enableVerboseExtras,
        idLabel: agency.agency_id,
        slot: <VerboseAgency agency={agency} names={agencyNames} />,
      }}
    />
  );
}
