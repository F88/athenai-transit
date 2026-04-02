import type { CSSProperties } from 'react';
import type { InfoLevel } from '../../types/app/settings';

interface ControlPanelProps {
  /** Which side of the map to place the panel. */
  side: 'left' | 'right';
  /** Which vertical edge to anchor the panel. */
  edge: 'top' | 'bottom';
  /** CSS length for the offset from the edge (e.g. `"0.75rem"`, `"2rem"`). */
  offset: string;
  /** Current info level. When `"verbose"`, a border is shown around the panel. */
  infoLevel: InfoLevel;
  /** Additional CSS classes to apply to the panel container. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Groups multiple toggle buttons into a vertical strip overlaid on the map.
 * Automatically applies `env(safe-area-inset-top)` when anchored to the top edge.
 *
 * @param side - Which side to place the panel (`"left"` or `"right"`).
 * @param edge - Vertical edge (`"top"` or `"bottom"`). Only `"top"` adds safe-area inset.
 * @param offset - CSS length offset from the edge.
 * @param infoLevel - Current info level; `"verbose"` shows a border around the panel.
 * @param children - Toggle button elements to render inside the panel.
 */
export function ControlPanel({
  side,
  edge,
  offset,
  infoLevel,
  className,
  children,
}: ControlPanelProps) {
  const sideClass = side === 'left' ? 'left-3' : 'right-3';
  const borderClass = infoLevel === 'verbose' ? 'rounded-lg bg-black/30' : '';
  // Only top edge needs safe-area-inset (Dynamic Island / notch).
  // Bottom elements have sufficient clearance without it.
  const positionStyle: CSSProperties =
    edge === 'top' ? { top: `calc(${offset} + env(safe-area-inset-top))` } : { bottom: offset };
  return (
    <div
      className={`pointer-events-none absolute z-1000 flex flex-col gap-1 ${sideClass} ${borderClass} *:pointer-events-auto ${className ?? ''}`}
      style={positionStyle}
    >
      {children}
    </div>
  );
}
