import { createContext } from 'react';

/**
 * Value shape of {@link MapSlotContext}.
 *
 * The "map slot" is a DOM element rendered by the currently-active
 * layout (`MapBottomSheetLayout` or `MultiPaneLayout`) that declares
 * where the visible map area sits inside the viewport. The hoisted
 * `MapView` follows this slot's bounding rect so Leaflet's
 * `getBounds()` / `getCenter()` / `getSize()` correspond to the
 * area the user actually sees, even though MapView itself is mounted
 * once at App root and never re-created across layout transitions.
 */
export interface MapSlotContextValue {
  /** The currently-registered slot element, or `null` if no layout has registered one yet. */
  slotElement: HTMLDivElement | null;
  /**
   * Setter used by layouts via React `ref` callback to register / unregister
   * their slot div as it mounts / unmounts. The setter's identity is stable
   * across renders (from `useState`).
   */
  setSlotElement: (el: HTMLDivElement | null) => void;
}

export const MapSlotContext = createContext<MapSlotContextValue | null>(null);
