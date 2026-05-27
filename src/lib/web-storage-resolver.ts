/**
 * Safely resolve a Web Storage area from the global scope.
 *
 * Reads `globalThis.localStorage` / `globalThis.sessionStorage` defensively.
 * If the getter itself throws (e.g., Chrome's "block all cookies and site
 * data" setting raises `SecurityError` on access), returns `undefined`
 * instead of propagating the exception.
 *
 * Storage acquisition lives here; downstream consumers (`WebStorageItem`,
 * repositories) accept `Storage | undefined` and degrade gracefully when
 * undefined.
 */

export type WebStorageKind = 'local' | 'session';

/**
 * Resolve the requested Web Storage area, or `undefined` when the host
 * blocks access to it.
 *
 * Not cached: the underlying try/catch is cheap, and avoiding cache keeps
 * tests free of cross-suite state. Callers that need a stable snapshot
 * across a session should store the return value themselves.
 *
 * @param kind - Which Web Storage area to resolve.
 */
export function resolveWebStorage(kind: WebStorageKind): Storage | undefined {
  try {
    return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Convenience boolean form of {@link resolveWebStorage} for availability
 * decisions (e.g., the App-level "storage unavailable" toast). Returns
 * `true` when the storage area is reachable, `false` when the getter
 * throws.
 *
 * @param kind - Which Web Storage area to check.
 */
export function isWebStorageAvailable(kind: WebStorageKind): boolean {
  return resolveWebStorage(kind) !== undefined;
}
