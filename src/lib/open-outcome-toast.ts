import type { useTranslation } from 'react-i18next';

import { toast } from 'sonner';

/**
 * Toast payload describing the outcome of an "open" action (timetable /
 * trip inspection): a severity and the i18n message key to display.
 */
export interface OpenOutcomeToastMessage {
  severity: 'warning' | 'error';
  messageKey: string;
}

/**
 * Show the toast for an open-outcome message, or do nothing when the
 * message is `null` (silent outcomes such as `opened` / `cancelled`).
 *
 * Shared by `App` (timetable opens) and `TripInspectionContainer`
 * (trip-inspection opens) so the status-to-toast mapping lives in one place.
 */
export function showOpenOutcomeToast(
  message: OpenOutcomeToastMessage | null,
  t: ReturnType<typeof useTranslation>['t'],
): void {
  if (message === null) {
    return;
  }

  if (message.severity === 'warning') {
    toast.warning(t(message.messageKey));
    return;
  }

  toast.error(t(message.messageKey));
}
