import { describe, it, expect } from 'vitest';
import { SERVICE_DAY_BOUNDARY_HOUR, getServiceDay, getServiceDayMinutes } from '../service-day';

describe('SERVICE_DAY_BOUNDARY_HOUR', () => {
  it('is 3 (03:00)', () => {
    expect(SERVICE_DAY_BOUNDARY_HOUR).toBe(3);
  });
});

describe('getServiceDay', () => {
  it('returns same calendar day at 04:00', () => {
    const now = new Date('2026-03-11T04:00:00');
    const result = getServiceDay(now);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // March = 2
    expect(result.getDate()).toBe(11);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns same calendar day at 03:00 (boundary)', () => {
    const now = new Date('2026-03-11T03:00:00');
    const result = getServiceDay(now);
    expect(result.getDate()).toBe(11);
  });

  it('returns previous calendar day at 02:59', () => {
    const now = new Date('2026-03-11T02:59:00');
    const result = getServiceDay(now);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(0);
  });

  it('returns previous calendar day at 00:00 (midnight)', () => {
    const now = new Date('2026-03-11T00:00:00');
    const result = getServiceDay(now);
    expect(result.getDate()).toBe(10);
  });

  it('returns previous calendar day at 01:30', () => {
    const now = new Date('2026-03-11T01:30:00');
    const result = getServiceDay(now);
    expect(result.getDate()).toBe(10);
  });

  it('handles month boundary (March 1 at 01:00 → Feb 28)', () => {
    const now = new Date('2026-03-01T01:00:00');
    const result = getServiceDay(now);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
  });

  it('returns same day at 14:00 (normal daytime)', () => {
    const now = new Date('2026-03-11T14:00:00');
    const result = getServiceDay(now);
    expect(result.getDate()).toBe(11);
  });

  it('returns same day at 23:59', () => {
    const now = new Date('2026-03-11T23:59:00');
    const result = getServiceDay(now);
    expect(result.getDate()).toBe(11);
  });
});

describe('getServiceDayMinutes', () => {
  it('returns standard minutes at 10:00', () => {
    const now = new Date('2026-03-11T10:00:00');
    expect(getServiceDayMinutes(now)).toBe(600);
  });

  it('returns standard minutes at 03:00 (boundary)', () => {
    const now = new Date('2026-03-11T03:00:00');
    expect(getServiceDayMinutes(now)).toBe(180);
  });

  it('returns overnight minutes at 00:00 (midnight)', () => {
    const now = new Date('2026-03-11T00:00:00');
    // 00:00 → (0 + 24) * 60 = 1440
    expect(getServiceDayMinutes(now)).toBe(1440);
  });

  it('returns overnight minutes at 01:30', () => {
    const now = new Date('2026-03-11T01:30:00');
    // 01:30 → (1 + 24) * 60 + 30 = 1530
    expect(getServiceDayMinutes(now)).toBe(1530);
  });

  it('returns overnight minutes at 02:59', () => {
    const now = new Date('2026-03-11T02:59:00');
    // 02:59 → (2 + 24) * 60 + 59 = 1619
    expect(getServiceDayMinutes(now)).toBe(1619);
  });

  it('returns standard minutes at 23:59', () => {
    const now = new Date('2026-03-11T23:59:00');
    expect(getServiceDayMinutes(now)).toBe(1439);
  });
});
