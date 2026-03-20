/**
 * @vitest-environment node
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkUnvalidatedDirs,
  determineExitCode,
  EXIT_ERROR,
  EXIT_OK,
  EXIT_WARN,
  resolveSources,
  type CalendarCheckResult,
  type FileCheckResult,
  type UnvalidatedDirResult,
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

  // --- Unvalidated directories (--targets mode) ---

  it('returns EXIT_OK when unvalidatedResult is undefined (single prefix mode)', () => {
    expect(determineExitCode(makeFileResult(), makeCalendarResult(), undefined)).toBe(EXIT_OK);
  });

  it('returns EXIT_OK when unvalidatedResult has no unvalidated dirs', () => {
    const unvalidated: UnvalidatedDirResult = { unvalidated: [] };
    expect(determineExitCode(makeFileResult(), makeCalendarResult(), unvalidated)).toBe(EXIT_OK);
  });

  it('returns EXIT_ERROR when unvalidated directories exist', () => {
    const unvalidated: UnvalidatedDirResult = { unvalidated: ['tkbus'] };
    expect(determineExitCode(makeFileResult(), makeCalendarResult(), unvalidated)).toBe(EXIT_ERROR);
  });

  it('returns EXIT_ERROR when unvalidated dirs exist even with only warnings otherwise', () => {
    const calendarResult = makeCalendarResult({
      expiringSoon: [{ source: 'ktbus', serviceId: 'svc2', endDate: '2026-03-31', daysLeft: 13 }],
    });
    const unvalidated: UnvalidatedDirResult = { unvalidated: ['tkbus'] };
    expect(determineExitCode(makeFileResult(), calendarResult, unvalidated)).toBe(EXIT_ERROR);
  });
});

// ---------------------------------------------------------------------------
// resolveSources
// ---------------------------------------------------------------------------

describe('resolveSources', () => {
  const prefixMap = new Map([
    ['minkuru', 'Toei Bus'],
    ['toaran', 'Toei Train'],
    ['yurimo', 'Yurikamome Railway'],
  ]);

  it('resolves known prefixes to ValidateSource with nameEn', () => {
    const result = resolveSources(['minkuru', 'toaran'], prefixMap);
    expect(result).toEqual([
      { prefix: 'minkuru', nameEn: 'Toei Bus' },
      { prefix: 'toaran', nameEn: 'Toei Train' },
    ]);
  });

  it('uses prefix as nameEn fallback for unknown prefixes', () => {
    const result = resolveSources(['unknown'], prefixMap);
    expect(result).toEqual([{ prefix: 'unknown', nameEn: 'unknown' }]);
  });

  it('preserves input order', () => {
    const result = resolveSources(['yurimo', 'minkuru'], prefixMap);
    expect(result.map((s) => s.prefix)).toEqual(['yurimo', 'minkuru']);
  });

  it('returns empty array for empty input', () => {
    expect(resolveSources([], prefixMap)).toEqual([]);
  });

  it('handles mix of known and unknown prefixes', () => {
    const result = resolveSources(['minkuru', 'nope', 'toaran'], prefixMap);
    expect(result).toEqual([
      { prefix: 'minkuru', nameEn: 'Toei Bus' },
      { prefix: 'nope', nameEn: 'nope' },
      { prefix: 'toaran', nameEn: 'Toei Train' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// checkUnvalidatedDirs
// ---------------------------------------------------------------------------

describe('checkUnvalidatedDirs', () => {
  const tmpDir = join(import.meta.dirname, '.tmp-validate-test');

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns empty when all directories are in the targets', () => {
    mkdirSync(join(tmpDir, 'minkuru'));
    mkdirSync(join(tmpDir, 'toaran'));
    const result = checkUnvalidatedDirs(new Set(['minkuru', 'toaran']), tmpDir);
    expect(result.unvalidated).toEqual([]);
  });

  it('detects directories not in the targets', () => {
    mkdirSync(join(tmpDir, 'minkuru'));
    mkdirSync(join(tmpDir, 'tkbus'));
    mkdirSync(join(tmpDir, 'unknown'));
    const result = checkUnvalidatedDirs(new Set(['minkuru']), tmpDir);
    expect(result.unvalidated).toEqual(['tkbus', 'unknown']);
  });

  it('returns empty when data directory does not exist', () => {
    const result = checkUnvalidatedDirs(new Set(['minkuru']), join(tmpDir, 'nonexistent'));
    expect(result.unvalidated).toEqual([]);
  });

  it('returns empty when data directory is empty', () => {
    const result = checkUnvalidatedDirs(new Set(['minkuru']), tmpDir);
    expect(result.unvalidated).toEqual([]);
  });

  it('ignores files (only checks directories)', () => {
    mkdirSync(join(tmpDir, 'minkuru'));
    writeFileSync(join(tmpDir, 'some-file.json'), '{}');
    const result = checkUnvalidatedDirs(new Set(['minkuru']), tmpDir);
    expect(result.unvalidated).toEqual([]);
  });
});
