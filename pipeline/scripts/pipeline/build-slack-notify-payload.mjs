#!/usr/bin/env node
// @ts-check

/**
 * Build the Slack chat.postMessage payload JSON for the slack-notify composite action.
 *
 * Reads inputs from environment variables, maps `result` to status emoji/text,
 * truncates the section block body to stay safely under Slack's 3000-char
 * section text limit, and writes the resulting payload as a single-line JSON
 * string to stdout. The action.yml caller passes the stdout straight into
 * slackapi/slack-github-action's `payload:` input.
 *
 * Using JSON.stringify (vs. raw shell interpolation into YAML quoted scalars)
 * preserves multi-line summary content and safely escapes embedded `"`
 * characters, neither of which the previous shell-only implementation could do.
 *
 * Written as a dependency-free Node.js ES module (not TypeScript via `tsx`) so
 * that the notification still works when the caller workflow's `npm ci` or
 * Node setup steps have failed — the most important case to receive a Slack
 * alert for. The script relies only on Node.js's built-in modules, which are
 * pre-installed on every GitHub-hosted runner image.
 *
 * Environment variables (all required unless noted optional):
 *   WORKFLOW_NAME  GitHub workflow name (e.g., "Check Transit Resources")
 *   RUN_URL        Absolute URL to the run's GitHub Actions page
 *   BRANCH         Branch name (`github.ref_name`)
 *   RESULT         success | warning | failure | cancelled (unknown -> failure)
 *   SUMMARY        Multi-line text appended after the BASE header (optional)
 *   CHANNEL_ID     Slack channel ID
 *
 * Usage:
 *   node pipeline/scripts/pipeline/build-slack-notify-payload.mjs
 */

import { pathToFileURL } from 'node:url';

const TRUNCATE_TRIGGER = 2800;
const TRUNCATE_KEEP = 2800;

/**
 * @typedef {'success' | 'warning' | 'failure' | 'cancelled'} SlackNotifyResult
 */

/**
 * @typedef {Object} StatusDescriptor
 * @property {string} emoji
 * @property {string} text
 */

/** @type {Record<SlackNotifyResult, StatusDescriptor>} */
const STATUS_DESCRIPTORS = {
  success: { emoji: ':white_check_mark:', text: 'Success' },
  warning: { emoji: ':warning:', text: 'Warning' },
  cancelled: { emoji: ':no_entry_sign:', text: 'Cancelled' },
  failure: { emoji: ':x:', text: 'Failed' },
};

/**
 * @typedef {Object} BuildSlackPayloadInput
 * @property {string} workflowName
 * @property {string} runUrl
 * @property {string} branch
 * @property {SlackNotifyResult} result
 * @property {string} summary
 * @property {string} channelId
 */

/**
 * @typedef {Object} SlackMrkdwnText
 * @property {'mrkdwn'} type
 * @property {string} text
 */

/**
 * @typedef {Object} SlackSectionBlock
 * @property {'section'} type
 * @property {SlackMrkdwnText} text
 */

/**
 * @typedef {Object} SlackContextBlock
 * @property {'context'} type
 * @property {SlackMrkdwnText[]} elements
 */

/** @typedef {SlackSectionBlock | SlackContextBlock} SlackBlock */

/**
 * @typedef {Object} SlackPayload
 * @property {string} channel
 * @property {string} text
 * @property {SlackBlock[]} blocks
 */

/**
 * @param {SlackNotifyResult} result
 * @returns {StatusDescriptor}
 */
function resolveStatus(result) {
  return STATUS_DESCRIPTORS[result] ?? STATUS_DESCRIPTORS.failure;
}

/**
 * Build the Slack chat.postMessage payload for a workflow notification.
 *
 * The section block text combines a status header (`{emoji} *{workflow}* — {status}`)
 * with the optional summary. If the combined text exceeds TRUNCATE_TRIGGER
 * characters, it is sliced to TRUNCATE_KEEP characters and an inline marker
 * ` ... (truncated)` is appended right at the cut point so the reader can
 * see *where* the body was cut. A suffix `\n\n*Truncated from N to {KEEP}
 * chars, see View Run*` is then appended on its own line, in Slack mrkdwn
 * bold with a leading blank line so the truncation notice is visually
 * distinguishable from the body. This keeps the final text safely below
 * Slack's 3000-character section text limit while preserving as much
 * diagnostic content as possible.
 *
 * The fallback `text` field is set to the un-truncated BASE header so that
 * notification previews (mobile push, desktop bell) remain short and readable.
 *
 * @param {BuildSlackPayloadInput} input
 * @returns {SlackPayload}
 */
export function buildSlackPayload(input) {
  const { emoji, text: statusText } = resolveStatus(input.result);
  const base = `${emoji} *${input.workflowName}* — ${statusText}`;

  const combined = input.summary.length > 0 ? `${base}\n${input.summary}` : base;
  let sectionText = combined;
  if (combined.length > TRUNCATE_TRIGGER) {
    const origLen = combined.length;
    const body = combined.slice(0, TRUNCATE_KEEP);
    sectionText = `${body} ... (truncated)\n\n*Truncated from ${origLen} to ${TRUNCATE_KEEP} chars, see View Run*`;
  }

  return {
    channel: input.channelId,
    text: base,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: sectionText } },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `<${input.runUrl}|View Run> | Branch: \`${input.branch}\`` },
        ],
      },
    ],
  };
}

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * @param {string} value
 * @returns {SlackNotifyResult}
 */
function parseResult(value) {
  if (value === 'success' || value === 'warning' || value === 'failure' || value === 'cancelled') {
    return value;
  }
  return 'failure';
}

/** @returns {BuildSlackPayloadInput} */
function readInputFromEnv() {
  return {
    workflowName: requireEnv('WORKFLOW_NAME'),
    runUrl: requireEnv('RUN_URL'),
    branch: requireEnv('BRANCH'),
    result: parseResult(requireEnv('RESULT')),
    summary: process.env.SUMMARY ?? '',
    channelId: requireEnv('CHANNEL_ID'),
  };
}

function main() {
  const input = readInputFromEnv();
  const payload = buildSlackPayload(input);
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function isDirectExecution() {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  try {
    main();
  } catch (err) {
    console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
