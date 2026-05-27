import { useState } from 'react';

import { isWebStorageAvailable, type WebStorageKind } from '../lib/web-storage-resolver';

/**
 * Returns whether the requested Web Storage area is reachable for the
 * current page load.
 *
 * The check runs once on first mount and the result is captured in
 * component-local state, so the value is stable across re-renders.
 * Web Storage availability does not toggle within a session in any
 * scenario this app cares about, so a one-shot read is sufficient.
 *
 * Use at any decision point that depends on whether persistence works
 * (e.g., showing a "storage unavailable" toast, hiding affordances that
 * require saving, suppressing per-operation error toasts).
 *
 * @param kind - Which Web Storage area to check.
 */
export function useWebStorageAvailability(kind: WebStorageKind): boolean {
  const [available] = useState(() => isWebStorageAvailable(kind));
  return available;
}
