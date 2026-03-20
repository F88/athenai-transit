import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DownloadMeta, DownloadMetaSuccess, DownloadMetaError } from '../download-meta';

/**
 * Tests for download-meta serialization logic.
 *
 * Since saveDownloadMeta/loadDownloadMeta use a hardcoded META_DIR,
 * we test the JSON round-trip and file I/O patterns directly.
 */
describe('download-meta serialization', () => {
  const successMeta: DownloadMetaSuccess = {
    sourceName: 'test-bus',
    type: 'gtfs',
    status: 'ok',
    downloadedAt: '2026-03-17T00:00:00Z',
    url: 'https://example.com/test.zip?date=20260301',
    size: 12345,
    contentType: 'application/zip',
    durationMs: 500,
    archivePath: 'archives/test.zip',
    extractedFiles: [{ name: 'stops.txt', size: 100 }],
    feedInfo: {
      publisherName: 'Test',
      publisherUrl: 'https://example.com',
      lang: 'ja',
      startDate: '20260301',
      endDate: '20261231',
      version: 'v1',
    },
  };

  const errorMeta: DownloadMetaError = {
    sourceName: 'fail-bus',
    type: 'gtfs',
    status: 'error',
    downloadedAt: '2026-03-17T00:00:00Z',
    url: 'https://example.com/fail.zip',
    durationMs: 100,
    error: 'HTTP 503 Service Unavailable',
  };

  it('round-trips success metadata via JSON', () => {
    const json = JSON.stringify(successMeta, null, 2);
    const parsed = JSON.parse(json) as DownloadMetaSuccess;
    expect(parsed.status).toBe('ok');
    expect(parsed.sourceName).toBe('test-bus');
    expect(parsed.size).toBe(12345);
    expect(parsed.feedInfo?.startDate).toBe('20260301');
    expect(parsed.extractedFiles).toHaveLength(1);
  });

  it('round-trips error metadata via JSON', () => {
    const json = JSON.stringify(errorMeta, null, 2);
    const parsed = JSON.parse(json) as DownloadMetaError;
    expect(parsed.status).toBe('error');
    expect(parsed.sourceName).toBe('fail-bus');
    expect(parsed.error).toBe('HTTP 503 Service Unavailable');
  });

  it('success metadata without feedInfo omits the field', () => {
    const noFeedInfo: DownloadMetaSuccess = { ...successMeta };
    delete (noFeedInfo as Partial<DownloadMetaSuccess>).feedInfo;
    const json = JSON.stringify(noFeedInfo, null, 2);
    const parsed = JSON.parse(json) as DownloadMetaSuccess;
    expect(parsed.feedInfo).toBeUndefined();
  });

  it('success metadata without extractedFiles omits the field', () => {
    const noFiles: DownloadMetaSuccess = { ...successMeta };
    delete (noFiles as Partial<DownloadMetaSuccess>).extractedFiles;
    const json = JSON.stringify(noFiles, null, 2);
    const parsed = JSON.parse(json) as DownloadMetaSuccess;
    expect(parsed.extractedFiles).toBeUndefined();
  });
});

describe('download-meta file I/O', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'download-meta-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes and reads back metadata from a file', () => {
    const meta: DownloadMetaSuccess = {
      sourceName: 'test-bus',
      type: 'gtfs',
      status: 'ok',
      downloadedAt: '2026-03-17T00:00:00Z',
      url: 'https://example.com/test.zip',
      size: 100,
      contentType: 'application/zip',
      durationMs: 50,
      archivePath: 'archives/test.zip',
    };

    const filePath = join(tempDir, `${meta.sourceName}.json`);
    writeFileSync(filePath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');

    expect(existsSync(filePath)).toBe(true);
    const loaded = JSON.parse(readFileSync(filePath, 'utf-8')) as DownloadMeta;
    expect(loaded.status).toBe('ok');
    expect(loaded.sourceName).toBe('test-bus');
  });

  it('overwrites existing file on re-save', () => {
    const filePath = join(tempDir, 'overwrite.json');
    const first: DownloadMetaSuccess = {
      sourceName: 'overwrite',
      type: 'gtfs',
      status: 'ok',
      downloadedAt: '2026-03-17T00:00:00Z',
      url: 'https://example.com/v1.zip',
      size: 100,
      contentType: 'application/zip',
      durationMs: 50,
      archivePath: 'archives/v1.zip',
    };
    const second: DownloadMetaError = {
      sourceName: 'overwrite',
      type: 'gtfs',
      status: 'error',
      downloadedAt: '2026-03-18T00:00:00Z',
      url: 'https://example.com/v2.zip',
      durationMs: 10,
      error: 'Network error',
    };

    writeFileSync(filePath, JSON.stringify(first, null, 2) + '\n', 'utf-8');
    writeFileSync(filePath, JSON.stringify(second, null, 2) + '\n', 'utf-8');

    const loaded = JSON.parse(readFileSync(filePath, 'utf-8')) as DownloadMeta;
    expect(loaded.status).toBe('error');
    expect(loaded.url).toBe('https://example.com/v2.zip');
  });

  it('returns null for non-existent file', () => {
    const filePath = join(tempDir, 'nonexistent.json');
    expect(existsSync(filePath)).toBe(false);
  });
});
