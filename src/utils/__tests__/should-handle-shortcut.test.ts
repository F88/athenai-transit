/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  isEditableTarget,
  shouldHandleShortcut,
  type KeyEventLike,
} from '../should-handle-shortcut';

/**
 * Build a minimal KeyEventLike with sensible defaults so each test only
 * overrides the fields it cares about.
 */
function makeEvent(overrides: Partial<KeyEventLike> = {}): KeyEventLike {
  return {
    key: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    target: null,
    ...overrides,
  };
}

describe('isEditableTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false for null', () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it('returns false for a non-HTMLElement EventTarget', () => {
    const fakeTarget = {} as EventTarget;
    expect(isEditableTarget(fakeTarget)).toBe(false);
  });

  it('returns true for an <input> element', () => {
    const input = document.createElement('input');
    expect(isEditableTarget(input)).toBe(true);
  });

  it('returns true for a <textarea> element', () => {
    const textarea = document.createElement('textarea');
    expect(isEditableTarget(textarea)).toBe(true);
  });

  it('returns true for a contenteditable="true" element', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns true for a bare contenteditable attribute (no value)', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', '');
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns true for contenteditable="plaintext-only"', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'plaintext-only');
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns false for contenteditable="false"', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'false');
    expect(isEditableTarget(div)).toBe(false);
  });

  it('returns false for a plain <div>', () => {
    const div = document.createElement('div');
    expect(isEditableTarget(div)).toBe(false);
  });

  it('returns false for a <button>', () => {
    const button = document.createElement('button');
    expect(isEditableTarget(button)).toBe(false);
  });
});

describe('shouldHandleShortcut', () => {
  describe('key matching', () => {
    it('returns "search" for the "/" key', () => {
      expect(shouldHandleShortcut(makeEvent({ key: '/' }), true)).toBe('search');
    });

    it('returns "help" for the "?" key', () => {
      expect(shouldHandleShortcut(makeEvent({ key: '?' }), true)).toBe('help');
    });

    it('returns null for an unrelated letter key', () => {
      expect(shouldHandleShortcut(makeEvent({ key: 'a' }), true)).toBeNull();
    });

    it('returns null for Enter', () => {
      expect(shouldHandleShortcut(makeEvent({ key: 'Enter' }), true)).toBeNull();
    });

    it('returns null for Escape (handled by Radix Dialog)', () => {
      expect(shouldHandleShortcut(makeEvent({ key: 'Escape' }), true)).toBeNull();
    });
  });

  describe('enabled flag', () => {
    it('returns null when enabled is false even for matching keys', () => {
      expect(shouldHandleShortcut(makeEvent({ key: '/' }), false)).toBeNull();
      expect(shouldHandleShortcut(makeEvent({ key: '?' }), false)).toBeNull();
    });
  });

  describe('IME composition', () => {
    it('returns null while composing (isComposing=true)', () => {
      expect(shouldHandleShortcut(makeEvent({ key: '/', isComposing: true }), true)).toBeNull();
      expect(shouldHandleShortcut(makeEvent({ key: '?', isComposing: true }), true)).toBeNull();
    });
  });

  describe('modifier keys', () => {
    it('returns null when Ctrl is pressed', () => {
      expect(shouldHandleShortcut(makeEvent({ key: '/', ctrlKey: true }), true)).toBeNull();
    });

    it('returns null when Meta (Cmd) is pressed', () => {
      expect(shouldHandleShortcut(makeEvent({ key: '/', metaKey: true }), true)).toBeNull();
    });

    it('returns null when Alt is pressed', () => {
      expect(shouldHandleShortcut(makeEvent({ key: '/', altKey: true }), true)).toBeNull();
    });
  });

  describe('editable target', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('returns null when target is an <input>', () => {
      const input = document.createElement('input');
      expect(shouldHandleShortcut(makeEvent({ key: '/', target: input }), true)).toBeNull();
    });

    it('returns null when target is a <textarea>', () => {
      const textarea = document.createElement('textarea');
      expect(shouldHandleShortcut(makeEvent({ key: '?', target: textarea }), true)).toBeNull();
    });

    it('returns null when target is a contenteditable element', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      expect(shouldHandleShortcut(makeEvent({ key: '/', target: div }), true)).toBeNull();
    });

    it('returns the action when target is a non-editable element', () => {
      const div = document.createElement('div');
      expect(shouldHandleShortcut(makeEvent({ key: '/', target: div }), true)).toBe('search');
    });
  });
});
