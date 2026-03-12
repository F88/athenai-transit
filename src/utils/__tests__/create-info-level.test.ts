import { describe, expect, it } from 'vitest';
import { createInfoLevel } from '../create-info-level';

describe('createInfoLevel', () => {
  it('returns all flags false for "simple"', () => {
    expect(createInfoLevel('simple')).toEqual({
      isNormalEnabled: false,
      isDetailedEnabled: false,
      isVerboseEnabled: false,
    });
  });

  it('returns only isNormalEnabled for "normal"', () => {
    expect(createInfoLevel('normal')).toEqual({
      isNormalEnabled: true,
      isDetailedEnabled: false,
      isVerboseEnabled: false,
    });
  });

  it('returns isNormalEnabled and isDetailedEnabled for "detailed"', () => {
    expect(createInfoLevel('detailed')).toEqual({
      isNormalEnabled: true,
      isDetailedEnabled: true,
      isVerboseEnabled: false,
    });
  });

  it('returns all flags true for "verbose"', () => {
    expect(createInfoLevel('verbose')).toEqual({
      isNormalEnabled: true,
      isDetailedEnabled: true,
      isVerboseEnabled: true,
    });
  });
});
