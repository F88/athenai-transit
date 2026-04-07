import { describe, expect, it } from 'vitest';
import { getStopDisplayNames } from '../get-stop-display-names';
import type { Stop } from '../../../types/app/transit';

/** Minimal Stop fixture with multiple translations. */
function makeStop(overrides?: Partial<Stop>): Stop {
  return {
    stop_id: 'S001',
    stop_name: '曙橋',
    stop_names: { ja: '曙橋', 'ja-Hrkt': 'あけぼのばし', en: 'Akebonobashi' },
    stop_lat: 35.69,
    stop_lon: 139.72,
    location_type: 0,
    agency_id: '',
    ...overrides,
  };
}

describe('getStopDisplayNames', () => {
  // --- default resolution ---

  it('returns resolved name and subNames when lang is omitted', () => {
    const result = getStopDisplayNames(makeStop());
    expect(result.name).toBe('曙橋');
    expect(result.subNames).toHaveLength(2);
    expect(result.subNames).toContain('あけぼのばし');
    expect(result.subNames).toContain('Akebonobashi');
  });

  // --- single lang ---

  it('resolves name to English when lang is en', () => {
    const result = getStopDisplayNames(makeStop(), 'en');
    expect(result.name).toBe('Akebonobashi');
    expect(result.subNames).toHaveLength(2);
    expect(result.subNames).toContain('曙橋');
    expect(result.subNames).toContain('あけぼのばし');
  });

  it('falls back to stop_name when lang does not exist', () => {
    const result = getStopDisplayNames(makeStop(), 'ko');
    expect(result.name).toBe('曙橋');
    // ja has same value as resolved (曙橋) → excluded by value dedup
    expect(result.subNames).toHaveLength(2);
    expect(result.subNames).toContain('あけぼのばし');
    expect(result.subNames).toContain('Akebonobashi');
  });

  // --- fallback chain ---

  it('resolves name via chain and keeps all other translations in subNames', () => {
    const result = getStopDisplayNames(makeStop(), ['ja-Hrkt', 'ja', 'en']);
    expect(result.name).toBe('あけぼのばし');
    // ja ('曙橋') and en ('Akebonobashi') are in chain but NOT resolved,
    // so they must appear in subNames.
    expect(result.subNames).toHaveLength(2);
    expect(result.subNames).toContain('曙橋');
    expect(result.subNames).toContain('Akebonobashi');
  });

  it('chain with en first resolves to English, keeps others', () => {
    const result = getStopDisplayNames(makeStop(), ['en', 'ja']);
    expect(result.name).toBe('Akebonobashi');
    expect(result.subNames).toHaveLength(2);
    expect(result.subNames).toContain('曙橋');
    expect(result.subNames).toContain('あけぼのばし');
  });

  it('chain with multilingual data keeps all non-resolved translations', () => {
    const stop = makeStop({
      stop_names: {
        ja: '曙橋',
        'ja-Hrkt': 'あけぼのばし',
        en: 'Akebonobashi',
        ko: '아케보노바시',
        'zh-Hans': '曙桥',
      },
    });
    const result = getStopDisplayNames(stop, ['ja-Hrkt', 'ja', 'en']);
    expect(result.name).toBe('あけぼのばし');
    // 4 unique values: 曙橋, Akebonobashi, 아케보노바시, 曙桥
    // (ja and origin have same value '曙橋' → deduplicated)
    expect(result.subNames).toHaveLength(4);
    expect(result.subNames).toContain('曙橋');
    expect(result.subNames).toContain('Akebonobashi');
    expect(result.subNames).toContain('아케보노바시');
    expect(result.subNames).toContain('曙桥');
  });

  // --- agencyLang sort priority ---

  it('sorts subNames by agencyLang priority', () => {
    const stop = makeStop({
      stop_names: {
        ja: '曙橋',
        'ja-Hrkt': 'あけぼのばし',
        en: 'Akebonobashi',
        ko: '아케보노바시',
      },
    });
    // agencyLang=['en'] → en-prefixed keys first, then others
    const result = getStopDisplayNames(stop, ['ja-Hrkt'], ['en']);
    expect(result.name).toBe('あけぼのばし');
    expect(result.subNames[0]).toBe('Akebonobashi');
  });

  // --- edge cases ---

  it('returns empty subNames when all stop_names match stop_name', () => {
    const stop = makeStop({
      stop_names: { ja: '曙橋', 'ja-Hrkt': '曙橋' },
    });
    const result = getStopDisplayNames(stop);
    expect(result.name).toBe('曙橋');
    expect(result.subNames).toEqual([]);
  });

  it('returns empty subNames when stop_names is empty', () => {
    const stop = makeStop({ stop_names: {} });
    const result = getStopDisplayNames(stop);
    expect(result.name).toBe('曙橋');
    expect(result.subNames).toEqual([]);
  });

  it('does not mutate the input stop object', () => {
    const stop = makeStop();
    const original = JSON.parse(JSON.stringify(stop)) as Stop;
    getStopDisplayNames(stop, 'en');
    expect(stop).toEqual(original);
  });
});
