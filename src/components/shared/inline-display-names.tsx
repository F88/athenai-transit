import type { ResolvedDisplayNames } from '@/domain/transit/name-resolver/get-display-names';
import { cn } from '@/lib/utils';
import type { InfoLevelFlags } from '@/utils/create-info-level';

/**
 * Props for {@link InlineDisplayNames}.
 */
export interface InlineDisplayNamesProps {
  /** Names to render. */
  names: ResolvedDisplayNames;
  /** Controls whether sub-names are shown (only shown when normal info is enabled and at least one sub-name is non-empty). */
  infoLevel: InfoLevelFlags;
  /** Class names applied to the primary-name span. */
  nameClass: string;
  /** Class names applied to the sub-names span. */
  subNameClass: string;
  /** When `true`, each span is allowed to truncate with an ellipsis. */
  ellipsis: boolean;
}

/**
 * Render a {@link ResolvedDisplayNames} as an inline pair: primary name
 * followed by sub-names (when present and `infoLevel` allows).
 *
 * Children use `inline-block` so each span gets its own line box and
 * `leading-tight` applies to its line-height.
 */
export function InlineDisplayNames({
  names,
  infoLevel,
  nameClass,
  subNameClass,
  ellipsis,
}: InlineDisplayNamesProps) {
  return (
    <span className="">
      <span
        className={cn(
          //
          nameClass,
          ellipsis && 'truncate',
          'inline-block',
          'leading-tight',
        )}
      >
        {names.name}
      </span>
      {infoLevel.isNormalEnabled && names.subNames.length > 0 && (
        <span
          className={cn(
            //
            subNameClass,
            ellipsis && 'truncate',
            'inline-block',
            'leading-tight',
          )}
        >
          {names.subNames.join(' / ')}
        </span>
      )}
    </span>
  );
}
