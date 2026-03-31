import { describe, it, expect } from 'vitest';
import { selectServiceGroup } from '../select-service-group';
import type { ServiceGroupEntry } from '../../../types/data/transit-v2-json';

// Typical minkuru service groups: weekday, saturday, sunday
const groups: ServiceGroupEntry[] = [
  { key: 'wd', serviceIds: ['svc-wd-1', 'svc-wd-2', 'svc-wd-3'] },
  { key: 'sa', serviceIds: ['svc-sa-1', 'svc-sa-2'] },
  { key: 'su', serviceIds: ['svc-su-1', 'svc-su-2'] },
];

describe('selectServiceGroup', () => {
  it('selects weekday group when weekday services are active', () => {
    const active = new Set(['svc-wd-1', 'svc-wd-2', 'svc-wd-3']);
    expect(selectServiceGroup(groups, active)).toBe('wd');
  });

  it('selects saturday group when saturday services are active', () => {
    const active = new Set(['svc-sa-1', 'svc-sa-2']);
    expect(selectServiceGroup(groups, active)).toBe('sa');
  });

  it('selects sunday group when sunday services are active', () => {
    const active = new Set(['svc-su-1', 'svc-su-2']);
    expect(selectServiceGroup(groups, active)).toBe('su');
  });

  it('selects group with most overlap when multiple groups match', () => {
    // Active IDs overlap with wd (2 matches) and sa (1 match)
    const active = new Set(['svc-wd-1', 'svc-wd-2', 'svc-sa-1']);
    expect(selectServiceGroup(groups, active)).toBe('wd');
  });

  it('selects earlier group on tie (array order tie-break)', () => {
    // Both wd and sa have 1 overlap, wd is first
    const active = new Set(['svc-wd-1', 'svc-sa-1']);
    expect(selectServiceGroup(groups, active)).toBe('wd');
  });

  it('returns undefined when no group has overlap', () => {
    const active = new Set(['unknown-svc']);
    expect(selectServiceGroup(groups, active)).toBeUndefined();
  });

  it('returns undefined when active set is empty', () => {
    const active = new Set<string>();
    expect(selectServiceGroup(groups, active)).toBeUndefined();
  });

  it('returns undefined when service groups array is empty', () => {
    const active = new Set(['svc-wd-1']);
    expect(selectServiceGroup([], active)).toBeUndefined();
  });

  it('handles single group correctly', () => {
    const singleGroup: ServiceGroupEntry[] = [{ key: 'all', serviceIds: ['svc-1', 'svc-2'] }];
    const active = new Set(['svc-1']);
    expect(selectServiceGroup(singleGroup, active)).toBe('all');
  });

  it('handles partial overlap correctly', () => {
    // su has 2/2 overlap, wd has 1/3 overlap — su wins
    const active = new Set(['svc-su-1', 'svc-su-2', 'svc-wd-1']);
    expect(selectServiceGroup(groups, active)).toBe('su');
  });

  // Issue #87: data[0] fixed selection gives wrong results on weekends
  it('does NOT always select first group (issue #87 regression)', () => {
    // On Sunday, only sunday services are active
    const active = new Set(['svc-su-1', 'svc-su-2']);
    const result = selectServiceGroup(groups, active);
    // Must select 'su', not 'wd' (data[0])
    expect(result).toBe('su');
    expect(result).not.toBe('wd');
  });
});
