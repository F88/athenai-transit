import { describe, expect, it } from 'vitest';
import { createInfoLevel } from '../create-info-level';

describe('createInfoLevel', () => {
  it('returns only isSimpleEnabled for "simple"', () => {
    expect(createInfoLevel('simple')).toEqual({
      isSimpleEnabled: true,
      isNormalEnabled: false,
      isDetailedEnabled: false,
      isVerboseEnabled: false,
    });
  });

  it('returns isSimpleEnabled and isNormalEnabled for "normal"', () => {
    expect(createInfoLevel('normal')).toEqual({
      isSimpleEnabled: true,
      isNormalEnabled: true,
      isDetailedEnabled: false,
      isVerboseEnabled: false,
    });
  });

  it('returns isSimpleEnabled, isNormalEnabled, and isDetailedEnabled for "detailed"', () => {
    expect(createInfoLevel('detailed')).toEqual({
      isSimpleEnabled: true,
      isNormalEnabled: true,
      isDetailedEnabled: true,
      isVerboseEnabled: false,
    });
  });

  it('returns all flags true for "verbose"', () => {
    expect(createInfoLevel('verbose')).toEqual({
      isSimpleEnabled: true,
      isNormalEnabled: true,
      isDetailedEnabled: true,
      isVerboseEnabled: true,
    });
  });
});
