/**
 * Tests for sanitize-dir-name.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { sanitizeDirName } from '../sanitize-dir-name';

describe('sanitizeDirName', () => {
  it('accepts simple directory names', () => {
    expect(sanitizeDirName('data-v2', 'TEST')).toBe('data-v2');
    expect(sanitizeDirName('next-dev', 'TEST')).toBe('next-dev');
    expect(sanitizeDirName('data_v3', 'TEST')).toBe('data_v3');
  });

  it('rejects path traversal', () => {
    expect(() => sanitizeDirName('../foo', 'TEST')).toThrow('Invalid TEST');
    expect(() => sanitizeDirName('foo/../bar', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects absolute paths', () => {
    expect(() => sanitizeDirName('/etc/passwd', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects paths with slashes', () => {
    expect(() => sanitizeDirName('foo/bar', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects empty string', () => {
    expect(() => sanitizeDirName('', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects names starting with hyphen', () => {
    expect(() => sanitizeDirName('-data', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects names with uppercase', () => {
    expect(() => sanitizeDirName('Data-V2', 'TEST')).toThrow('Invalid TEST');
  });

  it('includes label in error message', () => {
    expect(() => sanitizeDirName('../foo', 'MY_VAR')).toThrow('Invalid MY_VAR');
  });
});
