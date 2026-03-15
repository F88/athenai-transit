import { describe, expect, it } from 'vitest';
import { getStopDisplayNames } from '../get-stop-display-names';
import type { Stop } from '../../../types/app/transit';
import type { InfoLevel } from '../../../types/app/settings';

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
  // --- infoLevel filtering ---

  it('returns empty subNames at simple level', () => {
    const result = getStopDisplayNames(makeStop(), 'simple');
    expect(result.name).toBe('曙橋');
    expect(result.subNames).toEqual([]);
  });

  it('returns subNames at normal level', () => {
    const result = getStopDisplayNames(makeStop(), 'normal');
    expect(result.name).toBe('曙橋');
    expect(result.subNames).toContain('あけぼのばし');
    expect(result.subNames).toContain('Akebonobashi');
    // ja: '曙橋' matches stop_name, so excluded
    expect(result.subNames).not.toContain('曙橋');
  });

  it('returns subNames at detailed level', () => {
    const result = getStopDisplayNames(makeStop(), 'detailed');
    expect(result.subNames).toContain('あけぼのばし');
    expect(result.subNames).toContain('Akebonobashi');
  });

  it('returns subNames at verbose level', () => {
    const result = getStopDisplayNames(makeStop(), 'verbose');
    expect(result.subNames).toContain('あけぼのばし');
    expect(result.subNames).toContain('Akebonobashi');
  });

  it.each<InfoLevel>(['simple', 'normal', 'detailed', 'verbose'])(
    'always returns stop_name as name at %s level (no lang)',
    (level) => {
      expect(getStopDisplayNames(makeStop(), level).name).toBe('曙橋');
    },
  );

  // --- lang parameter ---

  it('resolves name to English when lang is en', () => {
    const result = getStopDisplayNames(makeStop(), 'normal', 'en');
    expect(result.name).toBe('Akebonobashi');
  });

  it('keeps stop_name as subName when lang differs from stop_name', () => {
    const result = getStopDisplayNames(makeStop(), 'normal', 'en');
    // name is 'Akebonobashi', so '曙橋' and 'あけぼのばし' should be subNames
    expect(result.subNames).toContain('曙橋');
    expect(result.subNames).toContain('あけぼのばし');
    expect(result.subNames).not.toContain('Akebonobashi');
  });

  it('returns empty subNames when lang specified but infoLevel is simple', () => {
    const result = getStopDisplayNames(makeStop(), 'simple', 'en');
    expect(result.name).toBe('Akebonobashi');
    expect(result.subNames).toEqual([]);
  });

  it('falls back to stop_name when lang does not exist', () => {
    const result = getStopDisplayNames(makeStop(), 'normal', 'ko');
    expect(result.name).toBe('曙橋');
  });

  // --- edge cases ---

  it('returns empty subNames when all stop_names match stop_name', () => {
    const stop = makeStop({
      stop_names: { ja: '曙橋', 'ja-Hrkt': '曙橋' },
    });
    const result = getStopDisplayNames(stop, 'normal');
    expect(result.name).toBe('曙橋');
    expect(result.subNames).toEqual([]);
  });

  it('returns empty subNames when stop_names is empty', () => {
    const stop = makeStop({ stop_names: {} });
    const result = getStopDisplayNames(stop, 'normal');
    expect(result.name).toBe('曙橋');
    expect(result.subNames).toEqual([]);
  });

  it('does not mutate the input stop object', () => {
    const stop = makeStop();
    const original = JSON.parse(JSON.stringify(stop)) as Stop;
    getStopDisplayNames(stop, 'normal', 'en');
    expect(stop).toEqual(original);
  });
});
