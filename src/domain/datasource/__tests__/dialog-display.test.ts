/**
 * Tests for dialog-display.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { computeDialogDisplay } from '../dialog-display';
import type { SourceLoadState } from '../source-load-state';
import type { SourceGroup } from '../../../types/app/source-group';

function group(
  overrides: Partial<SourceGroup> & {
    id: string;
    prefixes: string[];
    systemEnabledByDefault: boolean;
    userEnabledByDefault: boolean;
  },
): SourceGroup {
  return {
    routeTypes: [3],
    name: { name: overrides.id, names: { en: overrides.id } },
    countries: ['JP'],
    ...overrides,
  };
}

function loadStatus(loaded: string[] = [], failed: string[] = []): SourceLoadState {
  const map = new Map<string, { status: 'loaded' } | { status: 'failed'; error: Error }>();
  for (const p of loaded) {
    map.set(p, { status: 'loaded' });
  }
  for (const p of failed) {
    map.set(p, { status: 'failed', error: new Error('test') });
  }
  return map;
}

describe('computeDialogDisplay — normal mode', () => {
  it('shows system-enabled groups and groups with any attempted prefix', () => {
    const groups = [
      group({
        id: 'a',
        prefixes: ['ap'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
      group({
        id: 'b',
        prefixes: ['bp'],
        systemEnabledByDefault: false,
        userEnabledByDefault: false,
      }),
      // c is system-disabled but its prefix has been attempted → still
      // visible (so the user sees the load status of what actually
      // ended up loaded).
      group({
        id: 'c',
        prefixes: ['cp'],
        systemEnabledByDefault: false,
        userEnabledByDefault: false,
      }),
    ];
    const { visibleGroups } = computeDialogDisplay(
      groups,
      loadStatus(['cp']),
      false,
      new Set(['a']),
    );
    expect(visibleGroups.map((g) => g.id)).toEqual(['a', 'c']);
  });

  it('uses the user-settings Set verbatim as effectiveEnabledIds', () => {
    const groups = [
      group({
        id: 'a',
        prefixes: ['ap'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
      group({
        id: 'b',
        prefixes: ['bp'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
    ];
    const userEnabled = new Set(['a']);
    const { effectiveEnabledIds } = computeDialogDisplay(groups, loadStatus(), false, userEnabled);
    // In normal mode, `effectiveEnabledIds === userEnabledIds` — no
    // mutation, no copy.
    expect(effectiveEnabledIds).toBe(userEnabled);
  });
});

describe('computeDialogDisplay — forced-sources mode', () => {
  it('shows only groups with at least one attempted prefix', () => {
    const groups = [
      group({
        id: 'a',
        prefixes: ['ap'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
      group({
        id: 'b',
        prefixes: ['bp'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
    ];
    const { visibleGroups } = computeDialogDisplay(groups, loadStatus(['ap']), true, new Set());
    expect(visibleGroups.map((g) => g.id)).toEqual(['a']);
  });

  it('treats every visible group as enabled (ignores the user-settings Set)', () => {
    const groups = [
      group({
        id: 'a',
        prefixes: ['ap'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
      group({
        id: 'b',
        prefixes: ['bp'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
    ];
    const userEnabled = new Set(['b']); // intentionally not aligned with the URL
    const { visibleGroups, effectiveEnabledIds } = computeDialogDisplay(
      groups,
      loadStatus(['ap', 'bp']),
      true,
      userEnabled,
    );
    expect(visibleGroups.map((g) => g.id)).toEqual(['a', 'b']);
    expect([...effectiveEnabledIds].sort()).toEqual(['a', 'b']);
    // It must NOT just return userEnabledIds in forced mode.
    expect(effectiveEnabledIds).not.toBe(userEnabled);
  });

  it('also surfaces system-disabled groups when their prefix was attempted (?sources=all path)', () => {
    const groups = [
      group({
        id: 'a',
        prefixes: ['ap'],
        systemEnabledByDefault: true,
        userEnabledByDefault: true,
      }),
      // System-disabled, but the URL forced it → loaded → must show.
      group({
        id: 'b',
        prefixes: ['bp'],
        systemEnabledByDefault: false,
        userEnabledByDefault: false,
      }),
    ];
    const { visibleGroups, effectiveEnabledIds } = computeDialogDisplay(
      groups,
      loadStatus(['ap', 'bp']),
      true,
      new Set(),
    );
    expect(visibleGroups.map((g) => g.id)).toEqual(['a', 'b']);
    expect([...effectiveEnabledIds].sort()).toEqual(['a', 'b']);
  });
});
