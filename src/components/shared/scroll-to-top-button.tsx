import { useCallback, type RefObject } from 'react';

import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';

/**
 * Per-size button dimensions. The shadcn Button has no icon variant larger
 * than `icon-lg` (size-10), so sizes grow via a className override instead.
 */
const BUTTON_SIZE_CLASS_BY_DISPLAY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'size-8',
  sm: 'size-10',
  md: 'size-12',
  lg: 'size-16',
  xl: 'size-18',
};

/** Per-size arrow icon scale, proportional to the button dimensions. */
const ICON_SIZE_CLASS_BY_DISPLAY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'size-5',
  sm: 'size-6',
  md: 'size-7',
  lg: 'size-10',
  xl: 'size-12',
};

interface ScrollToTopButtonProps {
  /** Scroll container to scroll back to the top on click. */
  targetRef: RefObject<HTMLDivElement | null>;
  /** Button display size; resolved to the button dimensions and icon scale. */
  size?: ExtendedDisplaySize;
  /** Optional extra classes for per-surface position tuning. */
  className?: string;
}

/**
 * Floating "back to top" button pinned near the bottom-right corner of a
 * scroll container.
 *
 * Render it inside the scroll container after the content, gated on the
 * container's scrolled-down state (e.g. `useScrollOverflow().hasContentAbove`), the
 * same way {@link ScrollFadeEdge} is gated. The sticky zero-height wrapper
 * keeps the button from adding scroll height.
 *
 * @param targetRef Scroll container to scroll back to the top on click.
 * @param size Button display size; resolved to the button dimensions and icon scale.
 * @param className Optional extra classes for per-surface position tuning.
 * @returns A sticky floating button element.
 */
export function ScrollToTopButton({ targetRef, size = 'sm', className }: ScrollToTopButtonProps) {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    targetRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [targetRef]);

  return (
    <div
      className={cn(
        'pointer-events-none sticky bottom-4 z-10 flex h-0 justify-end pr-6 pb-0',
        className,
      )}
    >
      <Button
        variant="outline"
        size="icon"
        // The outline variant's translucent dark surface (dark:bg-input/30)
        // would let the scrolled content bleed through this floating button,
        // so force the same opaque background/hover pairing as light mode.
        // cursor-pointer: the shadcn Button ships no cursor class; floating
        // tappable buttons in this app show a pointer (see
        // MAP_OVERLAY_BUTTON_BASE_STYLE).
        className={cn(
          'bg-background/60 dark:bg-background/60 dark:hover:bg-accent pointer-events-auto -translate-y-full cursor-pointer rounded-full border',
          BUTTON_SIZE_CLASS_BY_DISPLAY_SIZE[size],
        )}
        aria-label={t('common.scrollToTop')}
        onClick={handleClick}
      >
        <ArrowUp className={ICON_SIZE_CLASS_BY_DISPLAY_SIZE[size]} />
      </Button>
    </div>
  );
}
