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
  /** Whether the button is shown. Changes fade in/out; while hidden the button is inert. */
  visible: boolean;
  /** Button display size; resolved to the button dimensions and icon scale. */
  size?: ExtendedDisplaySize;
  /** Optional extra classes for per-surface position tuning. */
  className?: string;
}

/**
 * Floating "back to top" button pinned near the bottom-right corner of a
 * scroll container.
 *
 * Render it unconditionally inside the scroll container after the content,
 * and drive `visible` with the container's scrolled-down state (e.g.
 * `useScrollOverflow().hasContentAbove`) — visibility changes fade instead
 * of mount/unmount so the transition can run in both directions. The sticky
 * zero-height wrapper keeps the button from adding scroll height.
 *
 * @param targetRef Scroll container to scroll back to the top on click.
 * @param visible Whether the button is shown; changes fade in/out.
 * @param size Button display size; resolved to the button dimensions and icon scale.
 * @param className Optional extra classes for per-surface position tuning.
 * @returns A sticky floating button element.
 */
export function ScrollToTopButton({
  targetRef,
  visible,
  size = 'sm',
  className,
}: ScrollToTopButtonProps) {
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
        // type="button": the shadcn Button sets no type, so the native
        // default (submit inside a form) would apply; every tappable
        // primitive in this app pins type="button".
        type="button"
        variant="outline"
        size="icon"
        // Background: the same 60% translucent surface in both themes, on
        // purpose. The outline variant is opaque in light but nearly
        // transparent in dark (dark:bg-input/30 = ~5% effective alpha),
        // which made the themes diverge over scrolled content. The dark:
        // duplicate of bg-background/60 is required even though its value is
        // identical: it is what removes the variant's dark:bg-input/30 in
        // tailwind-merge.
        // cursor-pointer: the shadcn Button ships no cursor class; floating
        // tappable buttons in this app show a pointer (see
        // MAP_OVERLAY_BUTTON_BASE_STYLE).
        // visibility joins the transition so the hidden state (which kills
        // taps and focus) lands only after the fade-out completes.
        // scale composes with the positioning -translate-y-full because
        // Tailwind v4 emits scale/translate as individual CSS properties.
        className={cn(
          'bg-background/60 dark:bg-background/60 dark:hover:bg-accent -translate-y-full cursor-pointer rounded-full border',
          'transition-[opacity,scale,visibility] duration-500 ease-out motion-reduce:transition-none',
          visible
            ? 'pointer-events-auto visible scale-100 opacity-100'
            : 'pointer-events-none invisible scale-50 opacity-0',
          BUTTON_SIZE_CLASS_BY_DISPLAY_SIZE[size],
        )}
        aria-label={t('common.scrollToTop')}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        onClick={handleClick}
      >
        <ArrowUp className={ICON_SIZE_CLASS_BY_DISPLAY_SIZE[size]} />
      </Button>
    </div>
  );
}
