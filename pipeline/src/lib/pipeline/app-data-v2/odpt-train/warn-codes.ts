/**
 * Warning codes emitted during ODPT timetable build.
 *
 * SSOT for diagnostic codes used by build-timetable.ts (production)
 * and vitest tests. Codes are stable identifiers — code names may
 * change during implementation but are frozen at PR finalization.
 *
 * Helper functions in build-timetable.ts return Diagnostic[]; the
 * wrapper buildTripPatternsAndTimetableFromOdpt translates them into
 * `console.warn` lines and decides whether to apply legacy fallback.
 *
 * @internal
 */

export const ODPT_WARN_CODES = {
  /** Layer 1 monotonic check failed for a unit; inference skipped. */
  INFERENCE_SKIPPED_NON_MONOTONIC: 'INFERENCE_SKIPPED_NON_MONOTONIC',
  /** odpt:originStation populate < 100% or length !== 1; canonical rejected. */
  CANONICAL_REJECTED_PARTIAL_POPULATE: 'CANONICAL_REJECTED_PARTIAL_POPULATE',
  /** Layer 1 count !== Layer 2 unmatched count; inference rejected. */
  INFERENCE_REJECTED_LAYER_MISMATCH: 'INFERENCE_REJECTED_LAYER_MISMATCH',
  /** Terminal arr-only entry could not be traced upstream; entry dropped. */
  DROPPED_UNTRACEABLE_ARR_ONLY: 'DROPPED_UNTRACEABLE_ARR_ONLY',
  /** End-of-walk pending trip never reached destination; trip dropped. */
  DROPPED_PENDING_TRIP: 'DROPPED_PENDING_TRIP',
  /** Adjacent stop pair has no observed travel time; unit fallback. */
  TRAVEL_TIME_PAIR_MISSING: 'TRAVEL_TIME_PAIR_MISSING',
} as const;

export type OdptWarnCode = (typeof ODPT_WARN_CODES)[keyof typeof ODPT_WARN_CODES];

/**
 * Diagnostic emitted by helper functions; wrapper turns these into
 * `console.warn` lines and decides on per-unit legacy fallback.
 *
 * @internal
 */
export interface OdptDiagnostic {
  code: OdptWarnCode;
  /** UnitKey of the affected unit, when applicable. */
  unit?: string;
  /** Human-readable detail; not part of the stable contract. */
  detail: string;
}
