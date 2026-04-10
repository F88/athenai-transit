import { cn } from '../../lib/utils';

export type BaseLabelSize = 'xs' | 'sm' | 'md';

interface BaseLabelProps {
  value: string;
  size?: BaseLabelSize;
  /** Truncate value to this many characters when exceeded. */
  maxLength?: number;
  /** Append "…" when truncated. Only effective with maxLength. @default true */
  ellipsis?: boolean;
  className?: string;
}

const sizeClasses: Record<BaseLabelSize, string> = {
  xs: 'px-0.5 text-[8px]',
  sm: 'px-1 py-0.5 text-[9px]',
  md: 'px-1.5 py-0.5 text-[10px]',
};

/** Compact inline text label primitive. Color is controlled via className. */
export function BaseLabel({
  value,
  size = 'sm',
  maxLength,
  ellipsis = true,
  className,
}: BaseLabelProps) {
  const truncated = maxLength != null && value.length > maxLength;
  const display = truncated ? value.slice(0, maxLength) + (ellipsis ? '\u2026' : '') : value;
  return (
    <span
      className={cn('shrink-0 rounded font-medium', sizeClasses[size], className)}
      title={truncated ? value : undefined}
    >
      {display}
    </span>
  );
}
