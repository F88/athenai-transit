import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import type { ExtendedDisplaySize } from '../shared/display-size';

export type BaseLabelSize = ExtendedDisplaySize;

interface BaseLabelProps {
  value: string;
  size?: ExtendedDisplaySize;
  /** Truncate value to this many characters when exceeded. */
  maxLength?: number;
  /** Append "…" when truncated. Only effective with maxLength. @default true */
  ellipsis?: boolean;
  className?: string;
  /** Inline style for runtime-computed values (e.g. GTFS route_color hex). */
  style?: CSSProperties;
}

const sizeClasses: Record<ExtendedDisplaySize, string> = {
  xs: 'px-0.5 py-0 text-[8px]',
  sm: 'px-1 py-0.5 text-[9px]',
  md: 'px-1.5 py-1 text-[10px]',
  lg: 'px-2 py-1 text-[12px]',
  xl: 'px-2 py-1 text-[14px]',
};

/** Compact inline text label primitive. Color is controlled via className or style. */
export function BaseLabel({
  value,
  size = 'sm',
  maxLength,
  ellipsis = true,
  className,
  style,
}: BaseLabelProps) {
  const truncated = maxLength != null && value.length > maxLength;
  const display = truncated ? value.slice(0, maxLength) + (ellipsis ? '\u2026' : '') : value;
  // Dynamic colors are part of this component's runtime API.
  const styleProps = style ? { style } : undefined;
  return (
    <span
      className={cn('shrink-0 rounded font-medium', sizeClasses[size], className)}
      title={truncated ? value : undefined}
      {...styleProps}
    >
      {display}
    </span>
  );
}
