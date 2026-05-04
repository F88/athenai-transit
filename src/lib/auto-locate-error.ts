/**
 * Outcome of classifying a `GeolocationPositionError` raised during
 * auto-tracking. Lets the caller (currently `MapView`) drive UI side
 * effects without re-encoding the policy.
 *
 * - `'disable'` — the error is permanent for this session
 *   (`PERMISSION_DENIED`); auto-tracking should be turned off and the
 *   user should see a toast since `watchPosition` cannot recover
 *   without a user gesture.
 * - `'transient'` — `POSITION_UNAVAILABLE` / `TIMEOUT` and any other
 *   code; `watchPosition` will keep listening and may yield the next
 *   fix, so we just log a warning and stay enabled.
 */
export type AutoLocateErrorAction =
  | { kind: 'disable'; logMessage: string }
  | { kind: 'transient'; logMessage: string };

/**
 * Classify a Geolocation API error into an {@link AutoLocateErrorAction}.
 * Pure: takes the raw error, returns a value the caller can act on.
 *
 * @param error - The error reported by `getCurrentPosition` / `watchPosition`.
 * @returns The action to take, including the log line to emit.
 */
export function classifyAutoLocateError(error: GeolocationPositionError): AutoLocateErrorAction {
  // Use the instance-side constant (`error.PERMISSION_DENIED`) rather
  // than the global (`GeolocationPositionError.PERMISSION_DENIED`):
  // both are defined by the W3C spec, but only the instance-side
  // form works in Node/jsdom test environments where the global
  // constructor is not registered.
  if (error.code === error.PERMISSION_DENIED) {
    return {
      kind: 'disable',
      logMessage: `auto-locate permission denied: ${error.message}`,
    };
  }
  return {
    kind: 'transient',
    logMessage: `auto-locate transient error code=${String(error.code)}: ${error.message}`,
  };
}
