import { describe, expect, it } from 'vitest';
import settings from '../data-source-settings';

describe('data-source-settings', () => {
  it('has unique ids across all groups', () => {
    const ids = settings.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique prefixes within each group (cross-group overlap is allowed by design)', () => {
    // SourceGroup intentionally permits the same prefix to appear in
    // multiple groups (e.g., a `toko` bundle group whose `prefixes`
    // overlaps with both `toei-bus` and `toei-train`). Only within a
    // single group's `prefixes` array must values be unique.
    for (const group of settings) {
      expect(new Set(group.prefixes).size).toBe(group.prefixes.length);
    }
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
