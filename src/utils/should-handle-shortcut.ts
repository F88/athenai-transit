/**
 * Keyboard shortcut action identifier.
 * - `search` — open the stop search modal
 * - `help` — open the shortcut help dialog
 */
export type ShortcutAction = 'search' | 'help';

/**
 * Minimal subset of {@link KeyboardEvent} fields that the shortcut matcher
 * needs to inspect. Declared as a structural type so tests can pass plain
 * objects without constructing real DOM events.
 */
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  target: EventTarget | null;
}

/**
 * Returns true when the event target is — or is a descendant of — a
 * user-editable element (`<input>`, `<textarea>`, or any node with a
 * truthy `contenteditable` attribute).
 *
 * Used to suppress global shortcut handling while the user is typing into a
 * form control so that characters like `/` and `?` reach the control as
 * normal text input.
 *
 * The contenteditable check uses `closest()` so that focus inside a child
 * element of a contenteditable container (e.g. a `<span>` inside a rich
 * text editor) is also detected. The `:not([contenteditable="false"])`
 * filter respects the explicit opt-out value while still matching the
 * idiomatic `contenteditable`, `contenteditable="true"`, and
 * `contenteditable="plaintext-only"` forms.
 *
 * The attribute-based selector is intentionally preferred over
 * `HTMLElement.isContentEditable`: the latter depends on the rendering
 * pipeline and is unreliable under jsdom in the unit tests.
 *
 * @param target - The event target to inspect. May be null.
 * @returns True if the target is an editable element or lives inside one.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
    return true;
  }
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * Decide which (if any) shortcut action a keyboard event should trigger.
 *
 * The function is intentionally pure and side-effect free so that every
 * decision branch can be unit-tested without mounting React or touching the
 * real DOM.
 *
 * Returns `null` (shortcut suppressed) when any of the following holds:
 * - `enabled` is false (e.g. a modal is already open)
 * - The event is part of an IME composition (`isComposing`)
 * - A modifier key (Ctrl, Meta, Alt) is pressed — do not steal browser chords
 * - The event target is an editable element (see {@link isEditableTarget})
 *
 * Otherwise returns the matching {@link ShortcutAction}, or `null` if the key
 * does not correspond to any known shortcut.
 *
 * @param event - Keyboard event-like object to inspect.
 * @param enabled - Whether shortcut handling is currently enabled.
 * @returns The action to trigger, or null if the event should be ignored.
 */
export function shouldHandleShortcut(event: KeyEventLike, enabled: boolean): ShortcutAction | null {
  if (!enabled) {
    return null;
  }
  if (event.isComposing) {
    return null;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (isEditableTarget(event.target)) {
    return null;
  }
  if (event.key === '/') {
    return 'search';
  }
  if (event.key === '?') {
    return 'help';
  }
  return null;
}
