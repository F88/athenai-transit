import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * PWA assets generation config.
 *
 * The generator writes its output next to the source image. Each icon
 * revision lives in its own folder under `public/icons/` (v1, v2, ...),
 * holding the 1024x1024 source plus the generated assets. The app
 * references the active revision (see the manifest icons in vite.config.ts).
 *
 * Run with: `npm run generate-pwa-assets`
 */
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    apple: {
      sizes: [180],
      padding: 0,
    },
  },
  images: ['public/icons/v2/icon-v2-1024x1024.png'],
});
