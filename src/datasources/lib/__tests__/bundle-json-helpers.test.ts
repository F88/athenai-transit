import { describe, expect, it, vi } from 'vitest';

import { parseBundleJson } from '../parse-bundle-json';
import { validateBundleEnvelope } from '../validate-bundle-envelope';

describe('parseBundleJson', () => {
  it('returns parsed JSON and parse duration', () => {
    const performanceNowSpy = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(14);

    try {
      expect(parseBundleJson('{"kind":"data","bundle_version":3}')).toEqual({
        json: { kind: 'data', bundle_version: 3 },
        parseMs: 4,
      });
    } finally {
      performanceNowSpy.mockRestore();
    }
  });

  it('throws the JSON.parse error for invalid JSON', () => {
    expect(() => parseBundleJson('{"broken json')).toThrow();
  });
});

describe('validateBundleEnvelope', () => {
  it('accepts a valid bundle envelope', () => {
    expect(() =>
      validateBundleEnvelope({ bundle_version: 3, kind: 'data' }, 'data', 'tobus/data.json'),
    ).not.toThrow();
  });

  it('throws for a null payload', () => {
    expect(() => validateBundleEnvelope(null, 'data', 'tobus/data.json')).toThrow(
      'expected JSON object, got null',
    );
  });

  it('throws for an invalid bundle version', () => {
    expect(() =>
      validateBundleEnvelope({ bundle_version: 2, kind: 'data' }, 'data', 'tobus/data.json'),
    ).toThrow('invalid bundle_version');
  });

  it('throws for an invalid bundle kind', () => {
    expect(() =>
      validateBundleEnvelope({ bundle_version: 3, kind: 'shapes' }, 'data', 'tobus/data.json'),
    ).toThrow('invalid bundle kind');
  });
});
