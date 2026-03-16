/**
 * Entry point for analysis and development tools.
 *
 * Usage:
 *   npx tsx pipeline/scripts/analysis/index.ts              # interactive selection
 *   npx tsx pipeline/scripts/analysis/index.ts <script-name> # direct execution
 *   npx tsx pipeline/scripts/analysis/index.ts --list        # list available scripts
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
    file: 'analysis/describe-resources.ts',
    description: 'リソース定義の一覧表示 (--summary, --verbose, --format tsv)',
  },
  {
    name: 'joint-routes',
    file: 'analysis/find-joint-routes.ts',
    description: '共同運行路線の検出 (route_short_name 一致 + 停留所突き合わせ)',
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
  execSync(`npx tsx "${scriptPath}"`, { stdio: 'inherit' });
}

function promptSelection(): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Select script number (or q to quit): ', (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'q') {
        resolve(-1);
      } else {
        resolve(parseInt(answer.trim(), 10));
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
