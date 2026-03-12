import type { Preview } from '@storybook/react-vite';
import '../src/index.css';

// Override app's overflow:hidden on html/body (needed for full-screen map)
// so that Storybook docs pages and story previews can scroll.
if (typeof document !== 'undefined') {
  document.documentElement.style.overflow = 'auto';
  document.body.style.overflow = 'auto';
}

const preview: Preview = {
  tags: ['autodocs'],
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
