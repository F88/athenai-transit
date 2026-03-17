import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseFeedInfoTxt } from '../gtfs-feed-info';

describe('parseFeedInfoTxt', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gtfs-feed-info-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when feed_info.txt does not exist', () => {
    expect(parseFeedInfoTxt(tempDir)).toBeNull();
  });

  it('returns null when feed_info.txt is empty', () => {
    writeFileSync(join(tempDir, 'feed_info.txt'), '', 'utf-8');
    expect(parseFeedInfoTxt(tempDir)).toBeNull();
  });

  it('returns null when feed_info.txt has only headers', () => {
    writeFileSync(
      join(tempDir, 'feed_info.txt'),
      'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version\n',
      'utf-8',
    );
    expect(parseFeedInfoTxt(tempDir)).toBeNull();
  });

  it('parses standard feed_info.txt', () => {
    writeFileSync(
      join(tempDir, 'feed_info.txt'),
      'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version\nTest Agency,https://example.com,ja,20260101,20261231,v1.0\n',
      'utf-8',
    );
    const result = parseFeedInfoTxt(tempDir);
    expect(result).toEqual({
      publisherName: 'Test Agency',
      publisherUrl: 'https://example.com',
      lang: 'ja',
      startDate: '20260101',
      endDate: '20261231',
      version: 'v1.0',
    });
  });

  it('handles CRLF line endings', () => {
    writeFileSync(
      join(tempDir, 'feed_info.txt'),
      'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version\r\nTest,https://test.com,en,20260301,20260930,2.0\r\n',
      'utf-8',
    );
    const result = parseFeedInfoTxt(tempDir);
    expect(result).not.toBeNull();
    expect(result!.publisherName).toBe('Test');
    expect(result!.startDate).toBe('20260301');
  });

  it('handles missing columns gracefully', () => {
    writeFileSync(
      join(tempDir, 'feed_info.txt'),
      'feed_publisher_name,feed_lang\nMinimal,ja\n',
      'utf-8',
    );
    const result = parseFeedInfoTxt(tempDir);
    expect(result).not.toBeNull();
    expect(result!.publisherName).toBe('Minimal');
    expect(result!.startDate).toBe('');
    expect(result!.endDate).toBe('');
    expect(result!.version).toBe('');
  });

  it('handles quoted fields with commas', () => {
    writeFileSync(
      join(tempDir, 'feed_info.txt'),
      'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version\n"Agency, Inc.",https://example.com,ja,20260101,20261231,v1\n',
      'utf-8',
    );
    const result = parseFeedInfoTxt(tempDir);
    expect(result).not.toBeNull();
    expect(result!.publisherName).toBe('Agency, Inc.');
  });
});
