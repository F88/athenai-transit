---
name: write-tests
description: >
    Write unit tests for TypeScript utility functions using Vitest.
    Use when the user asks to "add tests", "write tests", "test this file",
    or wants test coverage for any source file.
---

# Write Tests

## Steps

1. Read the target source file
2. Read 1-2 existing tests in the sibling `__tests__/` directory to match project style
3. Write tests to `{source-dir}/__tests__/{filename}.test.ts` (e.g. `src/utils/__tests__/`, `src/hooks/__tests__/`)
4. Run `npx vitest run {test-file-path}` to verify

## Key Rules

- Import `describe`, `expect`, `it` from `vitest`
- One `describe` per exported function
- Cover: happy path, edge cases, boundary values, immutability

## TZ-Independent Tests

Tests must pass regardless of the runner's timezone (`TZ` env or CI server location).

- Use `new Date(year, monthIndex, day, h, m)` for date construction (local time, consistent)
- Use relative comparisons (`getTime()` difference) or epoch milliseconds
- Never compare locale-formatted strings
- Never depend on `toLocaleString()`, `toLocaleDateString()`, or similar output
