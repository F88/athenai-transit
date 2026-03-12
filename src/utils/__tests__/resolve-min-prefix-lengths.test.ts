import { describe, expect, it } from 'vitest';
import { resolveMinPrefixLengths } from '../resolve-min-prefix-lengths';

/** Helper to convert Map to a plain object for easier assertions. */
function toObj(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(map);
}

describe('resolveMinPrefixLengths', () => {
  // --- empty / single ---

  it('returns empty map for empty input', () => {
    expect(toObj(resolveMinPrefixLengths([]))).toEqual({});
  });

  it('returns minLength for a single unique string', () => {
    expect(toObj(resolveMinPrefixLengths(['abc']))).toEqual({ abc: 1 });
  });

  it('returns custom minLength for a single unique string', () => {
    expect(toObj(resolveMinPrefixLengths(['abc'], 2))).toEqual({ abc: 2 });
  });

  it('caps minLength to string length for a single short string', () => {
    expect(toObj(resolveMinPrefixLengths(['a'], 3))).toEqual({ a: 1 });
  });

  // --- duplicates ---

  it('deduplicates input and returns one entry per unique string', () => {
    const result = resolveMinPrefixLengths(['abc', 'abc', 'abc']);
    expect(toObj(result)).toEqual({ abc: 1 });
  });

  // --- no collision at minLength ---

  it('resolves at minLength=1 when first chars differ', () => {
    expect(toObj(resolveMinPrefixLengths(['apple', 'banana', 'cherry']))).toEqual({
      apple: 1,
      banana: 1,
      cherry: 1,
    });
  });

  // --- collision requiring longer prefixes ---

  it('extends length to resolve colliding prefixes', () => {
    // "abc" vs "abd" collide at len=1,2 but resolve at len=3
    expect(toObj(resolveMinPrefixLengths(['abc', 'abd']))).toEqual({
      abc: 3,
      abd: 3,
    });
  });

  it('resolves mixed collision and non-collision', () => {
    // "ax" unique at 1, "ba" and "bc" collide at 1 but resolve at 2
    expect(toObj(resolveMinPrefixLengths(['ax', 'ba', 'bc']))).toEqual({
      ax: 1,
      ba: 2,
      bc: 2,
    });
  });

  // --- identical strings (cannot distinguish) ---

  it('deduplicates identical strings and resolves at minLength', () => {
    expect(toObj(resolveMinPrefixLengths(['abc', 'abc', 'xyz']))).toEqual({
      abc: 1,
      xyz: 1,
    });
  });

  it('returns full length when identical strings collide with others', () => {
    // "ab" and "ab" are identical (full length 2), "ac" resolves at 2
    expect(toObj(resolveMinPrefixLengths(['ab', 'ab', 'ac']))).toEqual({
      ab: 2,
      ac: 2,
    });
  });

  // --- minLength parameter ---

  it('respects minLength=2 even when 1 char would suffice', () => {
    expect(toObj(resolveMinPrefixLengths(['apple', 'banana'], 2))).toEqual({
      apple: 2,
      banana: 2,
    });
  });

  it('extends beyond minLength when collision exists', () => {
    // With minLength=2: "abc" vs "abd" collide at len=2, resolve at 3
    expect(toObj(resolveMinPrefixLengths(['abc', 'abd'], 2))).toEqual({
      abc: 3,
      abd: 3,
    });
  });

  // --- Japanese headsign examples ---

  it('resolves Japanese headsigns with minLength=2', () => {
    const result = resolveMinPrefixLengths(['新代田駅前', '新宿駅前', '新宿三丁目'], 2);
    expect(toObj(result)).toEqual({
      新代田駅前: 2,
      新宿駅前: 3,
      新宿三丁目: 3,
    });
  });

  it('resolves Japanese headsigns with minLength=1', () => {
    const result = resolveMinPrefixLengths(['浅草雷門', '新代田駅前'], 1);
    expect(toObj(result)).toEqual({
      浅草雷門: 1,
      新代田駅前: 1,
    });
  });

  it('resolves multi-group Japanese collision', () => {
    // Group 1: "浅草雷門" vs "浅草寿町" collide at 2, resolve at 3
    // Group 2: "新代田駅前" unique at 1
    const result = resolveMinPrefixLengths(['浅草雷門', '浅草寿町', '新代田駅前']);
    expect(toObj(result)).toEqual({
      浅草雷門: 3,
      浅草寿町: 3,
      新代田駅前: 1,
    });
  });

  // --- boundary: strings shorter than minLength ---

  it('handles strings shorter than minLength', () => {
    // "a" is 1 char, minLength=3 — capped at string length
    expect(toObj(resolveMinPrefixLengths(['a', 'b'], 3))).toEqual({
      a: 1,
      b: 1,
    });
  });

  it('handles mixed short and long strings', () => {
    // "a" and "ab" collide at len=1 — "a" fully shown at len=1, "ab" resolves at 2
    expect(toObj(resolveMinPrefixLengths(['a', 'ab']))).toEqual({
      a: 1,
      ab: 2,
    });
  });

  it('handles string that is a prefix of another', () => {
    // "a" and "aa" collide at len=1 — "a" fully shown, "aa" needs full length
    expect(toObj(resolveMinPrefixLengths(['a', 'aa']))).toEqual({
      a: 1,
      aa: 2,
    });
  });

  // --- chain collision: multiple groups resolving at different depths ---

  it('resolves multiple collision groups at different depths', () => {
    // Group 1: "aa", "ab" — collide at 1, resolve at 2
    // Group 2: "ba", "bb", "bc" — collide at 1, resolve at 2
    // Group 3: "c" — unique at 1
    const result = resolveMinPrefixLengths(['aa', 'ab', 'ba', 'bb', 'bc', 'c']);
    expect(toObj(result)).toEqual({
      aa: 2,
      ab: 2,
      ba: 2,
      bb: 2,
      bc: 2,
      c: 1,
    });
  });

  it('resolves nested collision requiring 3+ levels', () => {
    // "aaa", "aab", "abc" — "aaa"/"aab" collide deeper than "abc"
    const result = resolveMinPrefixLengths(['aaa', 'aab', 'abc']);
    expect(toObj(result)).toEqual({
      aaa: 3,
      aab: 3,
      abc: 2,
    });
  });

  // --- fully-shown peers at different depths ---

  it('handles fully-shown peer releasing a single longer string', () => {
    // "a", "ab", "ac" — at len=1 all collide on "a".
    // "a" fully shown → removed. "ab" and "ac" still collide → len=2 resolves.
    const result = resolveMinPrefixLengths(['a', 'ab', 'ac']);
    expect(toObj(result)).toEqual({
      a: 1,
      ab: 2,
      ac: 2,
    });
  });

  it('handles multiple fully-shown strings in one group', () => {
    // "x", "x", "xy" — deduplicated to "x", "xy"
    // At len=1: collide. "x" fully shown, "xy" needs len=2.
    const result = resolveMinPrefixLengths(['x', 'x', 'xy']);
    expect(toObj(result)).toEqual({
      x: 1,
      xy: 2,
    });
  });

  // --- single character strings ---

  it('handles all single character strings', () => {
    expect(toObj(resolveMinPrefixLengths(['a', 'b', 'c']))).toEqual({
      a: 1,
      b: 1,
      c: 1,
    });
  });

  it('handles single character collision (identical)', () => {
    // "a" and "a" are identical after dedup → single entry
    expect(toObj(resolveMinPrefixLengths(['a', 'a']))).toEqual({
      a: 1,
    });
  });

  // --- empty strings ---

  it('handles empty string input', () => {
    expect(toObj(resolveMinPrefixLengths(['']))).toEqual({ '': 0 });
  });

  it('handles duplicate empty strings', () => {
    // Deduplicated to single "" → early return, capped at string length
    expect(toObj(resolveMinPrefixLengths(['', '']))).toEqual({ '': 0 });
  });

  it('handles empty string mixed with non-empty', () => {
    // "" and "a" — at len=1: "" prefix is "", "a" prefix is "a" → unique, "" capped at 0
    const result = resolveMinPrefixLengths(['', 'a']);
    expect(toObj(result)).toEqual({
      '': 0,
      a: 1,
    });
  });

  // --- minLength <= 0 is clamped to 1 ---

  it('clamps minLength=0 to 1', () => {
    expect(toObj(resolveMinPrefixLengths(['a', 'b'], 0))).toEqual({
      a: 1,
      b: 1,
    });
  });

  it('clamps negative minLength to 1', () => {
    expect(toObj(resolveMinPrefixLengths(['abc', 'xyz'], -5))).toEqual({
      abc: 1,
      xyz: 1,
    });
  });

  it('clamps minLength=0 for single empty string', () => {
    expect(toObj(resolveMinPrefixLengths([''], 0))).toEqual({ '': 0 });
  });

  // --- resolved length capped at string length ---

  it('caps resolved length at string length when minLength exceeds it', () => {
    // "a" has only 1 char; even though minLength=2 and it resolves at len=2, cap to 1
    expect(toObj(resolveMinPrefixLengths(['a', 'a a'], 2))).toEqual({
      a: 1,
      'a a': 2,
    });
  });

  it('resolves cascading prefix collision with spaces', () => {
    // len=2: "a" unique, "a a"/"a aa" collide on "a "
    // len=3: "a a" fully shown, "a aa" needs full length to distinguish
    expect(toObj(resolveMinPrefixLengths(['a', 'a a', 'a aa'], 2))).toEqual({
      a: 1,
      'a a': 3,
      'a aa': 4,
    });
  });

  it('caps resolved length for multiple short strings with large minLength', () => {
    const result = resolveMinPrefixLengths(['ab', 'cd'], 10);
    expect(toObj(result)).toEqual({
      ab: 2,
      cd: 2,
    });
  });

  // --- does not mutate input ---

  it('does not mutate the input array', () => {
    const input = ['cherry', 'banana', 'apple'];
    const copy = [...input];
    resolveMinPrefixLengths(input);
    expect(input).toEqual(copy);
  });
});
