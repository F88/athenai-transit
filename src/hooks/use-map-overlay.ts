import { useSyncExternalStore } from 'react';

import type { HighlightedCircle } from '@/types/app/map';

/**
 * Tiny global store for map overlay state that any caller can control.
 *
 * The map's {@link MapView} is hoisted to the App root (always-mounted so
 * Leaflet survives layout-mode swaps), so a component that wants to change
 * what the map draws usually lives in a different subtree and cannot reach it
 * through props. This module is a single shared channel: ANY code can set
 * these values from anywhere, and the map (App subscribes via the `use*`
 * hooks and passes the values to {@link MapView}) re-renders.
 *
 * Each value is an INDEPENDENT slot with its own setter -- a caller changes
 * only what it needs. Nothing is coupled here: drawing highlighted circles
 * does not force the distance rings on or off; whether to do both together
 * is entirely the caller's decision.
 *
 * Plain module state (not a React context): there is exactly one map, so a
 * single global slot per value suffices and avoids provider wiring.
 *
 * SINGLE active producer assumed. Each slot is single-slot and cleanup clears
 * it UNCONDITIONALLY (a producer's effect cleanup resets to the default), so
 * two producers writing at the same time would clobber each other -- e.g. A
 * sets, B sets, then A unmounts and its cleanup wipes B's overlay. Today there
 * is exactly one producer (`TransitDisplaysContainer`, rendered once in the
 * single mounted stop-browser surface), so this never happens. If multiple
 * concurrent producers are ever needed, switch to owned writes (a lease/token
 * so clear only clears the current owner) or a keyed registry.
 */
// Defaults, also returned as the SSR / hydration snapshot by the `use*` hooks.
// `getServerSnapshot` must return a cached value, so these are stable
// references rather than fresh literals.
const DEFAULT_HIGHLIGHTED_CIRCLES: readonly HighlightedCircle[] = [];
const DEFAULT_SHOW_DISTANCE_RINGS = true;

let highlightedCircles: readonly HighlightedCircle[] = DEFAULT_HIGHLIGHTED_CIRCLES;
let showDistanceRings = DEFAULT_SHOW_DISTANCE_RINGS;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Raw mutators -- module-private. Exposed only through useMapOverlayControls
// so this hooks/ module exports hooks only.
function setHighlightedCircles(next: readonly HighlightedCircle[]): void {
  highlightedCircles = next;
  emit();
}
function clearHighlightedCircles(): void {
  setHighlightedCircles([]);
}
function setShowDistanceRings(show: boolean): void {
  showDistanceRings = show;
  emit();
}

// Stable bundle: the mutators never change, so one object is reused for every
// caller (safe to list in effect dependency arrays).
const controls = { setHighlightedCircles, clearHighlightedCircles, setShowDistanceRings };

/**
 * Map overlay mutators for producers (any component drawing on the hoisted
 * map). Each is independent -- a caller changes only what it needs; drawing
 * circles does not force the distance rings on or off.
 */
export function useMapOverlayControls(): typeof controls {
  return controls;
}

/**
 * Subscribe to the highlighted circles. Returns the current list and
 * re-renders the caller whenever it changes. Intended for the single map
 * consumer (App passes the result to {@link MapView}).
 */
export function useHighlightedCircles(): readonly HighlightedCircle[] {
  return useSyncExternalStore(
    subscribe,
    () => highlightedCircles,
    () => DEFAULT_HIGHLIGHTED_CIRCLES,
  );
}

/**
 * Subscribe to the distance-rings visibility. Intended for the single map
 * consumer (App passes the result to {@link MapView}).
 */
export function useShowDistanceRings(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => showDistanceRings,
    () => DEFAULT_SHOW_DISTANCE_RINGS,
  );
}
