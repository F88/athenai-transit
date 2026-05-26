# Dependency Notes

> [!NOTE]
> This file is experience-based and should be updated whenever new compatibility findings or unblock conditions are discovered.

## Packages to hold for now

Patch updates are usually fine. Hold major or large minor updates until compatibility is confirmed for the packages below.

- `eslint` `^9` -> `^10`: many breaking changes are expected.
- `vite` `^7` -> `^8`: `@vitejs/plugin-react` v6 requires Vite 8+, so they need to move together after ecosystem support is ready.
- ESLint-related plugins (`typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-storybook`): tied to the held ESLint major update.

If using Dependabot or Renovate, consider ignoring these package ranges until they are unblocked.
