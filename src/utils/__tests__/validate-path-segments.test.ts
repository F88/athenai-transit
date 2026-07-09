/**
 * Tests for validate-path-segments.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { validatePathSegments } from '../validate-path-segments';

describe('validatePathSegments', () => {
  it('accepts simple directory names', () => {
    expect(validatePathSegments('data-v2', 'TEST')).toBe('data-v2');
    expect(validatePathSegments('next-dev', 'TEST')).toBe('next-dev');
    expect(validatePathSegments('data_v3', 'TEST')).toBe('data_v3');
  });

  it('rejects path traversal', () => {
    expect(() => validatePathSegments('../foo', 'TEST')).toThrow('Invalid TEST');
    expect(() => validatePathSegments('foo/../bar', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects absolute paths', () => {
    expect(() => validatePathSegments('/etc/passwd', 'TEST')).toThrow('Invalid TEST');
  });

  it('accepts nested (slash-separated) paths', () => {
    expect(validatePathSegments('foo/bar', 'TEST')).toBe('foo/bar');
    expect(validatePathSegments('a/data-v3', 'TEST')).toBe('a/data-v3');
  });

  it('rejects empty string', () => {
    expect(() => validatePathSegments('', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects names starting with hyphen', () => {
    expect(() => validatePathSegments('-data', 'TEST')).toThrow('Invalid TEST');
  });

  it('rejects names with uppercase', () => {
    expect(() => validatePathSegments('Data-V2', 'TEST')).toThrow('Invalid TEST');
  });

  it('includes label in error message', () => {
    expect(() => validatePathSegments('../foo', 'MY_VAR')).toThrow('Invalid MY_VAR');
  });
});
