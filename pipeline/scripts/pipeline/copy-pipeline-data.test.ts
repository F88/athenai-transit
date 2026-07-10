/**
 * Tests for copy-pipeline-data.ts resolveDestDir.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { resolveDestDir, TRANSIT_DATA_DELIVERY_BASE_DIR } from '../copy-pipeline-data';

const BASE = TRANSIT_DATA_DELIVERY_BASE_DIR;

describe('resolveDestDir', () => {
  it('defaults to <base>/data-v2 when env is not set', () => {
    expect(resolveDestDir({})).toBe(`${BASE}/data-v2`);
  });

  it('defaults to <base>/data-v2 when PIPELINE_TRANSIT_DATA_DIR is undefined', () => {
    expect(resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: undefined })).toBe(`${BASE}/data-v2`);
  });

  it('uses PIPELINE_TRANSIT_DATA_DIR when set', () => {
    expect(resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: 'data-v3' })).toBe(`${BASE}/data-v3`);
  });

  it('always prefixes with the delivery base dir', () => {
    expect(resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: 'custom-data' })).toBe(
      `${BASE}/custom-data`,
    );
  });

  it('throws on path traversal attempt', () => {
    expect(() => resolveDestDir({ PIPELINE_TRANSIT_DATA_DIR: '../foo' })).toThrow(
      'Invalid PIPELINE_TRANSIT_DATA_DIR',
    );
  });
});
