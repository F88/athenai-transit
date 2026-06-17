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
 * Props for {@link InlineDisplayNames}.
 */
export interface InlineDisplayNamesProps {
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

  /** When `true`, the sub-names are rendered (still requires at least one non-empty sub-name). */
  showSubNames: boolean;

  /** Extra class names applied to the primary-name span. */
  nameClassName?: string | undefined;

  /** Extra class names applied to the sub-names span. */
  subNamesClassName?: string | undefined;
}

/**
 * Render a {@link ResolvedDisplayNames} as an inline pair: primary name
 * followed by sub-names (when `showSubNames` and at least one sub-name is
 * non-empty).
 *
 * Children use `inline-block` so each span gets its own line box and
 * `leading-tight` applies to its line-height.
 */
export function InlineDisplayNames({
  names,
  size,
  ellipsis,
  showSubNames,
  nameClassName,
  subNamesClassName,
}: InlineDisplayNamesProps) {
  const { name, subNames } = names;
  const normalizedSubNames = subNames.map((e) => e.trim()).filter((s) => s !== '');
  return (
    <span
      className={
        cn()
        //
        // 'align-middle',
        // 'align-top',
        //
        //
        // 'inline-block',
        // 'leading-tight',
      }
    >
      <span
        className={cn(
          //
          NAME_TEXT_BY_SIZE[size],
          'text-[#333] dark:text-gray-200',
          'leading-tight',
          'pr-1',
          ellipsis && 'truncate',
          nameClassName,
        )}
      >
        {name}
      </span>
      {showSubNames && normalizedSubNames.length > 0 && (
        <span
          className={cn(
            //
            SUB_TEXT_BY_SIZE[size],
            'text-[#888] dark:text-gray-400',
            'inline-block',
            'leading-tight',
            ellipsis && 'truncate',
            subNamesClassName,
          )}
        >
          {normalizedSubNames.join(' / ')}
        </span>
      )}
    </span>
  );
}
