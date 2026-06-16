import type { ResolvedDisplayNames } from '@/domain/transit/name-resolver/get-display-names';
import { cn } from '@/lib/utils';
import type { ExtendedDisplaySize } from './display-size';

const NAME_TEXT_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const SUB_TEXT_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-base',
};

/**
 * Props for {@link StackedDisplayNames}.
 */
export interface StackedDisplayNamesProps {
  /** Names to render. */
  names: ResolvedDisplayNames;

  /**
   * Base text size for the primary name. The sub-names get one step smaller.
   * Caller-provided `nameClassName` / `subNamesClassName` win over this
   * baseline (twMerge resolves `text-*` collisions with the later argument).
   */
  size: ExtendedDisplaySize;

  /** When `true`, each span is allowed to truncate with an ellipsis. */
  ellipsis: boolean;

  /** When `true`, the sub-names are rendered. */
  showSubNames: boolean;

  /** Where the sub-names sit relative to the primary name. */
  subNamesPosition: 'top' | 'bottom';

  /** Extra class names applied to the primary-name span. */
  nameClassName?: string | undefined;

  /** Extra class names applied to the sub-names span. */
  subNamesClassName?: string | undefined;
}

/**
 * Render a {@link ResolvedDisplayNames} as a vertical stack of the primary
 * name and sub-names. The order is controlled by `subNamesPosition`:
 * `'top'` puts sub-names above the name, `'bottom'` puts them below.
 *
 * The wrapper is an `inline-flex` column so the block participates in
 * surrounding inline layout while keeping its children stacked.
 */
export function StackedDisplayNames({
  names,
  size,
  ellipsis,
  showSubNames,
  subNamesPosition,
  nameClassName,
  subNamesClassName,
}: StackedDisplayNamesProps) {
  const { name, subNames } = names;
  const normalizedSubNames = subNames.map((e) => e.trim()).filter((s) => s !== '');
  const subElement =
    showSubNames && normalizedSubNames.length > 0 ? (
      <span
        className={cn(
          //
          SUB_TEXT_BY_SIZE[size],
          'text-[#888] dark:text-gray-400',
          subNamesClassName,
          ellipsis && 'truncate',
          'inline-block',
          'leading-tight',
        )}
      >
        {normalizedSubNames.join(' / ')}
      </span>
    ) : null;
  const nameElement = (
    <span
      className={cn(
        NAME_TEXT_BY_SIZE[size],
        'text-[#333] dark:text-gray-200',
        nameClassName,
        ellipsis && 'truncate',
      )}
    >
      {name}
    </span>
  );
  return (
    <span className="inline-flex min-w-0 flex-col">
      {subNamesPosition === 'top' ? (
        <>
          {subElement}
          {nameElement}
        </>
      ) : (
        <>
          {nameElement}
          {subElement}
        </>
      )}
    </span>
  );
}
