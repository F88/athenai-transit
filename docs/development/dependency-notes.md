# Dependency Notes

> [!NOTE]
> This file is experience-based and should be updated whenever new compatibility findings or unblock conditions are discovered.

## Packages to hold for now

Patch updates are usually fine. Hold major or large minor updates until compatibility is confirmed for the packages below.

- `typescript` `~5` -> `~6`: TypeScript 6 is still recent and the surrounding ecosystem (typescript-eslint, library type defs) has limited field experience. Stay on 5.x until v6 has more shake-out time.
- `@types/node`: Keep the `@types/node` major aligned with the Node runtime. The runtime is Node 24 (`engines.node` `>=24`; `.tool-versions` pins `nodejs 24.18.0`; CI `node-version: 24`), so `@types/node` is pinned to the matching `^24` major. Only the major must track the runtime; minor/patch is independent of the Node minor/patch. Bumping the major ahead of the runtime exposes APIs missing at runtime, so move it only together with a Node runtime upgrade.

If using Dependabot or Renovate, consider ignoring these package ranges until they are unblocked.
