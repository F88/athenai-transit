/**
 * Tests for build-transit-display-data.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { InfoLevel } from '../../../../types/app/settings';
import { transitDisplayMaxEntriesFor } from '../build-transit-display-data';

describe('transitDisplayMaxEntriesFor', () => {
  it('returns the configured row cap for each info level', () => {
    expect(transitDisplayMaxEntriesFor('simple')).toBe(10);
    expect(transitDisplayMaxEntriesFor('normal')).toBe(10);
    expect(transitDisplayMaxEntriesFor('detailed')).toBe(20);
    expect(transitDisplayMaxEntriesFor('verbose')).toBe(20);
  });

  it('returns a positive cap for every info level', () => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    for (const level of levels) {
      expect(transitDisplayMaxEntriesFor(level)).toBeGreaterThan(0);
    }
  });
});
