import { describe, expect, it } from 'vitest';
import { hasUnknownDestination } from '../has-unknown-destination';

describe('hasUnknownDestination', () => {
  it('returns false for empty array', () => {
    expect(hasUnknownDestination([])).toBe(false);
  });

  it('returns false when all groups have headsign', () => {
    expect(hasUnknownDestination([{ headsign: '新宿駅西口' }, { headsign: '渋谷駅' }])).toBe(false);
  });

  it('returns true when a group has empty headsign', () => {
    expect(hasUnknownDestination([{ headsign: '' }])).toBe(true);
  });

  it('returns true when empty headsign is mixed with normal headsigns', () => {
    expect(
      hasUnknownDestination([
        { headsign: 'にじ橋' },
        { headsign: '' },
        { headsign: 'あおば中央駅' },
      ]),
    ).toBe(true);
  });
});
