/**
 * Tests for get-source-group-display-name.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { getSourceGroupDisplayName } from '../get-source-group-display-name';
import type { SourceGroup } from '../../../types/app/source-group';

function makeGroup(name: SourceGroup['name']): SourceGroup {
  return {
    id: 'g',
    prefixes: ['p'],
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name,
    countries: ['JP'],
  };
}

describe('getSourceGroupDisplayName', () => {
  it('returns names[lang] when an exact match exists', () => {
    const group = makeGroup({ name: 'Toei Bus', names: { ja: '都バス', en: 'Toei Bus' } });
    expect(getSourceGroupDisplayName(group, 'ja')).toBe('都バス');
    expect(getSourceGroupDisplayName(group, 'en')).toBe('Toei Bus');
  });

  it('walks the lang chain: ja-Hrkt falls back to ja when ja-Hrkt is absent', () => {
    // The kana-mode UI (`ja-Hrkt`) should resolve via the underlying
    // Japanese entry rather than dropping straight to the English
    // canonical label. resolveLangChain('ja-Hrkt') = ['ja-Hrkt', 'ja', 'en'].
    const group = makeGroup({ name: 'Toei Bus', names: { ja: '都バス', en: 'Toei Bus' } });
    expect(getSourceGroupDisplayName(group, 'ja-Hrkt')).toBe('都バス');
  });

  it('walks the lang chain: zh-Hant falls back through zh-Hans → en', () => {
    const group = makeGroup({ name: 'Bus', names: { en: 'Bus', 'zh-Hans': '巴士' } });
    expect(getSourceGroupDisplayName(group, 'zh-Hant')).toBe('巴士');
  });

  it('falls back to en when the chain leads there and en is present', () => {
    const group = makeGroup({ name: 'Bus', names: { en: 'Bus' } });
    expect(getSourceGroupDisplayName(group, 'ko')).toBe('Bus');
    expect(getSourceGroupDisplayName(group, 'de')).toBe('Bus');
  });

  it('falls back to the canonical name when no chain entry matches', () => {
    const group = makeGroup({ name: 'Canonical', names: {} });
    expect(getSourceGroupDisplayName(group, 'fr')).toBe('Canonical');
    expect(getSourceGroupDisplayName(group, 'ja')).toBe('Canonical');
  });

  it('uses ja-Hrkt translation when it is explicitly provided', () => {
    // If a group ever ships an explicit ja-Hrkt entry (e.g., a custom
    // kana label), it should win over the ja fallback.
    const group = makeGroup({
      name: 'Toei Bus',
      names: { ja: '都バス', 'ja-Hrkt': 'とバス', en: 'Toei Bus' },
    });
    expect(getSourceGroupDisplayName(group, 'ja-Hrkt')).toBe('とバス');
  });

  it('returns the canonical name for empty lang (chain falls through)', () => {
    const group = makeGroup({ name: 'Canonical', names: { ja: '日本語' } });
    expect(getSourceGroupDisplayName(group, '')).toBe('Canonical');
  });
});
