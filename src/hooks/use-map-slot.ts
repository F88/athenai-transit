import { useContext } from 'react';
import { MapSlotContext } from '../contexts/map-slot-context';

/**
 * Returns the currently-registered map slot element, or `null` if no
 * layout has registered one yet.
 *
 * Must be called inside a `MapSlotProvider`. Throws if the context is
 * missing.
 *
 * Intended for `MapViewContainer` to observe the slot's bbox via
 * `useElementRect` and position the hoisted MapView wrapper to match.
 */
export function useMapSlotElement(): HTMLDivElement | null {
  const ctx = useContext(MapSlotContext);
  if (!ctx) {
    throw new Error('useMapSlotElement must be used within a MapSlotProvider');
  }
  return ctx.slotElement;
}

/**
 * Returns the setter used to register / unregister the map slot
 * element. Intended for layout components to pass as a React `ref`
 * callback on their slot div.
 *
 * The returned setter has stable identity across renders, so using it
 * as a `ref` does not cause React to call it with `null` then the
 * element on every render.
 *
 * Must be called inside a `MapSlotProvider`. Throws if the context is
 * missing.
 */
export function useSetMapSlotElement(): (el: HTMLDivElement | null) => void {
  const ctx = useContext(MapSlotContext);
  if (!ctx) {
    throw new Error('useSetMapSlotElement must be used within a MapSlotProvider');
  }
  return ctx.setSlotElement;
}
