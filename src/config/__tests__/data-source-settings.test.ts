import { describe, expect, it } from 'vitest';
import settings from '../data-source-settings';

describe('data-source-settings', () => {
  it('has unique ids across all groups', () => {
    const ids = settings.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique prefixes across all groups', () => {
    const prefixes = settings.flatMap((g) => g.prefixes);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('every group has at least one country code', () => {
    for (const group of settings) {
      expect(group.countries.length).toBeGreaterThan(0);
    }
  });

  it('every country code is uppercase ISO 3166-1 alpha-2', () => {
    for (const group of settings) {
      for (const code of group.countries) {
        expect(code).toMatch(/^[A-Z]{2}$/);
      }
    }
  });
});
