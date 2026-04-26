import { cn } from '@/lib/utils';

interface TripInspectionStopIndexProps {
  stopIndex: number;
  totalStops: number;
  direction: 'horizontal' | 'vertical';
  className?: string;
}

export function TripInspectionStopIndex({
  stopIndex,
  totalStops,
  direction,
  className,
}: TripInspectionStopIndexProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div
      className={cn(
        'text-muted-foreground border-border/60 flex shrink-0 items-center justify-center rounded-md border px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums',
        isHorizontal ? 'flex-row gap-2' : 'min-w-10 flex-col',
        className,
      )}
    >
      <span className="leading-none">{stopIndex + 1}</span>
      <hr
        className={cn(
          'border-border/60 shrink-0',
          isHorizontal ? 'h-4 border-l' : 'my-1 w-full border-t',
        )}
      />
      <span className="leading-none">{totalStops}</span>
    </div>
  );
}
