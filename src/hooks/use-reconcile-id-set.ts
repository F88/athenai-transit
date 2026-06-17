import type { Dispatch, SetStateAction } from 'react';

import { reconcileIdSet } from '@/lib/reconcile-id-set';

/**
 * Keep a `Set<T>` state in sync with a moving `present` population: whenever
 * `tracked` holds an id that is no longer in `present`, drop it.
 *
 * Neutral with respect to allow-list / block-list semantics -- callers decide
 * what a tracked id means (active filter, hidden id, selected pin, ...). See
 * {@link reconcileIdSet} for the underlying set-intersection.
 *
 * Sync happens during render via the React-recommended "Adjusting state based
 * on props" idiom (synchronous `setState` during render, no commit / effect),
 * so the next render already sees the reconciled set and the user never sees
 * a stale frame.
 *
 * @param tracked - the current state set.
 * @param present - the current present population (pill set, present agencies, ...).
 * @param setTracked - the `useState` setter for `tracked`.
 */
export function useReconcileIdSet<T extends string>(
  tracked: Set<T>,
  present: ReadonlySet<T>,
  setTracked: Dispatch<SetStateAction<Set<T>>>,
): void {
  const reconciled = reconcileIdSet(tracked, present);
  if (reconciled !== tracked) {
    // Synchronous setState during render: see use-stable-lat-lng.ts for the
    // same idiom (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
    setTracked((prev) => {
      const sanitized = reconcileIdSet(prev, present);
      return sanitized === prev ? prev : new Set(sanitized);
    });
  }
}
