// @ts-check

import { describe, expect, it } from 'vitest';

import { buildSlackPayload } from './build-slack-notify-payload.mjs';

/** @typedef {import('./build-slack-notify-payload.mjs').BuildSlackPayloadInput} BuildSlackPayloadInput */
/** @typedef {import('./build-slack-notify-payload.mjs').SlackSectionBlock} SlackSectionBlock */
/** @typedef {import('./build-slack-notify-payload.mjs').SlackContextBlock} SlackContextBlock */
/** @typedef {import('./build-slack-notify-payload.mjs').SlackPayload} SlackPayload */

/** @type {Omit<BuildSlackPayloadInput, 'result' | 'summary'>} */
const BASE_INPUT = {
  workflowName: 'Check Transit Resources',
  runUrl: 'https://github.com/F88/athenai-transit/actions/runs/12345',
  branch: 'main',
  channelId: 'C1234567890',
};

/**
 * @param {SlackPayload} payload
 * @returns {SlackSectionBlock}
 */
function sectionOf(payload) {
  const block = payload.blocks[0];
  if (block.type !== 'section') {
    throw new Error(`Expected first block to be a section, got ${block.type}`);
  }
  return block;
}

/**
 * @param {SlackPayload} payload
 * @returns {SlackContextBlock}
 */
function contextOf(payload) {
  const block = payload.blocks[1];
  if (block.type !== 'context') {
    throw new Error(`Expected second block to be a context, got ${block.type}`);
  }
  return block;
}

describe('buildSlackPayload', () => {
  describe('status header', () => {
    it('uses the success emoji and label for result=success', () => {
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'success', summary: '' });
      expect(payload.text).toBe(':white_check_mark: *Check Transit Resources* — Success');
    });

    it('uses the warning emoji and label for result=warning', () => {
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'warning', summary: '' });
      expect(payload.text).toBe(':warning: *Check Transit Resources* — Warning');
    });

    it('uses the cancelled emoji and label for result=cancelled', () => {
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'cancelled', summary: '' });
      expect(payload.text).toBe(':no_entry_sign: *Check Transit Resources* — Cancelled');
    });

    it('uses the failure emoji and label for result=failure', () => {
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'failure', summary: '' });
      expect(payload.text).toBe(':x: *Check Transit Resources* — Failed');
    });
  });

  describe('section block', () => {
    it('contains only the BASE header when summary is empty', () => {
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'success', summary: '' });
      expect(sectionOf(payload)).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: *Check Transit Resources* — Success',
        },
      });
    });

    it('concatenates BASE and summary with a single newline', () => {
      const payload = buildSlackPayload({
        ...BASE_INPUT,
        result: 'failure',
        summary: 'line one\nline two',
      });
      expect(sectionOf(payload).text.text).toBe(
        ':x: *Check Transit Resources* — Failed\nline one\nline two',
      );
    });

    it('preserves embedded double-quote characters in the summary', () => {
      const payload = buildSlackPayload({
        ...BASE_INPUT,
        result: 'failure',
        summary: 'failed module "foo" needs review',
      });
      expect(sectionOf(payload).text.text).toContain('failed module "foo" needs review');
      // JSON serialization must round-trip without throwing.
      expect(() => {
        JSON.parse(JSON.stringify(payload));
      }).not.toThrow();
    });

    it('preserves backslashes in the summary so that JSON.stringify escapes them once', () => {
      const payload = buildSlackPayload({
        ...BASE_INPUT,
        result: 'failure',
        summary: 'path with \\ backslash',
      });
      const serialized = JSON.stringify(payload);
      expect(serialized).toContain('path with \\\\ backslash');
    });
  });

  describe('truncation', () => {
    const BASE_TEXT = ':x: *Check Transit Resources* — Failed';
    const INLINE_MARKER = ' ... (truncated)';

    it('does not truncate when the combined length is exactly the trigger threshold', () => {
      const summary = 'a'.repeat(2800 - BASE_TEXT.length - 1); // -1 for the joining newline
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'failure', summary });
      const section = sectionOf(payload);
      expect(section.text.text).toHaveLength(2800);
      expect(section.text.text).not.toContain('(truncated)');
      expect(section.text.text).not.toContain('Truncated from');
    });

    it('truncates the body at fixed length when the combined text overflows', () => {
      const summary = 'a'.repeat(3000);
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'failure', summary });
      const text = sectionOf(payload).text.text;
      // The body (first 2800 chars) is followed immediately by the inline marker,
      // then a blank line + the bold suffix.
      expect(text.slice(0, 2800)).toBe(`${BASE_TEXT}\n${summary}`.slice(0, 2800));
      expect(text.slice(2800, 2800 + INLINE_MARKER.length)).toBe(INLINE_MARKER);
      expect(text.slice(2800 + INLINE_MARKER.length, 2800 + INLINE_MARKER.length + 2)).toBe('\n\n');
    });

    it('reports the original length and the keep length (2800) in the bold suffix', () => {
      const summary = 'a'.repeat(3000);
      const combined = `${BASE_TEXT}\n${summary}`;
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'failure', summary });
      expect(sectionOf(payload).text.text).toContain(
        `\n\n*Truncated from ${combined.length} to 2800 chars, see View Run*`,
      );
    });

    it('keeps the total section text safely below 3000 characters', () => {
      const summary = 'X'.repeat(5000);
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'failure', summary });
      expect(sectionOf(payload).text.text.length).toBeLessThan(3000);
    });

    it('preserves multi-line diagnostic content up to the limit', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i}: ${'a'.repeat(100)}`);
      const summary = lines.join('\n');
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'failure', summary });
      const text = sectionOf(payload).text.text;
      // Earliest lines are kept, the inline marker shows where the cut happened.
      expect(text).toContain('line 0:');
      expect(text).toContain(INLINE_MARKER);
    });

    it('preserves single-line diagnostic content (no internal newlines) up to the limit', () => {
      const summary = 'X'.repeat(5000);
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'failure', summary });
      const text = sectionOf(payload).text.text;
      // The body must contain a long run of X (most of the 2800 budget after BASE+\n).
      expect(text.slice(0, 2800)).toBe(`${BASE_TEXT}\n${summary}`.slice(0, 2800));
      expect(text).toContain(INLINE_MARKER);
    });

    it('leaves the fallback `text` field as the un-truncated BASE header', () => {
      const payload = buildSlackPayload({
        ...BASE_INPUT,
        result: 'failure',
        summary: 'x'.repeat(5000),
      });
      expect(payload.text).toBe(BASE_TEXT);
      expect(payload.text.length).toBeLessThan(100);
    });
  });

  describe('context block', () => {
    it('includes the run URL link and branch as a single mrkdwn element', () => {
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'success', summary: '' });
      expect(contextOf(payload)).toEqual({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '<https://github.com/F88/athenai-transit/actions/runs/12345|View Run> | Branch: `main`',
          },
        ],
      });
    });
  });

  describe('top-level fields', () => {
    it('exposes channelId as `channel` and a two-block layout', () => {
      const payload = buildSlackPayload({ ...BASE_INPUT, result: 'success', summary: '' });
      expect(payload.channel).toBe('C1234567890');
      expect(payload.blocks).toHaveLength(2);
    });
  });
});
