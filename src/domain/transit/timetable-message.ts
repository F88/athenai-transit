export interface TimetableOpenOutcomeMessage {
  severity: 'warning' | 'error';
  messageKey: string;
}

export type TimetableOpenOutcomeStatus =
  'opened' | 'cancelled' | 'not-found' | 'route-not-found' | 'error';

/**
 * Convert a timetable open outcome status into the toast message that should be
 * shown by the UI. Opened and cancelled outcomes are intentionally silent.
 */
export function getTimetableOpenOutcomeMessage(
  status: TimetableOpenOutcomeStatus,
): TimetableOpenOutcomeMessage | null {
  switch (status) {
    case 'opened':
    case 'cancelled':
      return null;
    case 'not-found':
      return {
        severity: 'warning',
        messageKey: 'timetable.messages.stopNotFound',
      };
    case 'route-not-found':
      return {
        severity: 'warning',
        messageKey: 'timetable.messages.routeNotFound',
      };
    case 'error':
      return {
        severity: 'error',
        messageKey: 'timetable.messages.openFailed',
      };
  }
}
