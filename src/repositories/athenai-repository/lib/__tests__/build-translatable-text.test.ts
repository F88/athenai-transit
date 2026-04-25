import { describe, expect, it } from 'vitest';

import { buildTranslatableText } from '../build-translatable-text';

describe('buildTranslatableText', () => {
  it('returns the name verbatim and the translations entry for that name', () => {
    const translations = {
      'Oji Station': { en: 'Oji Sta.', ja: '王子駅' },
      Other: { en: 'Other', ja: 'その他' },
    };

    const result = buildTranslatableText('Oji Station', translations);

    expect(result).toEqual({
      name: 'Oji Station',
      names: { en: 'Oji Sta.', ja: '王子駅' },
    });
  });

  it('returns an empty names object when the name has no translation entry', () => {
    const translations = {
      Other: { en: 'Other' },
    };

    const result = buildTranslatableText('Missing', translations);

    expect(result).toEqual({
      name: 'Missing',
      names: {},
    });
  });

  it('returns an empty names object when the translations table is undefined', () => {
    const result = buildTranslatableText('Some name', undefined);

    expect(result).toEqual({
      name: 'Some name',
      names: {},
    });
  });

  it('returns an empty names object when both name and translations are absent', () => {
    // Empty name is still wrapped, mirroring agencies that omit trip_headsign.
    const result = buildTranslatableText('', undefined);

    expect(result).toEqual({
      name: '',
      names: {},
    });
  });

  it('does not mutate the supplied translations table', () => {
    const translations = {
      A: { en: 'A' },
    };
    const snapshot = JSON.parse(JSON.stringify(translations)) as typeof translations;

    buildTranslatableText('A', translations);

    expect(translations).toEqual(snapshot);
  });

  it('returns the translations entry by reference (no defensive copy)', () => {
    // This is observable behaviour worth pinning: callers receive the same
    // object stored in the translations table. Future changes that defensively
    // copy would change the reference identity here.
    const translatedNames = { en: 'A' };
    const translations = { A: translatedNames };

    const result = buildTranslatableText('A', translations);

    expect(result.names).toBe(translatedNames);
  });
});
