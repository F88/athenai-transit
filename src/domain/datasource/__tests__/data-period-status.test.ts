import { describe, expect, it } from 'vitest';
import { getDataPeriodStatus } from '../data-period-status';

describe('getDataPeriodStatus', () => {
  it('returns indeterminate when operatingDates is null', () => {
    expect(getDataPeriodStatus(null, '20260601')).toBe('indeterminate');
  });

  it('returns indeterminate when both bounds are null', () => {
    expect(getDataPeriodStatus({ first: null, last: null }, '20260601')).toBe('indeterminate');
  });

  it('returns indeterminate when the reference date key is empty', () => {
    expect(getDataPeriodStatus({ first: '20260101', last: '20261231' }, '')).toBe('indeterminate');
  });

  it('returns inPeriod when the reference date is within the span', () => {
    expect(getDataPeriodStatus({ first: '20260101', last: '20261231' }, '20260601')).toBe(
      'inPeriod',
    );
  });

  it('treats the first day as inPeriod (inclusive lower bound)', () => {
    expect(getDataPeriodStatus({ first: '20260101', last: '20261231' }, '20260101')).toBe(
      'inPeriod',
    );
  });

  it('treats the last day as inPeriod (inclusive upper bound)', () => {
    expect(getDataPeriodStatus({ first: '20260101', last: '20261231' }, '20261231')).toBe(
      'inPeriod',
    );
  });

  it('returns expired when the reference date is after the last day', () => {
    expect(getDataPeriodStatus({ first: '20260101', last: '20261231' }, '20270101')).toBe(
      'expired',
    );
  });

  it('returns beforePeriod when the reference date is before the first day', () => {
    expect(getDataPeriodStatus({ first: '20260101', last: '20261231' }, '20251231')).toBe(
      'beforePeriod',
    );
  });

  it('evaluates expiry when only the last bound is known', () => {
    expect(getDataPeriodStatus({ first: null, last: '20261231' }, '20270101')).toBe('expired');
    expect(getDataPeriodStatus({ first: null, last: '20261231' }, '20260601')).toBe('inPeriod');
  });

  it('evaluates the lower bound when only the first bound is known', () => {
    expect(getDataPeriodStatus({ first: '20260101', last: null }, '20251231')).toBe('beforePeriod');
    expect(getDataPeriodStatus({ first: '20260101', last: null }, '20260601')).toBe('inPeriod');
  });
});
