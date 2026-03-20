/**
 * Entry point for analysis and development tools.
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/dev-tools.ts              # interactive selection
 *   npx tsx pipeline/scripts/dev/dev-tools.ts <script-name> # direct execution
 *   npx tsx pipeline/scripts/dev/dev-tools.ts --list        # list available scripts
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as readline from 'node:readline';

interface AnalysisScript {
  name: string;
  file: string;
  description: string;
}

const SCRIPTS: AnalysisScript[] = [
  {
    name: 'describe-resources',
    file: './describe-resources.ts',
    description: 'リソース定義の一覧表示 (--summary, --verbose, --format tsv)',
  },
  {
    name: 'check-odpt-resources',
    file: '../pipeline/check-odpt-resources.ts',
    description: 'ODPT リソース更新チェック (Members Portal API)',
  },
  {
    name: 'joint-routes',
    file: './find-joint-routes.ts',
    description: '共同運行路線の検出 (route_short_name 一致 + 停留所突き合わせ)',
  },
  {
    name: 'analyze-gtfs-stop-times',
    file: './analyze-gtfs-stop-times.ts',
    description: 'GTFS stop_times パターン分析 (terminal-only stops, circular routes 等)',
  },
  {
    name: 'analyze-odpt-station-timetable',
    file: './analyze-odpt-station-timetable.ts',
    description: 'ODPT StationTimetable データパターン分析',
  },
];

const SCRIPT_DIR = import.meta.dirname;

function listScripts(): void {
  console.log('Available analysis scripts:\n');
  for (const [i, script] of SCRIPTS.entries()) {
    console.log(`  ${i + 1}. ${script.name}`);
    console.log(`     ${script.description}`);
    console.log(`     file: ${script.file}`);
    console.log();
  }
}

function runScript(script: AnalysisScript): void {
  const scriptPath = path.join(SCRIPT_DIR, script.file);
  console.log(`Running: ${script.name} (${script.file})\n`);
  try {
    execSync(`npx tsx "${scriptPath}"`, { stdio: 'inherit' });
  } catch (err) {
    // Non-zero exit codes from analysis scripts (e.g. check warnings)
    // are expected results, not errors. Propagate the exit code silently.
    if (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') {
      process.exitCode = err.status;
    } else {
      throw err;
    }
  }
}

function promptSelection(): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Select script number (or q to quit): ', (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'q') {
        resolve(-1);
      } else {
        const num = parseInt(answer.trim(), 10);
        resolve(Number.isNaN(num) ? -1 : num);
      }
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --list flag
  if (args.includes('--list')) {
    listScripts();
    return;
  }

  // Direct execution by name
  if (args.length > 0) {
    const name = args[0];
    const script = SCRIPTS.find((s) => s.name === name || s.file === name);
    if (!script) {
      console.error(`Unknown script: ${name}`);
      console.error('Use --list to see available scripts.');
      process.exit(1);
    }
    runScript(script);
    return;
  }

  // Interactive selection
  listScripts();
  const selection = await promptSelection();
  if (selection < 1 || selection > SCRIPTS.length) {
    console.log('Cancelled.');
    return;
  }
  console.log();
  runScript(SCRIPTS[selection - 1]);
}

void main();
