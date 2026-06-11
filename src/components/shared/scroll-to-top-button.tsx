import { useCallback, type RefObject } from 'react';

import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScrollToTopButtonProps {
  /** Scroll container to scroll back to the top on click. */
  targetRef: RefObject<HTMLDivElement | null>;
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
 * @param className Optional extra classes for per-surface position tuning.
 * @returns A sticky floating button element.
 */
export function ScrollToTopButton({ targetRef, className }: ScrollToTopButtonProps) {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    targetRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [targetRef]);

  return (
    <div
      className={cn(
        'pointer-events-none sticky bottom-4 z-10 flex h-0 justify-end pr-4',
        className,
      )}
    >
      <Button
        variant="outline"
        size="icon-sm"
        className="pointer-events-auto -translate-y-full rounded-full shadow-md"
        aria-label={t('common.scrollToTop')}
        onClick={handleClick}
      >
        <ArrowUp className="size-4" />
      </Button>
    </div>
  );
}
