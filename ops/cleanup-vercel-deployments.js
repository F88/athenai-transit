/**
 * Clean up old Vercel deployments beyond configured retention counts.
 *
 * Fetches all deployments via `vercel ls` (with pagination), then removes
 * the oldest ones that exceed the per-environment retention limit.
 * Removals run serially to avoid rate-limiting issues.
 *
 * Requires the Vercel CLI (`vercel`) to be installed and authenticated.
 *
 * Intended for manual execution only (not CI).
 * Usage:
 *   node ops/cleanup-vercel-deployments.js
 *   node ops/cleanup-vercel-deployments.js --dry-run
 *   npm run cleanup:vercel
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Per-project, per-environment retention settings. */
const CLEANUP_TARGETS = [
  { project: 'athenai-transit', environment: 'Preview', deploymentsToKeep: 5 },
  { project: 'athenai-transit', environment: 'Production', deploymentsToKeep: 10 },
];

/** Number of concurrent `vercel rm` operations. */
const CONCURRENCY = 2;

/** When true, list deletions without actually removing deployments. */
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex to extract a deployment URL from `vercel ls` output. */
const DEPLOYMENT_URL_REGEX = /(https:\/\/[^ ]+\.vercel\.app)/;

/** Regex to extract the `--next` pagination token from `vercel ls` output. */
const NEXT_PAGE_REGEX = /--next (\d+)/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute `vercel ls` for a specific project and return its stderr output
 * (where Vercel CLI prints the deployment table).
 *
 * @param {string} project - Vercel project name to list deployments for.
 * @param {number | null} nextTimestamp - Pagination token, or null for first page.
 * @returns {Promise<string>} Raw stderr output from `vercel ls`.
 */
async function execVercelLs(project, nextTimestamp) {
  const command = nextTimestamp
    ? `vercel ls ${project} --next ${nextTimestamp}`
    : `vercel ls ${project}`;
  // Vercel CLI prints the deployment table to stderr
  const { stderr } = await execAsync(command);
  return stderr;
}

/**
 * Fetch all deployment lines from `vercel ls` for a specific project,
 * following pagination.
 *
 * @param {string} project - Vercel project name to list deployments for.
 * @returns {Promise<string[]>} All output lines across all pages.
 */
async function fetchAllDeploymentLines(project) {
  /** @type {string[]} */
  const allLines = [];
  let nextTimestamp = null;

  while (true) {
    const output = await execVercelLs(project, nextTimestamp);
    allLines.push(...output.split('\n'));

    const match = output.match(NEXT_PAGE_REGEX);
    if (match?.[1]) {
      nextTimestamp = match[1];
      console.log(`  📄 Fetching next page (timestamp: ${nextTimestamp})...`);
    } else {
      break;
    }
  }

  return allLines;
}

/**
 * Parse deployment lines and extract entries matching a target environment.
 *
 * @param {string[]} lines - Raw lines from `vercel ls`.
 * @param {string} environment - "Preview" or "Production".
 * @returns {{ url: string; line: string }[]} Parsed deployments, newest first.
 */
function parseDeployments(lines, environment) {
  const opposite = environment === 'Preview' ? 'Production' : 'Preview';

  return lines
    .filter(
      (line) =>
        line.includes('vercel.app') &&
        line.includes(environment) &&
        !line.includes('Deployment') &&
        !line.includes(opposite),
    )
    .flatMap((line) => {
      const match = line.match(DEPLOYMENT_URL_REGEX);
      return match ? [{ url: match[1], line: line.trim() }] : [];
    });
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/**
 * Run the cleanup for a single environment.
 *
 * @param {string} environment - "Preview" or "Production".
 * @param {number} deploymentsToKeep - Number of recent deployments to retain.
 * @param {string[]} allLines - Pre-fetched deployment lines.
 * @returns {Promise<number>} Number of failed removals.
 */
async function cleanupEnvironment(environment, deploymentsToKeep, allLines) {
  console.log(`\n--- ${environment} (keep latest ${deploymentsToKeep}) ---\n`);

  const deployments = parseDeployments(allLines, environment);
  const toKeep = deployments.slice(0, deploymentsToKeep);
  const toRemove = deployments.slice(deploymentsToKeep);

  console.log(`  📋 ${deployments.length} deployments found (keeping ${toKeep.length}):`);
  for (const dep of toKeep) {
    console.log(`    ✅ ${dep.line}`);
  }

  if (toRemove.length === 0) {
    return 0;
  }

  console.log(`\n  🚨 ${toRemove.length} deployments to remove:`);
  for (const dep of toRemove) {
    console.log(`    ${dep.line}`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('  (dry-run: skipping actual removal)');
    return 0;
  }

  let failures = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toRemove.length; i += CONCURRENCY) {
    const batch = toRemove.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (dep, j) => {
        const idx = i + j + 1;
        console.log(`  [${idx}/${toRemove.length}] Removing ${dep.url}...`);
        await execAsync(`vercel rm "${dep.url}" -y`);
        return dep.url;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        console.log(`    ✅ Removed ${result.value}`);
      } else {
        console.error(`    ❌ Failed: ${result.reason.message}`);
        failures++;
      }
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = performance.now();
  console.log('🧹 Vercel Deployment Cleanup');

  if (DRY_RUN) {
    console.log('⚠️  dry-run mode: no deployments will be removed');
  }

  // Group targets by project to fetch deployment lines once per project
  /** @type {Map<string, typeof CLEANUP_TARGETS>} */
  const byProject = new Map();
  for (const target of CLEANUP_TARGETS) {
    const list = byProject.get(target.project) ?? [];
    list.push(target);
    byProject.set(target.project, list);
  }

  let totalFailures = 0;

  for (const [project, targets] of byProject) {
    console.log('');
    console.log('==========================================');
    console.log(`  Project: ${project}`);
    console.log('==========================================');
    console.log('\nFetching deployment pages...');
    const allLines = await fetchAllDeploymentLines(project);
    console.log(`  ${allLines.length} lines fetched.`);

    for (const target of targets) {
      const failures = await cleanupEnvironment(
        target.environment,
        target.deploymentsToKeep,
        allLines,
      );
      totalFailures += failures;
    }
  }

  const elapsed = Math.round(performance.now() - startTime);

  if (totalFailures > 0) {
    console.log(`\n⚠️  Done in ${elapsed}ms. ${totalFailures} removal(s) failed.`);
  } else {
    console.log(`\n✅ Done in ${elapsed}ms.`);
  }
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err.message);
});
