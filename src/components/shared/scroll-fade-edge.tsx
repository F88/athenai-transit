import { cn } from '@/lib/utils';

interface ScrollFadeEdgeProps {
  position: 'top' | 'bottom';
  className?: string;
}

/**
 * Renders a sticky gradient edge inside a scroll container to hint that more content is available.
 *
 * @param position Which edge of the scroll container to pin to.
 * @param className Optional extra classes for size or opacity tuning per surface.
 * @returns A sticky gradient edge element.
 */
export function ScrollFadeEdge({ position, className }: ScrollFadeEdgeProps) {
  return position === 'top' ? (
    <div className={cn('pointer-events-none sticky top-0 z-10 h-0')}>
      <div
        className={cn(
          'from-background via-background/50 h-10 bg-linear-to-b to-transparent',
          className,
        )}
      />
    </div>
  ) : (
    <div className={cn('pointer-events-none sticky bottom-0 z-10 h-0')}>
      <div
        className={cn(
          'from-background via-background/50 h-5 -translate-y-full bg-linear-to-t to-transparent',
          className,
        )}
      />
    </div>
  );
}
