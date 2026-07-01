import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './pwa.config';

// https://vite.dev/config/
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const isStorybook = process.env.STORYBOOK === '1';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [tailwindcss(), react(), ...(!isStorybook ? [VitePWA(pwaOptions)] : [])],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'leaflet',
              test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)(?:[\\/]|$)/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)(?:[\\/]|$)/,
            },
            {
              name: 'holiday-jp',
              test: /node_modules[\\/]@holiday-jp(?:[\\/]|$)/,
            },
          ],
        },
      },
    },
  },
});
