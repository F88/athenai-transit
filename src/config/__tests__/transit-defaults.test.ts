import { describe, expect, it } from 'vitest';
import type { Agency } from '../../types/app/transit';
import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '../transit-defaults';

const agency: Agency = {
  agency_id: 'a1',
  agency_name: 'Test Agency',
  agency_short_name: 'TA',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [],
};

describe('resolveAgencyLang', () => {
  it('returns agency_lang when agency is found', () => {
    expect(resolveAgencyLang([agency], 'a1')).toEqual(['ja']);
  });

  it('returns DEFAULT_AGENCY_LANG when agency is not found', () => {
    expect(resolveAgencyLang([agency], 'unknown')).toEqual(DEFAULT_AGENCY_LANG);
  });

  it('returns DEFAULT_AGENCY_LANG when agencies list is empty', () => {
    expect(resolveAgencyLang([], 'a1')).toEqual(DEFAULT_AGENCY_LANG);
  });

  it('returns agency_lang for matching agency among multiple', () => {
    const enAgency = { ...agency, agency_id: 'a2', agency_lang: 'en' };
    expect(resolveAgencyLang([agency, enAgency], 'a2')).toEqual(['en']);
  });
});
