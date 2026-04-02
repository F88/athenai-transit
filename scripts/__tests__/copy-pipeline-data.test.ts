/**
 * Tests for copy-pipeline-data.ts resolveDestDir.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { resolveDestDir } from '../copy-pipeline-data';

describe('resolveDestDir', () => {
  it('defaults to public/data-v2 when env is not set', () => {
    expect(resolveDestDir({})).toBe('public/data-v2');
  });

  it('defaults to public/data-v2 when PIPELINE_TRANSIT_DATA_DIR is undefined', () => {
    expect(resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: undefined })).toBe('public/data-v2');
  });

  it('uses PIPELINE_TRANSIT_DATA_DIR when set', () => {
    expect(resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: 'data-v3' })).toBe('public/data-v3');
  });

  it('always prefixes with public/', () => {
    expect(resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: 'custom-data' })).toBe('public/custom-data');
  });

  it('throws on path traversal attempt', () => {
    expect(() => resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: '../foo' })).toThrow(
      'Invalid PIPELINE_TRANSIT_DATA_DIR',
    );
  });
});
