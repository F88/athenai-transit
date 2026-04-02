import path from 'path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

const WORKTREE_EXCLUDE = ['.claude/**'];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      exclude: [...configDefaults.exclude, ...WORKTREE_EXCLUDE],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts', 'src/**/*.tsx', 'pipeline/**/*.ts'],
        exclude: [
          ...WORKTREE_EXCLUDE,
          '**/__tests__/**',
          '**/*.test.ts',
          '**/*.stories.tsx',
          'src/test/**',
          'src/vite-env.d.ts',
          'src/main.tsx',
          'pipeline/config/**',
          'pipeline/_references/**',
        ],
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
          },
        },
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: path.join(import.meta.dirname, '.storybook'),
            }),
          ],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [
                {
                  browser: 'chromium',
                },
              ],
            },
            setupFiles: ['.storybook/vitest.setup.ts'],
          },
        },
      ],
    },
  }),
);
