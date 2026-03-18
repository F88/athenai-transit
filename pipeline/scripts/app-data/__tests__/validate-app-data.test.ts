import { describe, expect, it } from 'vitest';

import {
  determineExitCode,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARN,
  type CalendarCheckResult,
  type FileCheckResult,
} from '../validate-app-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileResult(overrides?: Partial<FileCheckResult>): FileCheckResult {
  return {
    total: 8,
    present: 8,
    missing: [],
    ...overrides,
  };
}

function makeCalendarResult(overrides?: Partial<CalendarCheckResult>): CalendarCheckResult {
  return {
    totalServices: 10,
    expired: [],
    expiringSoon: [],
    loadErrors: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('determineExitCode', () => {
  it('returns EXIT_OK when all checks pass', () => {
    expect(determineExitCode(makeFileResult(), makeCalendarResult())).toBe(EXIT_OK);
  });

  // --- Errors (exit 2) ---

  it('returns EXIT_ERROR when files are missing', () => {
    const fileResult = makeFileResult({
      present: 7,
      missing: [{ source: 'test', file: 'stops.json' }],
    });
    expect(determineExitCode(fileResult, makeCalendarResult())).toBe(EXIT_ERROR);
  });

  it('returns EXIT_ERROR when calendar has load errors', () => {
    const calendarResult = makeCalendarResult({ loadErrors: 1 });
    expect(determineExitCode(makeFileResult(), calendarResult)).toBe(EXIT_ERROR);
  });

  // --- Warnings (exit 1) ---

  it('returns EXIT_WARN when services are expired', () => {
    const calendarResult = makeCalendarResult({
      expired: [{ source: 'edobus', serviceId: 'svc1', endDate: '2025-11-30' }],
    });
    expect(determineExitCode(makeFileResult(), calendarResult)).toBe(EXIT_WARN);
  });

  it('returns EXIT_WARN when services are expiring soon', () => {
    const calendarResult = makeCalendarResult({
      expiringSoon: [{ source: 'ktbus', serviceId: 'svc2', endDate: '2026-03-31', daysLeft: 13 }],
    });
    expect(determineExitCode(makeFileResult(), calendarResult)).toBe(EXIT_WARN);
  });

  it('returns EXIT_WARN when both expired and expiring-soon exist', () => {
    const calendarResult = makeCalendarResult({
      expired: [{ source: 'edobus', serviceId: 'svc1', endDate: '2025-11-30' }],
      expiringSoon: [{ source: 'ktbus', serviceId: 'svc2', endDate: '2026-03-31', daysLeft: 13 }],
    });
    expect(determineExitCode(makeFileResult(), calendarResult)).toBe(EXIT_WARN);
  });

  // --- Error takes precedence over warning ---

  it('returns EXIT_ERROR when both missing files and expired services exist', () => {
    const fileResult = makeFileResult({
      present: 7,
      missing: [{ source: 'test', file: 'stops.json' }],
    });
    const calendarResult = makeCalendarResult({
      expired: [{ source: 'edobus', serviceId: 'svc1', endDate: '2025-11-30' }],
    });
    expect(determineExitCode(fileResult, calendarResult)).toBe(EXIT_ERROR);
  });
});
