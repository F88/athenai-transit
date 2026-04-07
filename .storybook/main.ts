import { withoutVitePlugins } from '@storybook/builder-vite';
import type { StorybookConfig } from '@storybook/react-vite';

const PWA_PLUGIN_NAMES = [
  'vite-plugin-pwa',
  'vite-plugin-pwa:build',
  'vite-plugin-pwa:dev-sw',
  'vite-plugin-pwa:info',
  'vite-plugin-pwa:pwa-assets',
];

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-vite',
  async viteFinal(viteConfig) {
    return {
      ...viteConfig,
      plugins: await withoutVitePlugins(viteConfig.plugins, PWA_PLUGIN_NAMES),
    };
  },
};
export default config;
