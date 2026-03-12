---
name: release
description: >
    Bump version, update CHANGELOG, commit, tag, push, and create a GitHub Release.
    Use when the user asks to "release", "bump version", "cut a release",
    "create a release", or wants to publish a new version.
---

# Release

Create a CalVer release with changelog, tag, and GitHub Release.

## Version Format

CalVer: `YYYY.MM.DD` (e.g. `2026.03.12`). The user provides the version.

## Steps

1. **Update `package.json`** — set `"version"` to the new CalVer version
2. **Run `npm install`** — to update `package-lock.json`
3. **Update `CHANGELOG.md`**
   - Move contents under `[Unreleased]` into a new `[version]` section
   - If `[Unreleased]` is empty, draft changelog from `git log` since the last tag
   - Keep `[Unreleased]` header (empty) above the new version section
   - Follow [Keep a Changelog](https://keepachangelog.com/) format: `### Added`, `### Fixed`, `### Changed`, `### Removed`
4. **Run all checks** — `npm run typecheck && npm run format && npm run lint:fix && npm run test && npm run build`
5. **Commit** — `chore(release): {version}`
6. **Tag** — `v{version}` (e.g. `v2026.03.12`)
7. **Push** — `git push && git push --tags` (confirm with user before pushing to main)
8. **Create GitHub Release** — `gh release create v{version}` with release notes

## GitHub Release Notes

Release notes are based on CHANGELOG but may need more detail:

- If CHANGELOG is a **summary** (e.g. "port webapp"), expand with specifics from `git log`
- If CHANGELOG is **detailed**, use it as-is
- Format: markdown with `## What's New`, `## Bug Fixes` sections
- Include link to full diff: `**Full Changelog**: https://github.com/{owner}/{repo}/compare/{prev_tag}...v{version}`
- If this is the first release (no previous tag), use the initial commit as base

## Pre-flight Checks

Before starting, verify:

- Working tree is clean (`git status`)
- On the correct branch (usually `main`)
- No version references to old version in source files (search for the old version string)
- `__APP_VERSION__` in `vite.config.ts` reads from `npm_package_version` (auto-updated)
