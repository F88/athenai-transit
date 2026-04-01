import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Warning } from '../../src/lib/pipeline/odpt-resource-warnings';
import { RemoteResource } from './lib/odpt-resources';

const { ensureDirMock, existsSyncMock, readdirSyncMock, readFileSyncMock, writeFileSyncMock } =
  vi.hoisted(() => ({
    ensureDirMock: vi.fn(),
    existsSyncMock: vi.fn(),
    readdirSyncMock: vi.fn(() => []),
    readFileSyncMock: vi.fn(),
    writeFileSyncMock: vi.fn(),
  }));

vi.mock('../../src/lib/fs-utils', () => ({
  ensureDir: ensureDirMock,
}));

vi.mock(import('node:fs'), () => {
  return {
    default: {
      existsSync: existsSyncMock,
      readdirSync: readdirSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: writeFileSyncMock,
    },
    existsSync: existsSyncMock,
    readdirSync: readdirSyncMock,
    readFileSync: readFileSyncMock,
    writeFileSync: writeFileSyncMock,
  };
});

import { extractDateParam, loadSnapshot, parseArgs, saveSnapshot } from './check-odpt-resources';

const BASE_URL = 'https://api.odpt.org/api/v4/files/odpt/TestBus/AllLines.zip';

describe('saveSnapshot', () => {
  beforeEach(() => {
    ensureDirMock.mockReset();
    existsSyncMock.mockReset();
    readdirSyncMock.mockReset();
    readdirSyncMock.mockReturnValue([]);
    readFileSyncMock.mockReset();
    writeFileSyncMock.mockReset();
  });

  it('serializes sanitized resourceUrls without leaking credentials', () => {
    const resources = [
      new RemoteResource(
        {
          url: `${BASE_URL}?date=20260401&access_token=SECRET1`,
          from: '2026-04-01',
          to: '2026-12-31',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-01T00:00:00Z',
        },
        null,
        null,
      ),
      new RemoteResource(
        {
          url: 'not-a-valid-url?api_key=SECRET2',
          from: '2026-04-02',
          to: '2026-12-31',
          startAt: '2026-04-02',
          uploadedAt: '2026-03-01T00:00:00Z',
        },
        null,
        null,
      ),
    ];
    const warnings: Warning[] = [
      { type: 'REMOTE_KNOWN_IN_PERIOD', message: 'known' },
      { type: 'ADOPTED_MISSING', message: 'critical' },
    ];

    saveSnapshot('test-source', resources, warnings);

    expect(ensureDirMock).toHaveBeenCalledTimes(1);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);

    const [filePath, content, encoding] = writeFileSyncMock.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(filePath).toContain('check-result/test-source.json');
    expect(encoding).toBe('utf-8');
    expect(content).not.toContain('SECRET1');
    expect(content).not.toContain('SECRET2');
    expect(content).not.toContain('access_token');
    expect(content).not.toContain('api_key');

    const snapshot = JSON.parse(content) as {
      sourceName: string;
      result: string;
      warnings: string[];
      errors: string[];
      resourceUrls: string[];
    };

    expect(snapshot.sourceName).toBe('test-source');
    expect(snapshot.result).toBe('critical');
    expect(snapshot.warnings).toEqual(['REMOTE_KNOWN_IN_PERIOD']);
    expect(snapshot.errors).toEqual(['ADOPTED_MISSING']);
    expect(snapshot.resourceUrls).toEqual([
      '[malformed-url-redacted]',
      'https://api.odpt.org/api/v4/files/odpt/TestBus/AllLines.zip?date=20260401',
    ]);
  });
});

describe('extractDateParam', () => {
  it('returns date from sanitized URL', () => {
    expect(extractDateParam(`${BASE_URL}?date=20260401&access_token=SECRET`)).toBe('20260401');
  });

  it('returns null for malformed URLs after redaction', () => {
    expect(extractDateParam('not-a-valid-url?date=20260401&api_key=SECRET')).toBeNull();
  });

  it('returns null when date param is absent', () => {
    expect(extractDateParam(`${BASE_URL}?format=json`)).toBeNull();
  });
});

describe('loadSnapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when snapshot file does not exist', () => {
    existsSyncMock.mockReturnValue(false);

    expect(loadSnapshot('missing-source')).toBeNull();
  });

  it('returns parsed snapshot when file exists', () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        sourceName: 'test-source',
        checkedAt: '2026-04-02T00:00:00Z',
        resourceUrls: ['https://example.com/file.zip?date=20260401'],
        result: 'ok',
        warnings: [],
        errors: [],
      }),
    );

    expect(loadSnapshot('test-source')).toEqual({
      sourceName: 'test-source',
      checkedAt: '2026-04-02T00:00:00Z',
      resourceUrls: ['https://example.com/file.zip?date=20260401'],
      result: 'ok',
      warnings: [],
      errors: [],
    });
  });

  it('returns null and warns when snapshot JSON is invalid', () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue('{broken-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(loadSnapshot('broken-source')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[loadSnapshot] Failed to parse broken-source.json, skipping diff detection',
    );
  });
});

describe('parseArgs', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('returns single mode for positional source name', () => {
    process.argv = ['node', 'script', 'kanto-bus'];

    expect(parseArgs()).toEqual({ mode: 'single', sourceName: 'kanto-bus', isTsv: false });
  });

  it('returns all-odpt mode with TSV output', () => {
    process.argv = ['node', 'script', '--all', '--format', 'tsv'];

    expect(parseArgs()).toEqual({ mode: 'all-odpt', isTsv: true });
  });

  it('returns list mode regardless of format flag', () => {
    process.argv = ['node', 'script', '--list', '--format', 'tsv'];

    expect(parseArgs()).toEqual({ mode: 'list', isTsv: false });
  });

  it('exits on unknown format', () => {
    process.argv = ['node', 'script', '--format', 'json'];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);

    expect(() => parseArgs()).toThrow('exit:1');
    expect(errorSpy).toHaveBeenCalledWith('Unknown format: json');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
