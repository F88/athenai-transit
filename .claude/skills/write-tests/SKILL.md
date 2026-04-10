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
3. Identify the public contract before writing assertions: inputs, outputs, observable side effects, priority rules, and failure behavior
4. Prefer small purpose-built fixtures over production config/data when the production data would make the assertion ambiguous
5. Write tests to `{source-dir}/__tests__/{filename}.test.ts` (e.g. `src/utils/__tests__/`, `src/hooks/__tests__/`)
6. Run `npx vitest run {test-file-path}` to verify

## Key Rules

- Import `describe`, `expect`, `it` from `vitest`
- Organize by public API surface: top-level `describe` for the module/class, nested `describe` blocks for constructor/method/function groups when that improves scanability
- Cover: happy path, edge cases, boundary values, immutability

## Specification-First Rules

- Test externally observable behavior, not the current implementation steps
- Do not derive expected values by repeating the production logic in the assertion
- Do not build expectations from the same production fixture/config that the code under test reads when that would make regressions invisible
- Prefer small explicit expected values written inline over `filter(...).map(...)` chains that mirror the implementation
- Use focused custom fixtures or mocks when real settings/data collapse important distinctions such as "default" vs "all"
- Each test should prove one contract or priority rule; if a test name needs "and", consider splitting it
- Name tests as input -> behavior -> result whenever possible
- When a fallback/precedence rule exists, test both the winning input and the loser that must be ignored
- When parsing persisted data, include malformed input and structurally valid but semantically wrong input if behavior matters
- Avoid assertions that only prove the current dataset shape, ordering, or all-true/all-false defaults unless that dataset shape is itself the contract

## Anti-Patterns To Avoid

- Asserting `expected = sourceData.filter(...).map(...)` when the source under test reads `sourceData` too
- Calling helper functions from the production path to compute the expected value for the same test
- Using broad fixtures that accidentally make multiple branches return the same result
- Writing tests that mainly restate comments like "falsy values fall through" instead of the user-visible rule
- Overfitting to internal implementation details such as temporary variable names, exact loop structure, or private helper boundaries

## Good Test Design Heuristics

- If changing the implementation without changing behavior would break the test, the test is probably too coupled
- If a bug in the expectation-building code could hide the same bug in the production code, simplify the expectation
- If two branches can pass with the same fixture, create a smaller fixture that separates them
- If the behavior is defined by priority, write one test per priority boundary
- For classes, prefer `describe('ClassName')` with nested `describe('Constructor')` / `describe('methodName')` blocks when the file covers multiple entry points

## TZ-Independent Tests

Tests must pass regardless of the runner's timezone (`TZ` env or CI server location).

- Use `new Date(year, monthIndex, day, h, m)` for date construction (local time, consistent)
- Use relative comparisons (`getTime()` difference) or epoch milliseconds
- Never compare locale-formatted strings
- Never depend on `toLocaleString()`, `toLocaleDateString()`, or similar output
