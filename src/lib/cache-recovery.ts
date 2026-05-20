import { createLogger } from './logger';

const logger = createLogger('CacheRecovery');

/**
 * Outcome of a single cache-recovery step (cache deletion or service worker
 * unregistration).
 *
 * - `ok` — the step ran and every entry succeeded. `cleared` is the count
 *   of processed entries (`0` when there were none).
 * - `partial` — the step tried every entry but some failed. `cleared` /
 *   `failed` count each, and `errors` collects the failure reasons.
 * - `unsupported` — the underlying browser API is unavailable.
 * - `failed` — the step could not even enumerate its entries (the listing
 *   call itself rejected); nothing was processed. `error` is the cause.
 */
export type CacheRecoveryStepResult =
  | { kind: 'ok'; cleared: number }
  | { kind: 'partial'; cleared: number; failed: number; errors: unknown[] }
  | { kind: 'unsupported' }
  | { kind: 'failed'; error: unknown };

/**
 * Reduce settled per-entry results into a {@link CacheRecoveryStepResult}.
 * Every entry has already been attempted; this only classifies the outcome.
 */
function summarizeSettledResults(
  results: PromiseSettledResult<boolean>[],
): CacheRecoveryStepResult {
  const errors: unknown[] = [];
  let cleared = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      cleared += 1;
    } else if (result.status === 'fulfilled') {
      errors.push(new Error('Operation resolved false'));
    } else {
      errors.push(result.reason);
    }
  }
  if (errors.length === 0) {
    return { kind: 'ok', cleared };
  }
  return { kind: 'partial', cleared, failed: errors.length, errors };
}

/**
 * Delete every entry in the Cache Storage API.
 *
 * This removes the workbox precache as well as the runtime caches
 * (`gtfs-data-v2`, `map-tiles`), so stale cached data that no longer matches
 * the running app code is discarded. `localStorage` is intentionally left
 * untouched. Every cache is attempted even if some deletions fail.
 *
 * @returns The step outcome. See {@link CacheRecoveryStepResult}.
 */
export async function clearAllCaches(): Promise<CacheRecoveryStepResult> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { kind: 'unsupported' };
  }
  let keys: string[];
  try {
    keys = await window.caches.keys();
  } catch (error) {
    return { kind: 'failed', error };
  }
  const results = await Promise.allSettled(keys.map((key) => window.caches.delete(key)));
  return summarizeSettledResults(results);
}

/**
 * Unregister every Service Worker registration for this origin.
 *
 * Every registration is attempted even if some unregistrations fail.
 *
 * @returns The step outcome. See {@link CacheRecoveryStepResult}.
 */
export async function unregisterAllServiceWorkers(): Promise<CacheRecoveryStepResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { kind: 'unsupported' };
  }
  let registrations: readonly ServiceWorkerRegistration[];
  try {
    registrations = await navigator.serviceWorker.getRegistrations();
  } catch (error) {
    return { kind: 'failed', error };
  }
  const results = await Promise.allSettled(
    registrations.map((registration) => registration.unregister()),
  );
  return summarizeSettledResults(results);
}

/** Log a step outcome, escalating to `warn` when it did not fully succeed. */
function logStep(label: string, result: CacheRecoveryStepResult): void {
  if (result.kind === 'failed' || result.kind === 'partial') {
    logger.warn(label, result);
  } else {
    logger.info(label, result);
  }
}

async function runRecoveryStep(
  label: string,
  step: () => Promise<CacheRecoveryStepResult>,
): Promise<void> {
  try {
    logStep(label, await step());
  } catch (error) {
    logger.warn(`${label} failed unexpectedly`, error);
  }
}

/**
 * Recover from a corrupted / stale cache state by clearing all caches and
 * Service Worker registrations, then reloading the page.
 *
 * The two steps are independent: a failure or unsupported result in one does
 * not prevent the other, and the page is always reloaded at the end so the
 * app re-fetches a consistent set of code and data.
 */
export async function recoverFromCacheCorruption(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    await runRecoveryStep('cleared caches', clearAllCaches);
    await runRecoveryStep('unregistered service workers', unregisterAllServiceWorkers);
  } finally {
    window.location.reload();
  }
}
