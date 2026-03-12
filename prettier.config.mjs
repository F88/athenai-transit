/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import('prettier').Config}
 */
const config = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  plugins: ['prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: '*.md',
      options: {
        tabWidth: 4,
        useTabs: false,
      },
    },
  ],
};

export default config;
