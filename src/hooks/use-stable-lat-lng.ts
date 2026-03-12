import { useState } from 'react';
import type { LatLng } from '../types/app/map';

/**
 * Return a referentially stable LatLng that only updates when coordinates change.
 *
 * Prevents downstream effects (e.g. map panning) from re-triggering when
 * a new LatLng object is created with identical lat/lng values.
 *
 * @param next - The latest computed position (or null).
 * @returns A stable LatLng reference that changes only on coordinate change.
 */
export function useStableLatLng(next: LatLng | null): LatLng | null {
  const [stable, setStable] = useState(next);

  const same =
    stable && next ? stable.lat === next.lat && stable.lng === next.lng : stable === next;

  if (!same) {
    // Synchronous setState during render is the React-recommended pattern
    // for "adjusting state based on props" without an extra effect pass.
    // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
    setStable(next);
    return next;
  }

  return stable;
}
