import { ArrowRight, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import { Button } from '@/components/ui/button';
import { type TransitDisplayCategory } from '@/domain/transit/transit-info-display/build-transit-display-data';

/** Theme-aware panel face shared by the filter toggles, matching the boards. */
const BOARD_PANEL_BG = 'bg-[#f5f7fa] dark:bg-gray-800';

/**
 * Per-`size` style bundle for `TransitDisplayCategoryFilter`. Looked up via
 * {@link CATEGORY_FILTER_STYLE_BY_SIZE}; the text / icon track the board title
 * scale and the border width scales with the size-scaled label.
 */
interface CategoryFilterSizeStyle {
  /** Toggle label text size (one step larger than the rows, like the board title). */
  textClass: string;
  /**
   * Arrow icon size. A `size-*` class is required so it overrides the ui/button
   * base `[&_svg:not([class*='size-'])]:size-4`.
   */
  iconClass: string;
  /** Outer filter row: vertical / horizontal padding + gap. */
  filterBoxClass: string;
  /** Per-button. */
  button: {
    padding: string;
    border: string;
  };
}

const CATEGORY_FILTER_STYLE_BY_SIZE: Record<ExtendedDisplaySize, CategoryFilterSizeStyle> = {
  xs: {
    textClass: 'text-[10px]',
    iconClass: 'size-2.5',
    filterBoxClass: 'py-0 px-3 gap-2',
    button: {
      padding: 'px-2 py-0',
      border: 'border',
    },
  },
  sm: {
    textClass: 'text-xs',
    iconClass: 'size-3',
    filterBoxClass: 'py-0 px-3 gap-2.5',
    button: {
      padding: 'px-2 py-0',
      border: 'border border-2',
    },
  },
  md: {
    textClass: 'text-base',
    iconClass: 'size-4',
    filterBoxClass: 'py-0 px-3 gap-3',
    button: {
      padding: 'px-2 py-0',
      border: 'border border-4',
    },
  },
  lg: {
    textClass: 'text-2xl',
    iconClass: 'size-9',
    filterBoxClass: 'py-0 px-8 gap-8',
    button: {
      padding: 'px-2 py-0',
      border: 'border border-6',
    },
  },
  xl: {
    textClass: 'text-4xl',
    iconClass: 'size-15',
    filterBoxClass: 'py-0 px-12 gap-12',
    button: {
      padding: 'px-2 py-0',
      border: 'border border-8',
    },
  },
};

/**
 * Filter toggle button base metrics. The buttons always contain an arrow svg,
 * so horizontal padding uses `has-[>svg]:px-*` to override the ui/button size
 * variant's own `has-[>svg]:px-3`. Border color is applied separately (the
 * shown / hidden state classes).
 */
const FILTER_BUTTON_BASE_CLASS =
  'h-auto min-w-0 grow basis-0 rounded-sm font-bold tracking-[0.18em] uppercase hover:bg-info/20';

const FILTER_BUTTON_SHOWN_CLASS = cn(
  BOARD_PANEL_BG,
  'border-neutral-600 text-neutral-700 hover:text-neutral-900 dark:border-neutral-300 dark:text-neutral-200 dark:hover:text-neutral-100',
);
const FILTER_BUTTON_HIDDEN_CLASS = cn(
  BOARD_PANEL_BG,
  'border-neutral-300 text-neutral-400 hover:text-neutral-600 dark:border-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300',
);

interface TransitDisplayCategoryFilterProps {
  /** Categories that have a board, in board order; one toggle is rendered per entry. */
  categories: readonly TransitDisplayCategory[];
  /** Current shown / hidden state per category. */
  shownCategories: Record<TransitDisplayCategory, boolean>;
  /** Display size; scales the toggle label text like the board rows. */
  size: ExtendedDisplaySize;
  onToggleCategory: (category: TransitDisplayCategory) => void;
  /** Active-state palette (bg / border / text). Defaults to the dashboard's neutral palette. */
  shownClassName?: string;
  /** Inactive-state palette. Defaults to the dashboard's neutral palette. */
  hiddenClassName?: string;
  /** Extra classes for the outer filter box (e.g. background). */
  boxClassName?: string;
}

/**
 * Filter bar: one toggle per category, styled to match the boards (same
 * theme-aware panel face) rather than the generic chip filter. A prominent
 * toggle means the category is shown; a dimmed one means it is hidden.
 */
export function TransitDisplayCategoryFilter({
  categories,
  shownCategories,
  size,
  onToggleCategory,
  shownClassName = FILTER_BUTTON_SHOWN_CLASS,
  hiddenClassName = FILTER_BUTTON_HIDDEN_CLASS,
  boxClassName,
}: TransitDisplayCategoryFilterProps) {
  const { t } = useTranslation();
  const style = CATEGORY_FILTER_STYLE_BY_SIZE[size];
  return (
    <div
      role="group"
      aria-label={t('transitDisplay2.filter.label')}
      className={cn(
        'flex items-center rounded-sm',
        style.filterBoxClass,
        boxClassName,
        // debug
        'bg-yellow-300',
      )}
    >
      {categories.map((category) => {
        const isShown = shownCategories[category];
        const isArrival = category === 'arrivals';
        return (
          // Shared ui/button (ghost) reused for structure and focus handling,
          // restyled to the board palette: a prominent toggle means the category
          // is shown, a dimmed one means it is hidden.
          <Button
            key={category}
            variant="ghost"
            size="default"
            onClick={() => onToggleCategory(category)}
            className={cn(
              FILTER_BUTTON_BASE_CLASS,
              style.button.padding,
              style.button.border,
              style.textClass,
              isShown ? shownClassName : hiddenClassName,
            )}
          >
            {isArrival ? (
              <ArrowRight strokeWidth={4} aria-hidden className={cn('shrink-0', style.iconClass)} />
            ) : (
              <ArrowUp strokeWidth={4} aria-hidden className={cn('shrink-0', style.iconClass)} />
            )}
            <span className="truncate">
              {t(
                isArrival ? 'transitDisplay2.filter.arrivals' : 'transitDisplay2.filter.departures',
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
