import type { ResolvedDisplayNames } from '@/domain/transit/name-resolver/get-display-names';
import { cn } from '@/lib/utils';
import type { InfoLevelFlags } from '@/utils/create-info-level';

/**
 * Props for {@link StackedDisplayNames}.
 */
export interface StackedDisplayNamesProps {
  /** Names to render. */
  names: ResolvedDisplayNames;
  /** Controls whether sub-names are shown (only shown when normal info is enabled). */
  infoLevel: InfoLevelFlags;
  /** Class names applied to the primary-name span. */
  nameClass: string;
  /** Class names applied to the sub-names span. */
  subNameClass: string;
  /** When `true`, each span is allowed to truncate with an ellipsis. */
  ellipsis: boolean;
}

/**
 * Render a {@link ResolvedDisplayNames} as a vertical stack: sub-names on
 * top (when `infoLevel` allows), primary name on the bottom.
 *
 * The wrapper is an `inline-flex` column so the block participates in
 * surrounding inline layout while keeping its children stacked.
 */
export function StackedDisplayNames({
  names,
  infoLevel,
  nameClass,
  subNameClass,
  ellipsis,
}: StackedDisplayNamesProps) {
  const { name, subNames } = names;
  return (
    <span className="inline-flex min-w-0 flex-col">
      {infoLevel.isNormalEnabled && (
        <span
          className={cn(
            //
            subNameClass,
            ellipsis && 'truncate',
            'inline-block',
            'leading-tight',
          )}
        >
          {subNames.join(' / ')}
        </span>
      )}
      <span className={cn(nameClass, ellipsis && 'truncate')}>{name}</span>
    </span>
  );
}
