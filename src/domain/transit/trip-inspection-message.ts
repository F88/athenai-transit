import type { TripInspectionNoDataReason } from '../../types/app/repository';

export interface TripInspectionOpenOutcomeMessage {
  severity: 'warning' | 'error';
  messageKey: string;
}

export type TripInspectionOpenOutcomeMessageInput =
  | { status: 'opened' }
  | { status: 'cancelled' }
  | { status: 'error' }
  | {
      status: 'no-data';
      reason: TripInspectionNoDataReason;
    };

/**
 * Map a trip-inspection `no-data` reason to its i18n message key.
 *
 * The repository-level reasons (`'no-stop-data'`,
 * `'no-service-on-this-day'`) get dedicated keys so the UI can show
 * the specific cause. The hook-only reasons
 * (`'snapshot-unavailable'`, `'target-missing'`) collapse to the
 * generic `noData` key because the user-visible distinction is the
 * same: "we could not open trip inspection here".
 *
 * Toast firing remains at the call site, per the Phase 3 plan to keep
 * status-to-message mapping as pure data while UI effects stay in UI code.
 */
export function getTripInspectionNoDataMessageKey(reason: TripInspectionNoDataReason): string {
  switch (reason) {
    case 'no-stop-data':
      return 'tripInspection.messages.noStopData';
    case 'no-service-on-this-day':
      return 'tripInspection.messages.noServiceOnThisDay';
    case 'snapshot-unavailable':
    case 'target-missing':
      return 'tripInspection.messages.noData';
  }
}

/**
 * Convert a trip-inspection open outcome into the toast message that should be
 * shown by the UI. Opened and cancelled outcomes are intentionally silent.
 */
export function getTripInspectionOpenOutcomeMessage(
  outcome: TripInspectionOpenOutcomeMessageInput,
): TripInspectionOpenOutcomeMessage | null {
  switch (outcome.status) {
    case 'opened':
    case 'cancelled':
      return null;
    case 'no-data':
      return {
        severity: 'warning',
        messageKey: getTripInspectionNoDataMessageKey(outcome.reason),
      };
    case 'error':
      return {
        severity: 'error',
        messageKey: 'tripInspection.messages.openFailed',
      };
  }
}
