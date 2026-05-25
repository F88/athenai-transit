import type { TripInspectionNoDataReason } from '../../types/app/repository';

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
 * Toast firing (`toast.warning(t(key))`) and the `'error'` branch of
 * the open outcome remain at the call site, per the Phase 3 plan to
 * keep status->key as pure data while wording assembly stays in UI
 * code.
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
