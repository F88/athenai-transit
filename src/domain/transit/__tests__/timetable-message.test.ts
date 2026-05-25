import { describe, expect, it } from 'vitest';

import type { TimetableOpenOutcomeStatus } from '../timetable-message';
import { getTimetableOpenOutcomeMessage } from '../timetable-message';

describe('getTimetableOpenOutcomeMessage', () => {
  it('returns no message for silent statuses', () => {
    expect(getTimetableOpenOutcomeMessage('opened')).toBeNull();
    expect(getTimetableOpenOutcomeMessage('cancelled')).toBeNull();
  });

  it('returns a warning for an unknown stop', () => {
    expect(getTimetableOpenOutcomeMessage('not-found')).toEqual({
      severity: 'warning',
      messageKey: 'timetable.messages.stopNotFound',
    });
  });

  it('returns a warning for a route missing at the stop', () => {
    expect(getTimetableOpenOutcomeMessage('route-not-found')).toEqual({
      severity: 'warning',
      messageKey: 'timetable.messages.routeNotFound',
    });
  });

  it('returns an error for open failures', () => {
    expect(getTimetableOpenOutcomeMessage('error')).toEqual({
      severity: 'error',
      messageKey: 'timetable.messages.openFailed',
    });
  });

  it('covers every TimetableOpenOutcomeStatus via exhaustive switch', () => {
    const statuses: TimetableOpenOutcomeStatus[] = [
      'opened',
      'cancelled',
      'not-found',
      'route-not-found',
      'error',
    ];

    for (const status of statuses) {
      const message = getTimetableOpenOutcomeMessage(status);
      expect(message === null || message.messageKey.startsWith('timetable.messages.')).toBe(true);
    }
  });
});
