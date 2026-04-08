import type { InfoLevel } from '../../types/app/settings';
import type { Agency } from '../../types/app/transit';
import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import {
  getAgencyDisplayNames,
  type AgencySource,
} from '../../domain/transit/get-agency-display-name';
import { cn } from '../../lib/utils';
import { IdBadge } from './id-badge';
import { VerboseAgency } from '../verbose/verbose-agency';

export type AgencyBadgeSize = 'default' | 'sm' | 'xs';

const sizeVariants: Record<AgencyBadgeSize, string> = {
  default: 'text-xs px-2 py-0.5',
  sm: 'text-[10px] px-1',
  xs: 'text-[9px] px-0.5',
};

// Intentional feed-specific exception for the Seibu Bus dataset.
// In real sbbus data, `sbbus:3013301006265` and `sbbus:6013301006270`
// collapse to the same translated short and long labels (`西武バス` /
// `Seibu Bus`, `西武バス株式会社` / `Seibu Bus Co., Ltd.`), while their raw
// source names remain distinct (`西武観光バス` vs `西武バス`).
//
// This is not a generic formatting preference. It preserves operator
// distinguishability that would otherwise be lost by the current data model.
// Do not remove or generalize this without introducing repository-level
// metadata that can express the same exception explicitly.
const AGENCY_BADGE_NAME_PREFERENCE_BY_ID: Record<string, AgencySource> = {
  'sbbus:3013301006265': 'long',
};

const AGENCY_BADGE_USE_RAW_NAME_BY_ID = new Set(['sbbus:3013301006265']);

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
 * Label normally shows `agency_short_name`, falling back to `agency_name`.
 * Certain agencies may prefer the long-name source when the short label is
 * known to collapse distinct operators into the same UI label.
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
  const preferredSource = AGENCY_BADGE_NAME_PREFERENCE_BY_ID[agency.agency_id] ?? 'short';
  const agencyNames = getAgencyDisplayNames(agency, dataLang, agencyLangs, preferredSource);
  const preferredRawName =
    preferredSource === 'long' ? agency.agency_name : agency.agency_short_name;
  const preferredResolvedName =
    preferredSource === 'long' ? agencyNames.longName.name : agencyNames.shortName.name;

  // Keep certain agencies distinguishable even when translated labels collapse.
  const resolvedName =
    (AGENCY_BADGE_USE_RAW_NAME_BY_ID.has(agency.agency_id)
      ? preferredRawName || preferredResolvedName
      : preferredResolvedName) ||
    agencyNames.resolved.name ||
    preferredRawName ||
    agency.agency_id;

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
          {resolvedName || '?'}
        </span>
        {showVerbose && <IdBadge>{agency.agency_id}</IdBadge>}
      </span>
      {showVerbose && <VerboseAgency agency={agency} names={agencyNames} />}
    </div>
  );
}
