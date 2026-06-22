# Dependency Notes

> [!NOTE]
> This file is experience-based and should be updated whenever new compatibility findings or unblock conditions are discovered.

## Packages to hold for now

Patch updates are usually fine. Hold major or large minor updates until compatibility is confirmed for the packages below.

- `typescript` `~5` -> `~6`: TypeScript 6 is still recent and the surrounding ecosystem (typescript-eslint, library type defs) has limited field experience. Stay on 5.x until v6 has more shake-out time.

If using Dependabot or Renovate, consider ignoring these package ranges until they are unblocked.
