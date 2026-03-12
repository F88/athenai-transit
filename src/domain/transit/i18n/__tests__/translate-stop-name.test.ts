import { describe, expect, it } from 'vitest';
import { translateStopName } from '../translate-stop-name';
import type { Stop } from '../../../../types/app/transit';

/** Minimal Stop fixture for name resolution tests. */
function makeStop(overrides?: Partial<Stop>): Stop {
  return {
    stop_id: 'S001',
    stop_name: '曙橋',
    stop_names: { ja: '曙橋', 'ja-Hrkt': 'あけぼのばし', en: 'Akebonobashi' },
    stop_lat: 35.69,
    stop_lon: 139.72,
    location_type: 0,
    ...overrides,
  };
}

describe('translateStopName', () => {
  it('returns stop_name when lang is omitted', () => {
    expect(translateStopName(makeStop())).toBe('曙橋');
  });

  it('returns stop_name when lang is undefined', () => {
    expect(translateStopName(makeStop(), undefined)).toBe('曙橋');
  });

  it('returns translated name when lang exists in stop_names', () => {
    expect(translateStopName(makeStop(), 'en')).toBe('Akebonobashi');
  });

  it('returns ja-Hrkt reading when lang is ja-Hrkt', () => {
    expect(translateStopName(makeStop(), 'ja-Hrkt')).toBe('あけぼのばし');
  });

  it('falls back to stop_name when lang does not exist', () => {
    expect(translateStopName(makeStop(), 'ko')).toBe('曙橋');
  });

  it('falls back to stop_name when stop_names entry is empty string', () => {
    const stop = makeStop({
      stop_names: { ja: '曙橋', en: '' },
    });
    expect(translateStopName(stop, 'en')).toBe('曙橋');
  });

  it('falls back to stop_name when stop_names is empty object', () => {
    const stop = makeStop({ stop_names: {} });
    expect(translateStopName(stop, 'en')).toBe('曙橋');
  });
});
