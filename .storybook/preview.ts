/// <reference path="./vite-env.d.ts" />

import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import i18n from '../src/i18n';
import { SUPPORTED_LANGS, normalizeLang } from '../src/config/supported-langs';

// Override app's overflow:hidden on html/body (needed for full-screen map)
// so that Storybook docs pages and story previews can scroll.
if (typeof document !== 'undefined') {
  document.documentElement.style.overflow = 'auto';
  document.body.style.overflow = 'auto';
}

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    lang: {
      name: 'Lang',
      description: 'UI language for Storybook preview',
      defaultValue: normalizeLang(typeof navigator !== 'undefined' ? navigator.language : ''),
      toolbar: {
        icon: 'globe',
        items: SUPPORTED_LANGS.map((lang) => ({
          value: lang.code,
          title: lang.label,
          right: lang.shortLabel,
        })),
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const nextLang = normalizeLang(String(context.globals.lang ?? ''));
      if (typeof document !== 'undefined') {
        document.documentElement.lang = nextLang;
      }
      if (i18n.language !== nextLang) {
        void i18n.changeLanguage(nextLang);
      }
      return Story();
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
};

export default preview;
