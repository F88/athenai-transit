import { useMemo, useState, type ReactNode } from 'react';
import { MapSlotContext, type MapSlotContextValue } from './map-slot-context';

/**
 * Holds the `slotElement` state for the hoisted MapView's slot tracking.
 *
 * Wrap the App root so:
 * - layout components can `useSetMapSlotElement()` and pass it as a
 *   `ref` callback on their slot div, and
 * - `MapViewContainer` can `useMapSlotElement()` to read the current
 *   slot for `ResizeObserver`-based bbox tracking.
 *
 * The provider value is memoised on `slotElement` so consumers re-render
 * only when the slot actually changes (mode / orientation transition).
 */
export function MapSlotProvider({ children }: { children: ReactNode }) {
  const [slotElement, setSlotElement] = useState<HTMLDivElement | null>(null);
  const value = useMemo<MapSlotContextValue>(
    () => ({ slotElement, setSlotElement }),
    [slotElement],
  );
  return <MapSlotContext.Provider value={value}>{children}</MapSlotContext.Provider>;
}
